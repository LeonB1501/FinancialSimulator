import { max } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { solveNewtonRaphson, normalPdf, normalCdf } from "./FinancialMath.js";
import { find, tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";

function calculateD1D2(S, K, t, sigma, r) {
    const S_1 = S;
    if (((t <= 0) ? true : (sigma <= 0)) ? true : (S_1 <= 0)) {
        return [0, 0];
    }
    else {
        const d1 = (Math.log(S_1 / K) + ((r + ((0.5 * sigma) * sigma)) * t)) / (sigma * Math.sqrt(t));
        return [d1, d1 - (sigma * Math.sqrt(t))];
    }
}

/**
 * Calculates Option Price using Black-Scholes
 */
export function calculateOptionPrice(option, underlyingPrice, volMultiplier, dte, riskFreeRate) {
    const S = underlyingPrice;
    const K = option.Strike;
    const t = dte / 365;
    const r = riskFreeRate;
    const sigma = 0.2 * volMultiplier;
    if (t <= 0) {
        if (option.IsCall) {
            return max(0, S - K);
        }
        else {
            return max(0, K - S);
        }
    }
    else if (sigma <= 1E-09) {
        const discountFactor = Math.exp(-r * t);
        if (option.IsCall) {
            return max(0, S - (K * discountFactor));
        }
        else {
            return max(0, (K * discountFactor) - S);
        }
    }
    else {
        const patternInput = calculateD1D2(S, K, t, sigma, r);
        const d2 = patternInput[1];
        const d1 = patternInput[0];
        if (option.IsCall) {
            return (S * normalCdf(d1)) - ((K * Math.exp(-r * t)) * normalCdf(d2));
        }
        else {
            return ((K * Math.exp(-r * t)) * normalCdf(-d2)) - (S * normalCdf(-d1));
        }
    }
}

function calcGreeksInternal(isCall, S, K, t, sigma, r) {
    const S_1 = S;
    const K_1 = K;
    if (t <= 0) {
        return [0, 0, 0, 0, 0];
    }
    else {
        const patternInput = calculateD1D2(S_1, K_1, t, sigma, r);
        const d2 = patternInput[1];
        const d1 = patternInput[0];
        const nd1 = normalPdf(d1);
        const sqrtT = Math.sqrt(t);
        const e_rt = Math.exp(-r * t);
        const vega_1 = ((S_1 * nd1) * sqrtT) * 0.01;
        const thetaCommon = -((S_1 * nd1) * sigma) / (2 * sqrtT);
        return [isCall ? normalCdf(d1) : (normalCdf(d1) - 1), nd1 / ((S_1 * sigma) * sqrtT), (isCall ? (thetaCommon - (((r * K_1) * e_rt) * normalCdf(d2))) : (thetaCommon + (((r * K_1) * e_rt) * normalCdf(-d2)))) / 365, vega_1, (isCall ? (((K_1 * t) * e_rt) * normalCdf(d2)) : (((-K_1 * t) * e_rt) * normalCdf(-d2))) * 0.01];
    }
}

export function findStrikeForDelta(spec, history, currentDay, riskFreeRate) {
    let ticker;
    const matchValue = spec.Underlying;
    ticker = ((matchValue.tag === 1) ? matchValue.fields[0] : matchValue.fields[0]);
    let patternInput;
    const matchValue_1 = tryFind((p) => (p.Ticker === ticker), history);
    if (matchValue_1 == null) {
        patternInput = [100, 0.2];
    }
    else {
        const data = item(currentDay, matchValue_1.DailyData);
        patternInput = [data.Price, data.Vol];
    }
    const currentVol = patternInput[1];
    const currentPrice = patternInput[0];
    const t_2 = spec.DTE / 365;
    const targetDelta = spec.GreekValue;
    const isCallOption = targetDelta > 0;
    const r = riskFreeRate;
    if (Math.abs(targetDelta) >= 1) {
        return currentPrice;
    }
    else {
        return solveNewtonRaphson((k) => {
            const d1 = calculateD1D2(currentPrice, k, t_2, currentVol, r)[0];
            return (isCallOption ? normalCdf(d1) : (normalCdf(d1) - 1)) - targetDelta;
        }, (k_1) => (-1 * (normalPdf(calculateD1D2(currentPrice, k_1, t_2, currentVol, r)[0]) / ((k_1 * currentVol) * Math.sqrt(t_2)))), 0, currentPrice);
    }
}

function getContext(option, history, currentDay) {
    let ticker;
    const matchValue = option.Underlying;
    ticker = ((matchValue.tag === 1) ? matchValue.fields[0] : matchValue.fields[0]);
    const data = item(currentDay, find((p) => (p.Ticker === ticker), history).DailyData);
    return [data.Price, option.Strike, (option.ExpiryDay - currentDay) / 365, data.Vol];
}

export function price(option, history, currentDay, riskFreeRate) {
    let ticker;
    const matchValue = option.Underlying;
    ticker = ((matchValue.tag === 1) ? matchValue.fields[0] : matchValue.fields[0]);
    const data = item(currentDay, find((p) => (p.Ticker === ticker), history).DailyData);
    const S = data.Price;
    const t_2 = (option.ExpiryDay - currentDay) / 365;
    const r = riskFreeRate;
    if (t_2 <= 0) {
        if (option.IsCall) {
            return max(0, S - option.Strike);
        }
        else {
            return max(0, option.Strike - S);
        }
    }
    else {
        const patternInput = calculateD1D2(S, option.Strike, t_2, data.Vol, r);
        const d2 = patternInput[1];
        const d1 = patternInput[0];
        if (option.IsCall) {
            return (S * normalCdf(d1)) - ((option.Strike * Math.exp(-r * t_2)) * normalCdf(d2));
        }
        else {
            return ((option.Strike * Math.exp(-r * t_2)) * normalCdf(-d2)) - (S * normalCdf(-d1));
        }
    }
}

export function delta(option, history, currentDay, riskFreeRate) {
    const patternInput = getContext(option, history, currentDay);
    return calcGreeksInternal(option.IsCall, patternInput[0], patternInput[1], patternInput[2], patternInput[3], riskFreeRate)[0];
}

export function gamma(option, history, currentDay, riskFreeRate) {
    const patternInput = getContext(option, history, currentDay);
    return calcGreeksInternal(option.IsCall, patternInput[0], patternInput[1], patternInput[2], patternInput[3], riskFreeRate)[1];
}

export function theta(option, history, currentDay, riskFreeRate) {
    const patternInput = getContext(option, history, currentDay);
    return calcGreeksInternal(option.IsCall, patternInput[0], patternInput[1], patternInput[2], patternInput[3], riskFreeRate)[2];
}

export function vega(option, history, currentDay, riskFreeRate) {
    const patternInput = getContext(option, history, currentDay);
    return calcGreeksInternal(option.IsCall, patternInput[0], patternInput[1], patternInput[2], patternInput[3], riskFreeRate)[3];
}

export function rho(option, history, currentDay, riskFreeRate) {
    const patternInput = getContext(option, history, currentDay);
    return calcGreeksInternal(option.IsCall, patternInput[0], patternInput[1], patternInput[2], patternInput[3], riskFreeRate)[4];
}

