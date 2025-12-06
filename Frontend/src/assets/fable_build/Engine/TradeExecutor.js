import { price as price_3 } from "../Simulation/PricingModels.js";
import { fold, choose, ofArray, filter, sumBy, empty, sortBy, cons, head, tail, isEmpty, append, tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { stringHash, comparePrimitives, equals } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { SellParams, BuyParams, Transaction, Portfolio, PositionInstance } from "./EngineTypes.js";
import { newGuid } from "../fable_modules/fable-library-js.4.27.0/Guid.js";
import { toArray, defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { List_distinct } from "../fable_modules/fable-library-js.4.27.0/Seq2.js";

function getMarketPrice(instrument, history, currentDay, riskFreeRate) {
    let p_1;
    switch (instrument.tag) {
        case 1:
            return price_3(instrument.fields[0], history, currentDay, riskFreeRate);
        case 2:
            return 0;
        default: {
            const assetRef = instrument.fields[0];
            const ticker = (assetRef.tag === 1) ? assetRef.fields[0] : assetRef.fields[0];
            const path = tryFind((p) => (p.Ticker === ticker), history);
            let matchResult, p_2;
            if (path != null) {
                if ((p_1 = path, currentDay < p_1.DailyData.length)) {
                    matchResult = 0;
                    p_2 = path;
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
                    return item(currentDay, p_2.DailyData).Price;
                default:
                    return 0;
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

function executeBuy(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate) {
    const executionPrice = getMarketPrice(params_.Instrument, history, currentDay, riskFreeRate);
    const cost = (executionPrice * params_.Quantity) * getMultiplier(params_.Instrument);
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
    const patternInput = coverShorts(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty());
    const remainingQty = patternInput[0];
    const newPositionsAfterCover = patternInput[1];
    return [new Portfolio(portfolio.Cash - cost, (remainingQty > 0) ? cons(new PositionInstance(newGuid(), batchGroupId, defaultArg(params_.DefinitionName, ""), params_.ComponentName, undefined, executionPrice, currentDay, remainingQty, params_.Instrument), newPositionsAfterCover) : newPositionsAfterCover, portfolio.CompositeRegistry), (params_.Quantity > 0) ? (new Transaction(currentDay, getTickerFromInstrument(params_.Instrument), "BUY", params_.Quantity, executionPrice, cost)) : undefined];
}

function executeSell(portfolio, params_, history, currentDay, batchGroupId, riskFreeRate) {
    const executionPrice = getMarketPrice(params_.Instrument, history, currentDay, riskFreeRate);
    const proceeds = (executionPrice * params_.Quantity) * getMultiplier(params_.Instrument);
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
    return [new Portfolio(portfolio.Cash + proceeds, consumeQuantity(params_.Quantity, sortBy((p) => p.BuyDate, portfolio.Positions, {
        Compare: comparePrimitives,
    }), empty()), portfolio.CompositeRegistry), (params_.Quantity > 0) ? (new Transaction(currentDay, getTickerFromInstrument(params_.Instrument), "SELL", params_.Quantity, executionPrice, proceeds)) : undefined];
}

function executeRebalance(portfolio, params_, history, currentDay, riskFreeRate) {
    const diff = ((portfolio.Cash + sumBy((p) => ((getMarketPrice(p.Instrument, history, currentDay, riskFreeRate) * p.Quantity) * getMultiplier(p.Instrument)), portfolio.Positions, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    })) * (params_.TargetPercent / 100)) - sumBy((p_2) => ((getMarketPrice(p_2.Instrument, history, currentDay, riskFreeRate) * p_2.Quantity) * getMultiplier(p_2.Instrument)), filter((p_1) => equals(p_1.Instrument, params_.Instrument), portfolio.Positions), {
        GetZero: () => 0,
        Add: (x_1, y_1) => (x_1 + y_1),
    });
    const price_2 = getMarketPrice(params_.Instrument, history, currentDay, riskFreeRate);
    const multiplier = getMultiplier(params_.Instrument);
    if (price_2 === 0) {
        return [portfolio, empty()];
    }
    else {
        const qty = Math.abs(diff / (price_2 * multiplier));
        if (diff > 0) {
            const patternInput = executeBuy(portfolio, new BuyParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate);
            return [patternInput[0], ofArray(toArray(patternInput[1]))];
        }
        else {
            const patternInput_1 = executeSell(portfolio, new SellParams(params_.Instrument, qty, undefined, "REBALANCE"), history, currentDay, undefined, riskFreeRate);
            return [patternInput_1[0], ofArray(toArray(patternInput_1[1]))];
        }
    }
}

/**
 * Execute trades and return updated portfolio along with transaction log
 */
export function executeTrades(trades, portfolio, history, currentDay, riskFreeRate) {
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
                const patternInput_1 = executeSell(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate);
                return [patternInput_1[0], append(txnAcc, ofArray(toArray(patternInput_1[1])))];
            }
            case 2: {
                const patternInput_2 = executeRebalance(currentPortfolio, trade.fields[0], history, currentDay, riskFreeRate);
                return [patternInput_2[0], append(txnAcc, patternInput_2[1])];
            }
            default: {
                const patternInput = executeBuy(currentPortfolio, trade.fields[0], history, currentDay, batchGroupId, riskFreeRate);
                return [patternInput[0], append(txnAcc, ofArray(toArray(patternInput[1])))];
            }
        }
    }, [portfolio, empty()], trades);
}

