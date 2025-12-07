import { fold, choose, ofArray, filter, sumBy, empty, sortBy, cons, head, tail, isEmpty, append, tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { price } from "../Simulation/PricingModels.js";
import { stringHash, comparePrimitives, equals } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { SellParams, BuyParams, Transaction, Portfolio, PositionInstance } from "./EngineTypes.js";
import { newGuid } from "../fable_modules/fable-library-js.4.27.0/Guid.js";
import { toArray, defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { List_distinct } from "../fable_modules/fable-library-js.4.27.0/Seq2.js";

function getMarketData(instrument, history, currentDay) {
    let p_4, p_1;
    switch (instrument.tag) {
        case 1: {
            let ticker_1;
            const matchValue = instrument.fields[0].Underlying;
            ticker_1 = ((matchValue.tag === 1) ? matchValue.fields[0] : matchValue.fields[0]);
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
            const ticker = (assetRef.tag === 1) ? assetRef.fields[0] : assetRef.fields[0];
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

function executeBuy(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate, costs) {
    const patternInput = getMarketData(params_.Instrument, history, currentDay);
    let basePrice;
    const matchValue = params_.Instrument;
    basePrice = ((matchValue.tag === 1) ? price(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput[0]);
    const executionPrice = basePrice * (1 + (calculateSlippage(costs, patternInput[1]) / 2));
    const multiplier = getMultiplier(params_.Instrument);
    const commission = calculateCommission(costs, params_.Quantity);
    const totalCost = ((executionPrice * params_.Quantity) * multiplier) + commission;
    const slippageAmount = ((executionPrice - basePrice) * params_.Quantity) * multiplier;
    const coverShorts = (remainingToBuy_mut, positions_mut, acc_mut) => {
        coverShorts:
        while (true) {
            const remainingToBuy = remainingToBuy_mut, positions = positions_mut, acc = acc_mut;
            if (remainingToBuy <= 0) {
                return [0, append(acc, positions)];
            }
            else if (!isEmpty(positions)) {
                const rest = tail(positions);
                const p_1 = head(positions);
                if (equals(p_1.Instrument, params_.Instrument) && (p_1.Quantity < 0)) {
                    const shortSize = Math.abs(p_1.Quantity);
                    if (shortSize > remainingToBuy) {
                        return [0, append(acc, cons(new PositionInstance(p_1.Id, p_1.GroupId, p_1.DefinitionName, p_1.ComponentName, p_1.ParentId, p_1.BuyPrice, p_1.BuyDate, p_1.Quantity + remainingToBuy, p_1.Instrument), rest))];
                    }
                    else {
                        remainingToBuy_mut = (remainingToBuy - shortSize);
                        positions_mut = rest;
                        acc_mut = acc;
                        continue coverShorts;
                    }
                }
                else {
                    remainingToBuy_mut = remainingToBuy;
                    positions_mut = rest;
                    acc_mut = cons(p_1, acc);
                    continue coverShorts;
                }
            }
            else {
                return [remainingToBuy, acc];
            }
            break;
        }
    };
    const patternInput_1 = coverShorts(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty());
    const remainingQty = patternInput_1[0];
    const newPositionsAfterCover = patternInput_1[1];
    return [new Portfolio(portfolio.Cash - totalCost, (remainingQty > 0) ? cons(new PositionInstance(newGuid(), batchGroupId, defaultArg(params_.DefinitionName, ""), params_.ComponentName, undefined, executionPrice, currentDay, remainingQty, params_.Instrument), newPositionsAfterCover) : newPositionsAfterCover, portfolio.CompositeRegistry), (params_.Quantity > 0) ? (new Transaction(currentDay, getTickerFromInstrument(params_.Instrument), "BUY", params_.Quantity, executionPrice, totalCost, commission, slippageAmount, params_.DefinitionName)) : undefined];
}

function executeSell(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate, costs) {
    const patternInput = getMarketData(params_.Instrument, history, currentDay);
    let basePrice;
    const matchValue = params_.Instrument;
    basePrice = ((matchValue.tag === 1) ? price(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput[0]);
    const executionPrice = basePrice * (1 - (calculateSlippage(costs, patternInput[1]) / 2));
    const multiplier = getMultiplier(params_.Instrument);
    const commission = calculateCommission(costs, params_.Quantity);
    const netProceeds = ((executionPrice * params_.Quantity) * multiplier) - commission;
    const slippageAmount = ((basePrice - executionPrice) * params_.Quantity) * multiplier;
    const consumeQuantity = (remainingToSell_mut, positions_mut, acc_mut) => {
        consumeQuantity:
        while (true) {
            const remainingToSell = remainingToSell_mut, positions = positions_mut, acc = acc_mut;
            if (remainingToSell <= 0) {
                return append(acc, positions);
            }
            else if (!isEmpty(positions)) {
                const rest = tail(positions);
                const p_1 = head(positions);
                if (equals(p_1.Instrument, params_.Instrument) && (p_1.Quantity > 0)) {
                    if (p_1.Quantity > remainingToSell) {
                        return append(acc, cons(new PositionInstance(p_1.Id, p_1.GroupId, p_1.DefinitionName, p_1.ComponentName, p_1.ParentId, p_1.BuyPrice, p_1.BuyDate, p_1.Quantity - remainingToSell, p_1.Instrument), rest));
                    }
                    else {
                        remainingToSell_mut = (remainingToSell - p_1.Quantity);
                        positions_mut = rest;
                        acc_mut = acc;
                        continue consumeQuantity;
                    }
                }
                else {
                    remainingToSell_mut = remainingToSell;
                    positions_mut = rest;
                    acc_mut = cons(p_1, acc);
                    continue consumeQuantity;
                }
            }
            else {
                return cons(new PositionInstance(newGuid(), batchGroupId, defaultArg(params_.DefinitionName, "SHORT"), params_.ComponentName, undefined, executionPrice, currentDay, -remainingToSell, params_.Instrument), acc);
            }
            break;
        }
    };
    return [new Portfolio(portfolio.Cash + netProceeds, consumeQuantity(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty()), portfolio.CompositeRegistry), (params_.Quantity > 0) ? (new Transaction(currentDay, getTickerFromInstrument(params_.Instrument), "SELL", params_.Quantity, executionPrice, netProceeds, commission, slippageAmount, params_.DefinitionName)) : undefined];
}

function executeRebalance(portfolio, params_, history, currentDay, riskFreeRate, costs) {
    const midPrice = getMarketData(params_.Instrument, history, currentDay)[0];
    const diff = ((portfolio.Cash + sumBy((p) => {
        let matchValue;
        const patternInput_1 = getMarketData(p.Instrument, history, currentDay);
        return (((matchValue = p.Instrument, (matchValue.tag === 1) ? price(matchValue.fields[0], history, currentDay, riskFreeRate) : patternInput_1[0])) * p.Quantity) * getMultiplier(p.Instrument);
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
            const patternInput_2 = executeBuy(portfolio, new BuyParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate, costs);
            return [patternInput_2[0], ofArray(toArray(patternInput_2[1]))];
        }
        else {
            const patternInput_3 = executeSell(portfolio, new SellParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate, costs);
            return [patternInput_3[0], ofArray(toArray(patternInput_3[1]))];
        }
    }
}

export function executeTrades(trades, portfolio, history, currentDay, riskFreeRate, costs) {
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
                const patternInput_1 = executeSell(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate, costs);
                return [patternInput_1[0], append(txnAcc, ofArray(toArray(patternInput_1[1])))];
            }
            case 2: {
                const patternInput_2 = executeRebalance(currentPortfolio, trade.fields[0], history, currentDay, riskFreeRate, costs);
                return [patternInput_2[0], append(txnAcc, patternInput_2[1])];
            }
            default: {
                const patternInput = executeBuy(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate, costs);
                return [patternInput[0], append(txnAcc, ofArray(toArray(patternInput[1])))];
            }
        }
    }, [portfolio, empty()], trades);
}

