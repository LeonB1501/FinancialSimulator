import { pairwise, map, item, setItem, initialize, fill } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { LinearAlgebra_choleskyDecomposition, NormalRandom_$ctor_Z524259A4, NormalRandom__Next, LinearAlgebra_multiplyMatrixVector } from "./Stochastic.js";
import { PricePath, MarketDataPoint } from "../Engine/EngineTypes.js";
import { clamp, max } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { append, map as map_1, mapIndexed, filter, item as item_1, length, toArray } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { normalCdf } from "./FinancialMath.js";
import { orElse, defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { ofList, FSharpMap__TryFind } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";

const TRADING_DAYS_PER_YEAR = 252;

function generateCorrelatedDrivers(rng, choleskyMatrix, days, assetCount) {
    const drivers = fill(new Array(days), 0, days, null);
    for (let d = 0; d <= (days - 1); d++) {
        const correlated = LinearAlgebra_multiplyMatrixVector(choleskyMatrix, initialize(assetCount, (_arg) => NormalRandom__Next(rng), Float64Array));
        setItem(drivers, d, correlated);
    }
    return drivers;
}

function generateGbmPath(initialPrice, mu, sigma, days, dt, drivers) {
    const result = fill(new Array(days + 1), 0, days + 1, null);
    setItem(result, 0, new MarketDataPoint(initialPrice, sigma));
    let currentPrice = initialPrice;
    const drift = (mu - ((0.5 * sigma) * sigma)) * dt;
    const diffusion = sigma * Math.sqrt(dt);
    for (let i = 0; i <= (days - 1); i++) {
        const z = item(i, drivers);
        currentPrice = (currentPrice * Math.exp(drift + (diffusion * z)));
        setItem(result, i + 1, new MarketDataPoint(currentPrice, sigma));
    }
    return result;
}

function generateHestonPath(initialPrice, p, days, dt, rng, priceDrivers) {
    const result = fill(new Array(days + 1), 0, days + 1, null);
    setItem(result, 0, new MarketDataPoint(initialPrice, Math.sqrt(p.V0)));
    let S = initialPrice;
    let v = p.V0;
    const sqrtDt = Math.sqrt(dt);
    for (let i = 0; i <= (days - 1); i++) {
        const z_price = item(i, priceDrivers);
        const z_vol_indep = NormalRandom__Next(rng);
        const z_vol = (p.Rho * z_price) + (Math.sqrt(1 - (p.Rho * p.Rho)) * z_vol_indep);
        const dv = ((p.Kappa * (p.Theta - v)) * dt) + (((p.Sigma * Math.sqrt(max(0, v))) * sqrtDt) * z_vol);
        v = max(p.Epsilon, v + dv);
        const drift = (p.Mu - (0.5 * v)) * dt;
        const diffusion = (Math.sqrt(v) * sqrtDt) * z_price;
        S = (S * Math.exp(drift + diffusion));
        setItem(result, i + 1, new MarketDataPoint(S, Math.sqrt(v)));
    }
    return result;
}

function generateGarchPath(initialPrice, p, days, dt, drivers) {
    const result = fill(new Array(days + 1), 0, days + 1, null);
    const longRunVar = p.Omega / ((1 - p.Alpha) - p.Beta);
    const initialVol = (p.InitialVol > 0) ? p.InitialVol : Math.sqrt(longRunVar);
    setItem(result, 0, new MarketDataPoint(initialPrice, initialVol));
    let S = initialPrice;
    let currentVar = initialVol * initialVol;
    let prevReturn = 0;
    for (let i = 0; i <= (days - 1); i++) {
        const z = item(i, drivers);
        const epsilonSq = Math.pow(prevReturn - (p.Mu * dt), 2);
        currentVar = ((p.Omega + (p.Alpha * epsilonSq)) + (p.Beta * currentVar));
        const currentVol = Math.sqrt(currentVar);
        const logReturn = ((p.Mu - (0.5 * currentVar)) * dt) + ((currentVol * Math.sqrt(dt)) * z);
        S = (S * Math.exp(logReturn));
        prevReturn = logReturn;
        setItem(result, i + 1, new MarketDataPoint(S, currentVol));
    }
    return result;
}

function generateRegimePath(initialPrice, initialRegime, regimes, days, dt, rng, drivers) {
    const result = fill(new Array(days + 1), 0, days + 1, null);
    const regimesArr = toArray(regimes);
    let currentRegimeIdx = initialRegime;
    if (regimesArr.length === 0) {
        throw new Error("No regimes defined");
    }
    const r0 = item(currentRegimeIdx, regimesArr);
    setItem(result, 0, new MarketDataPoint(initialPrice, r0.Sigma));
    let S = initialPrice;
    const sqrtDt = Math.sqrt(dt);
    for (let i = 0; i <= (days - 1); i++) {
        const z = item(i, drivers);
        const currentParams = item(currentRegimeIdx, regimesArr);
        const sigma = currentParams.Sigma;
        const drift = (currentParams.Mu - ((0.5 * sigma) * sigma)) * dt;
        const diffusion = (sigma * sqrtDt) * z;
        S = (S * Math.exp(drift + diffusion));
        setItem(result, i + 1, new MarketDataPoint(S, sigma));
        const u_uniform = normalCdf(NormalRandom__Next(rng));
        const probs = currentParams.TransitionProbs;
        let cumSum = 0;
        let switched = false;
        for (let r = 0; r <= (length(probs) - 1); r++) {
            if (!switched) {
                cumSum = (cumSum + item_1(r, probs));
                if (u_uniform <= cumSum) {
                    currentRegimeIdx = (r | 0);
                    switched = true;
                }
            }
        }
    }
    return result;
}

function generateBootstrapPath(initialPrice, p, history, days, rng) {
    if (history.length < p.BlockSize) {
        throw new Error("Historical data shorter than block size");
    }
    const result = fill(new Array(days + 1), 0, days + 1, null);
    const startVol = (history.length > 0) ? item(history.length - 1, history).Vol : 0.2;
    setItem(result, 0, new MarketDataPoint(initialPrice, startVol));
    let S = initialPrice;
    let currentDay = 0;
    const histReturns = map((tupledArg) => {
        const curr = tupledArg[1];
        return [Math.log(curr.Price / tupledArg[0].Price), curr.Vol];
    }, pairwise(history));
    const maxStartIdx = (histReturns.length - p.BlockSize) | 0;
    while (currentDay < days) {
        const safeStartIdx = clamp(~~(normalCdf(NormalRandom__Next(rng)) * maxStartIdx), 0, maxStartIdx) | 0;
        for (let i = 0; i <= (p.BlockSize - 1); i++) {
            if (currentDay < days) {
                const patternInput = item(safeStartIdx + i, histReturns);
                S = (S * Math.exp(patternInput[0]));
                setItem(result, currentDay + 1, new MarketDataPoint(S, patternInput[1]));
                currentDay = ((currentDay + 1) | 0);
            }
        }
    }
    return result;
}

function generateLeveragedPath(basePath, leverage, initialPrice) {
    const result = fill(new Array(basePath.length), 0, basePath.length, null);
    setItem(result, 0, new MarketDataPoint(initialPrice, item(0, basePath).Vol * Math.abs(leverage)));
    for (let i = 1; i <= (basePath.length - 1); i++) {
        const prevBase = item(i - 1, basePath).Price;
        const levReturn = ((item(i, basePath).Price - prevBase) / prevBase) * leverage;
        const finalPrice = max(0, item(i - 1, result).Price * (1 + levReturn));
        const levVol = item(i, basePath).Vol * Math.abs(leverage);
        setItem(result, i, new MarketDataPoint(finalPrice, levVol));
    }
    return result;
}

export function generatePaths(config, seed) {
    const rng = NormalRandom_$ctor_Z524259A4(seed);
    const dt = 1 / TRADING_DAYS_PER_YEAR;
    const primaryAssets = filter((a) => {
        if (a.Model.tag === 5) {
            return false;
        }
        else {
            return true;
        }
    }, config.Assets);
    const derivedAssets = filter((a_1) => {
        if (a_1.Model.tag === 5) {
            return true;
        }
        else {
            return false;
        }
    }, config.Assets);
    const assetCount = length(primaryAssets) | 0;
    const corrMatrix = initialize(assetCount, (_arg) => (new Float64Array(assetCount)));
    for (let i = 0; i <= (assetCount - 1); i++) {
        item(i, corrMatrix)[i] = 1;
    }
    for (let i_1 = 0; i_1 <= (assetCount - 1); i_1++) {
        for (let j = 0; j <= (assetCount - 1); j++) {
            if (i_1 !== j) {
                const t1 = item_1(i_1, primaryAssets).Ticker;
                const t2 = item_1(j, primaryAssets).Ticker;
                const rho = defaultArg(orElse(FSharpMap__TryFind(config.Correlations, [t1, t2]), FSharpMap__TryFind(config.Correlations, [t2, t1])), 0);
                item(i_1, corrMatrix)[j] = rho;
            }
        }
    }
    const drivers = (assetCount > 0) ? generateCorrelatedDrivers(rng, LinearAlgebra_choleskyDecomposition(corrMatrix), config.TradingDays, assetCount) : [];
    const primaryPaths = mapIndexed((idx, asset) => {
        let matchValue_2, matchValue_3;
        const assetDrivers = initialize(config.TradingDays, (d) => item(idx, item(d, drivers)), Float64Array);
        return new PricePath(asset.Ticker, (matchValue_2 = asset.Model, (matchValue_2.tag === 1) ? generateHestonPath(asset.InitialPrice, matchValue_2.fields[0], config.TradingDays, dt, rng, assetDrivers) : ((matchValue_2.tag === 2) ? generateGarchPath(asset.InitialPrice, matchValue_2.fields[0], config.TradingDays, dt, assetDrivers) : ((matchValue_2.tag === 3) ? generateRegimePath(asset.InitialPrice, matchValue_2.fields[0], matchValue_2.fields[1], config.TradingDays, dt, rng, assetDrivers) : ((matchValue_2.tag === 4) ? ((matchValue_3 = FSharpMap__TryFind(config.HistoricalData, asset.Ticker), (matchValue_3 == null) ? fill(new Array(config.TradingDays + 1), 0, config.TradingDays + 1, new MarketDataPoint(asset.InitialPrice, 0)) : generateBootstrapPath(asset.InitialPrice, matchValue_2.fields[0], matchValue_3, config.TradingDays, rng))) : ((matchValue_2.tag === 5) ? (() => {
            throw new Error("Should not happen due to filter");
        })() : generateGbmPath(asset.InitialPrice, matchValue_2.fields[0], matchValue_2.fields[1], config.TradingDays, dt, assetDrivers)))))));
    }, primaryAssets);
    const pathMap = ofList(map_1((p_3) => [p_3.Ticker, p_3.DailyData], primaryPaths), {
        Compare: comparePrimitives,
    });
    return append(primaryPaths, map_1((asset_1) => {
        const matchValue_4 = asset_1.Model;
        if (matchValue_4.tag === 5) {
            const matchValue_5 = FSharpMap__TryFind(pathMap, matchValue_4.fields[0]);
            if (matchValue_5 == null) {
                return new PricePath(asset_1.Ticker, fill(new Array(config.TradingDays + 1), 0, config.TradingDays + 1, new MarketDataPoint(0, 0)));
            }
            else {
                return new PricePath(asset_1.Ticker, generateLeveragedPath(matchValue_5, matchValue_4.fields[1], asset_1.InitialPrice));
            }
        }
        else {
            throw new Error("Should not happen due to filter");
        }
    }, derivedAssets));
}

