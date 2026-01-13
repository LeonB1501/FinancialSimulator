import { fold, choose, ofArray, filter, sumBy, sortBy, empty, cons, head, tail, isEmpty, singleton, append, tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { SellParams, BuyParams, Transaction, Portfolio, PositionInstance, TaxLot } from "./EngineTypes.js";
import { min } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { price as price_1 } from "../Simulation/PricingModels.js";
import { stringHash, comparePrimitives, equals } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { newGuid } from "../fable_modules/fable-library-js.4.27.0/Guid.js";
import { toArray, defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { List_distinct } from "../fable_modules/fable-library-js.4.27.0/Seq2.js";

function getMarketData(instrument, history, currentDay) {
    let p_4, p_1;
    switch (instrument.tag) {
        case 1: {
            let ticker_1;
            const matchValue = instrument.fields[0].Underlying;
            ticker_1 = ((matchValue.tag === 1) ? (`${matchValue.fields[1]}x_${matchValue.fields[0]}`) : matchValue.fields[0]);
            const path_1 = tryFind((p_3) => (p_3.Ticker === ticker_1), history);
            let matchResult, p_5;
            if (path_1 != null) {
                if ((p_4 = path_1, currentDay < p_4.DailyData.length)) {
                    matchResult = 0;
                    p_5 = path_1;
                }
                else {
                    matchResult = 1;
                }
            }
            else {
                matchResult = 1;
            }
            switch (matchResult) {
                case 0:
                    return [0, item(currentDay, p_5.DailyData).Vol];
                default:
                    return [0, 0];
            }
        }
        case 2:
            return [0, 0];
        default: {
            const assetRef = instrument.fields[0];
            const ticker = (assetRef.tag === 1) ? (`${assetRef.fields[1]}x_${assetRef.fields[0]}`) : assetRef.fields[0];
            const path = tryFind((p) => (p.Ticker === ticker), history);
            let matchResult_1, p_2;
            if (path != null) {
                if ((p_1 = path, currentDay < p_1.DailyData.length)) {
                    matchResult_1 = 0;
                    p_2 = path;
                }
                else {
                    matchResult_1 = 1;
                }
            }
            else {
                matchResult_1 = 1;
            }
            switch (matchResult_1) {
                case 0: {
                    const pt = item(currentDay, p_2.DailyData);
                    return [pt.Price, pt.Vol];
                }
                default:
                    return [0, 0];
            }
        }
    }
}

function getMultiplier(instrument) {
    if (instrument.tag === 1) {
        return 100;
    }
    else {
        return 1;
    }
}

function getTickerFromInstrument(instrument) {
    switch (instrument.tag) {
        case 1: {
            const matchValue = instrument.fields[0].Underlying;
            if (matchValue.tag === 1) {
                return `OPT_${matchValue.fields[1]}x_${matchValue.fields[0]}`;
            }
            else {
                return `OPT_${matchValue.fields[0]}`;
            }
        }
        case 2:
            return "COMPOUND";
        default: {
            const assetRef = instrument.fields[0];
            if (assetRef.tag === 1) {
                return `${assetRef.fields[1]}x_${assetRef.fields[0]}`;
            }
            else {
                return assetRef.fields[0];
            }
        }
    }
}

function calculateSlippage(costs, currentVol) {
    const tier = tryFind((t) => {
        if (currentVol >= t.MinVol) {
            return currentVol < t.MaxVol;
        }
        else {
            return false;
        }
    }, costs.Slippage.Tiers);
    if (tier == null) {
        return costs.Slippage.DefaultSpread;
    }
    else {
        return tier.Spread;
    }
}

function calculateCommission(costs, quantity) {
    return costs.Commission.PerOrder + (costs.Commission.PerUnit * Math.abs(quantity));
}

export function TaxCalculator_addLot(lots, ticker, qty, price, day) {
    return append(lots, singleton(new TaxLot(ticker, qty, price, day)));
}

export function TaxCalculator_consumeLots(lots, ticker, qtyToSell, sellPrice, currentDay, config) {
    const processLots = (remainingQty_mut, currentLots_mut, accLots_mut, accBasis_mut, accTax_mut) => {
        processLots:
        while (true) {
            const remainingQty = remainingQty_mut, currentLots = currentLots_mut, accLots = accLots_mut, accBasis = accBasis_mut, accTax = accTax_mut;
            if (remainingQty <= 1E-06) {
                return [accBasis, accTax, append(accLots, currentLots)];
            }
            else if (!isEmpty(currentLots)) {
                const rest = tail(currentLots);
                const lot = head(currentLots);
                if (lot.Ticker !== ticker) {
                    remainingQty_mut = remainingQty;
                    currentLots_mut = rest;
                    accLots_mut = append(accLots, singleton(lot));
                    accBasis_mut = accBasis;
                    accTax_mut = accTax;
                    continue processLots;
                }
                else {
                    const qtyTaken = min(remainingQty, lot.Quantity);
                    const lotBasis = qtyTaken * lot.BuyPrice;
                    const gain = (qtyTaken * sellPrice) - lotBasis;
                    const newAccBasis = accBasis + lotBasis;
                    const newAccTax = accTax + ((gain > 0) ? (gain * (((currentDay - lot.BuyDate) > config.LongTermThreshold) ? config.LongTermRate : config.ShortTermRate)) : 0);
                    if (lot.Quantity > qtyTaken) {
                        return [newAccBasis, newAccTax, append(accLots, cons(new TaxLot(lot.Ticker, lot.Quantity - qtyTaken, lot.BuyPrice, lot.BuyDate), rest))];
                    }
                    else {
                        remainingQty_mut = (remainingQty - qtyTaken);
                        currentLots_mut = rest;
                        accLots_mut = accLots;
                        accBasis_mut = newAccBasis;
                        accTax_mut = newAccTax;
                        continue processLots;
                    }
                }
            }
            else {
                return [accBasis, accTax, accLots];
            }
            break;
        }
    };
    return processLots(qtyToSell, lots, empty(), 0, 0);
}

function executeBuy(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate, costs, taxConfig) {
    const patternInput = getMarketData(params_.Instrument, history, currentDay);
    let basePrice;
    const matchValue = params_.Instrument;
    basePrice = ((matchValue.tag === 1) ? price_1(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput[0]);
    const executionPrice = basePrice * (1 + (calculateSlippage(costs, patternInput[1]) / 2));
    const multiplier = getMultiplier(params_.Instrument);
    const commission = calculateCommission(costs, params_.Quantity);
    const totalCost = ((executionPrice * params_.Quantity) * multiplier) + commission;
    const slippageAmount = ((executionPrice - basePrice) * params_.Quantity) * multiplier;
    const coverShorts = (remainingToBuy_mut, positions_mut, accPos_mut, accTax_mut) => {
        coverShorts:
        while (true) {
            const remainingToBuy = remainingToBuy_mut, positions = positions_mut, accPos = accPos_mut, accTax = accTax_mut;
            if (remainingToBuy <= 0) {
                return [0, append(accPos, positions), accTax];
            }
            else if (!isEmpty(positions)) {
                const rest = tail(positions);
                const p_1 = head(positions);
                if (equals(p_1.Instrument, params_.Instrument) && (p_1.Quantity < 0)) {
                    const shortSize = Math.abs(p_1.Quantity);
                    const gain = ((p_1.BuyPrice - executionPrice) * min(shortSize, remainingToBuy)) * multiplier;
                    const tax = (gain > 0) ? (gain * taxConfig.ShortTermRate) : 0;
                    if (shortSize > remainingToBuy) {
                        return [0, append(accPos, cons(new PositionInstance(p_1.Id, p_1.GroupId, p_1.DefinitionName, p_1.ComponentName, p_1.ParentId, p_1.BuyPrice, p_1.BuyDate, p_1.Quantity + remainingToBuy, p_1.Instrument), rest)), accTax + tax];
                    }
                    else {
                        remainingToBuy_mut = (remainingToBuy - shortSize);
                        positions_mut = rest;
                        accPos_mut = accPos;
                        accTax_mut = (accTax + tax);
                        continue coverShorts;
                    }
                }
                else {
                    remainingToBuy_mut = remainingToBuy;
                    positions_mut = rest;
                    accPos_mut = append(accPos, singleton(p_1));
                    accTax_mut = accTax;
                    continue coverShorts;
                }
            }
            else {
                return [remainingToBuy, accPos, accTax];
            }
            break;
        }
    };
    const patternInput_1 = coverShorts(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty(), 0);
    const remainingQty = patternInput_1[0];
    const newPositionsAfterCover = patternInput_1[1];
    const coverTax = patternInput_1[2];
    const patternInput_2 = (remainingQty > 0) ? [cons(new PositionInstance(newGuid(), batchGroupId, defaultArg(params_.DefinitionName, ""), params_.ComponentName, undefined, executionPrice, currentDay, remainingQty, params_.Instrument), newPositionsAfterCover), TaxCalculator_addLot(portfolio.TaxLots, getTickerFromInstrument(params_.Instrument), remainingQty, executionPrice, currentDay)] : [newPositionsAfterCover, portfolio.TaxLots];
    const patternInput_3 = (taxConfig.PaymentMode.tag === 1) ? [totalCost, portfolio.TaxLiabilityYTD + coverTax] : [totalCost + coverTax, portfolio.TaxLiabilityYTD];
    return [new Portfolio(portfolio.Cash - patternInput_3[0], patternInput_2[0], portfolio.CompositeRegistry, patternInput_2[1], patternInput_3[1], portfolio.RealizedGainsYTD), (params_.Quantity > 0) ? (new Transaction(currentDay, getTickerFromInstrument(params_.Instrument), "BUY", params_.Quantity, executionPrice, totalCost, commission, slippageAmount, coverTax, params_.DefinitionName)) : undefined];
}

function executeSell(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate, costs, taxConfig) {
    const patternInput = getMarketData(params_.Instrument, history, currentDay);
    let basePrice;
    const matchValue = params_.Instrument;
    basePrice = ((matchValue.tag === 1) ? price_1(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput[0]);
    const executionPrice = basePrice * (1 - (calculateSlippage(costs, patternInput[1]) / 2));
    const multiplier = getMultiplier(params_.Instrument);
    const commission = calculateCommission(costs, params_.Quantity);
    const netProceeds = ((executionPrice * params_.Quantity) * multiplier) - commission;
    const slippageAmount = ((basePrice - executionPrice) * params_.Quantity) * multiplier;
    const consumeQuantity = (remainingToSell_mut, positions_mut, accPos_mut) => {
        consumeQuantity:
        while (true) {
            const remainingToSell = remainingToSell_mut, positions = positions_mut, accPos = accPos_mut;
            if (remainingToSell <= 0) {
                return [0, append(accPos, positions)];
            }
            else if (!isEmpty(positions)) {
                const rest = tail(positions);
                const p_1 = head(positions);
                if (equals(p_1.Instrument, params_.Instrument) && (p_1.Quantity > 0)) {
                    if (p_1.Quantity > remainingToSell) {
                        return [0, append(accPos, cons(new PositionInstance(p_1.Id, p_1.GroupId, p_1.DefinitionName, p_1.ComponentName, p_1.ParentId, p_1.BuyPrice, p_1.BuyDate, p_1.Quantity - remainingToSell, p_1.Instrument), rest))];
                    }
                    else {
                        remainingToSell_mut = (remainingToSell - p_1.Quantity);
                        positions_mut = rest;
                        accPos_mut = accPos;
                        continue consumeQuantity;
                    }
                }
                else {
                    remainingToSell_mut = remainingToSell;
                    positions_mut = rest;
                    accPos_mut = append(accPos, singleton(p_1));
                    continue consumeQuantity;
                }
            }
            else {
                return [remainingToSell, accPos];
            }
            break;
        }
    };
    const patternInput_1 = consumeQuantity(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty());
    const qtyForShort = patternInput_1[0];
    const newPositions = patternInput_1[1];
    const qtyClosed = params_.Quantity - qtyForShort;
    const ticker = getTickerFromInstrument(params_.Instrument);
    const patternInput_2 = (qtyClosed > 0) ? TaxCalculator_consumeLots(portfolio.TaxLots, ticker, qtyClosed, executionPrice, currentDay, taxConfig) : [0, 0, portfolio.TaxLots];
    const longTax = patternInput_2[1];
    const finalPositions = (qtyForShort > 0) ? cons(new PositionInstance(newGuid(), batchGroupId, defaultArg(params_.DefinitionName, "SHORT"), params_.ComponentName, undefined, executionPrice, currentDay, -qtyForShort, params_.Instrument), newPositions) : newPositions;
    const patternInput_3 = (taxConfig.PaymentMode.tag === 1) ? [portfolio.Cash + netProceeds, portfolio.TaxLiabilityYTD + longTax] : [(portfolio.Cash + netProceeds) - longTax, portfolio.TaxLiabilityYTD];
    return [new Portfolio(patternInput_3[0], finalPositions, portfolio.CompositeRegistry, patternInput_2[2], patternInput_3[1], portfolio.RealizedGainsYTD), (params_.Quantity > 0) ? (new Transaction(currentDay, ticker, "SELL", params_.Quantity, executionPrice, netProceeds, commission, slippageAmount, longTax, params_.DefinitionName)) : undefined];
}

function executeRebalance(portfolio, params_, history, currentDay, riskFreeRate, costs, taxConfig) {
    const midPrice = getMarketData(params_.Instrument, history, currentDay)[0];
    const diff = ((portfolio.Cash + sumBy((p) => {
        let matchValue;
        const patternInput_1 = getMarketData(p.Instrument, history, currentDay);
        return (((matchValue = p.Instrument, (matchValue.tag === 1) ? price_1(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput_1[0])) * p.Quantity) * getMultiplier(p.Instrument);
    }, portfolio.Positions, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    })) * (params_.TargetPercent / 100)) - sumBy((p_2) => ((midPrice * p_2.Quantity) * getMultiplier(p_2.Instrument)), filter((p_1) => equals(p_1.Instrument, params_.Instrument), portfolio.Positions), {
        GetZero: () => 0,
        Add: (x_1, y_1) => (x_1 + y_1),
    });
    const multiplier = getMultiplier(params_.Instrument);
    if (midPrice === 0) {
        return [portfolio, empty()];
    }
    else {
        const qty = Math.abs(diff / (midPrice * multiplier));
        if (diff > 0) {
            const patternInput_2 = executeBuy(portfolio, new BuyParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate, costs, taxConfig);
            return [patternInput_2[0], ofArray(toArray(patternInput_2[1]))];
        }
        else {
            const patternInput_3 = executeSell(portfolio, new SellParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate, costs, taxConfig);
            return [patternInput_3[0], ofArray(toArray(patternInput_3[1]))];
        }
    }
}

export function executeTrades(trades, portfolio, history, currentDay, riskFreeRate, costs, taxConfig) {
    let batchGroupId;
    const definitions = List_distinct(choose((_arg) => {
        switch (_arg.tag) {
            case 0:
                return _arg.fields[0].DefinitionName;
            case 1:
                return _arg.fields[0].DefinitionName;
            default:
                return undefined;
        }
    }, trades), {
        Equals: (x, y) => (x === y),
        GetHashCode: stringHash,
    });
    let matchResult, name;
    if (!isEmpty(definitions)) {
        if (isEmpty(tail(definitions))) {
            matchResult = 0;
            name = head(definitions);
        }
        else {
            matchResult = 1;
        }
    }
    else {
        matchResult = 1;
    }
    switch (matchResult) {
        case 0: {
            batchGroupId = newGuid();
            break;
        }
        default:
            batchGroupId = undefined;
    }
    return fold((tupledArg, trade) => {
        const currentPortfolio = tupledArg[0];
        const txnAcc = tupledArg[1];
        switch (trade.tag) {
            case 1: {
                const patternInput_1 = executeSell(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate, costs, taxConfig);
                return [patternInput_1[0], append(txnAcc, ofArray(toArray(patternInput_1[1])))];
            }
            case 2: {
                const patternInput_2 = executeRebalance(currentPortfolio, trade.fields[0], history, currentDay, riskFreeRate, costs, taxConfig);
                return [patternInput_2[0], append(txnAcc, patternInput_2[1])];
            }
            default: {
                const patternInput = executeBuy(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate, costs, taxConfig);
                return [patternInput[0], append(txnAcc, ofArray(toArray(patternInput[1])))];
            }
        }
    }, [portfolio, empty()], trades);
}

