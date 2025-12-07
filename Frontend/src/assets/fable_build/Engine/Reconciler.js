import { Union } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { Transaction, Portfolio, PositionInstance, PositionInstance_$reflection } from "./EngineTypes.js";
import { union_type, float64_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { map, sortBy, mapIndexed, choose, singleton, item as item_1, tryFindIndex, filter, tryFind, empty, reverse, append, cons, head as head_1, tail as tail_1, isEmpty } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { price } from "../Simulation/PricingModels.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { comparePrimitives, compareArrays, disposeSafe, stringHash, getEnumerator } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { List_groupBy } from "../fable_modules/fable-library-js.4.27.0/Seq2.js";
import { toList } from "../fable_modules/fable-library-js.4.27.0/Seq.js";
import { FSharpMap__TryFind, FSharpMap__Add, empty as empty_1 } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { min } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";

export class LiquidationCandidate extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["FreeLong", "PairedUnit"];
    }
}

export function LiquidationCandidate_$reflection() {
    return union_type("StrategyEngine.Engine.Reconciler.LiquidationCandidate", [], LiquidationCandidate, () => [[["Position", PositionInstance_$reflection()], ["Value", float64_type]], [["Short", PositionInstance_$reflection()], ["Long", PositionInstance_$reflection()], ["NetValue", float64_type]]]);
}

function takeQty(posList, needed) {
    const find = (pList_mut, acc_mut) => {
        find:
        while (true) {
            const pList = pList_mut, acc = acc_mut;
            if (!isEmpty(pList)) {
                const tail = tail_1(pList);
                const head = head_1(pList);
                const available = Math.abs(head.Quantity);
                if (available >= needed) {
                    const remainingQty = available - needed;
                    const newTail = (remainingQty > 1E-09) ? cons(new PositionInstance(head.Id, head.GroupId, head.DefinitionName, head.ComponentName, head.ParentId, head.BuyPrice, head.BuyDate, (head.Quantity > 0) ? remainingQty : -remainingQty, head.Instrument), tail) : tail;
                    return [new PositionInstance(head.Id, head.GroupId, head.DefinitionName, head.ComponentName, head.ParentId, head.BuyPrice, head.BuyDate, (head.Quantity > 0) ? needed : -needed, head.Instrument), append(reverse(acc), newTail)];
                }
                else {
                    pList_mut = tail;
                    acc_mut = cons(head, acc);
                    continue find;
                }
            }
            else {
                return undefined;
            }
            break;
        }
    };
    return find(posList, empty());
}

function getPrice(p, history, day, r) {
    const matchValue = p.Instrument;
    switch (matchValue.tag) {
        case 1:
            return price(matchValue.fields[0], history, day, r);
        case 2:
            return 0;
        default: {
            const assetRef = matchValue.fields[0];
            const ticker = (assetRef.tag === 1) ? assetRef.fields[0] : assetRef.fields[0];
            const matchValue_1 = tryFind((path) => (path.Ticker === ticker), history);
            if (matchValue_1 == null) {
                return 0;
            }
            else {
                return item(day, matchValue_1.DailyData).Price;
            }
        }
    }
}

function getLiquidationValue(p, history, day, r) {
    return (getPrice(p, history, day, r) * p.Quantity) * ((p.Instrument.tag === 1) ? 100 : 1);
}

function getUnderlying(p) {
    const matchValue = p.Instrument;
    switch (matchValue.tag) {
        case 1: {
            const matchValue_1 = matchValue.fields[0].Underlying;
            if (matchValue_1.tag === 1) {
                return matchValue_1.fields[0];
            }
            else {
                return matchValue_1.fields[0];
            }
        }
        case 2:
            return "COMPOUND";
        default:
            if (matchValue.fields[0].tag === 1) {
                return matchValue.fields[0].fields[0];
            }
            else {
                return matchValue.fields[0].fields[0];
            }
    }
}

function getExpiry(p) {
    const matchValue = p.Instrument;
    if (matchValue.tag === 1) {
        return matchValue.fields[0].ExpiryDay | 0;
    }
    else {
        return 2147483647;
    }
}

function getStrike(p) {
    const matchValue = p.Instrument;
    if (matchValue.tag === 1) {
        return matchValue.fields[0].Strike;
    }
    else {
        return 0;
    }
}

function matchPositions(positions, history, day, r) {
    const candidates = [];
    const enumerator = getEnumerator(List_groupBy(getUnderlying, positions, {
        Equals: (x, y) => (x === y),
        GetHashCode: stringHash,
    }));
    try {
        while (enumerator["System.Collections.IEnumerator.MoveNext"]()) {
            const groupPositions = enumerator["System.Collections.Generic.IEnumerator`1.get_Current"]()[1];
            let longShares = filter((p_1) => {
                if (p_1.Instrument.tag === 0) {
                    return p_1.Quantity > 0;
                }
                else {
                    return false;
                }
            }, groupPositions);
            let shortCalls = filter((p_2) => {
                const matchValue_1 = p_2.Instrument;
                if (matchValue_1.tag === 1) {
                    if (matchValue_1.fields[0].IsCall) {
                        return p_2.Quantity < 0;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            }, groupPositions);
            let longCalls = filter((p_3) => {
                const matchValue_2 = p_3.Instrument;
                if (matchValue_2.tag === 1) {
                    if (matchValue_2.fields[0].IsCall) {
                        return p_3.Quantity > 0;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            }, groupPositions);
            let shortPuts = filter((p_4) => {
                const matchValue_3 = p_4.Instrument;
                if (matchValue_3.tag === 1) {
                    if (!matchValue_3.fields[0].IsCall) {
                        return p_4.Quantity < 0;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            }, groupPositions);
            let longPuts = filter((p_5) => {
                const matchValue_4 = p_5.Instrument;
                if (matchValue_4.tag === 1) {
                    if (!matchValue_4.fields[0].IsCall) {
                        return p_5.Quantity > 0;
                    }
                    else {
                        return false;
                    }
                }
                else {
                    return false;
                }
            }, groupPositions);
            const enumerator_1 = getEnumerator(shortCalls);
            try {
                while (enumerator_1["System.Collections.IEnumerator.MoveNext"]()) {
                    const sc = enumerator_1["System.Collections.Generic.IEnumerator`1.get_Current"]();
                    let remainingShortQty = Math.abs(sc.Quantity);
                    const scStrike = getStrike(sc);
                    const scExpiry = getExpiry(sc) | 0;
                    while (remainingShortQty >= 1) {
                        const matchValue_5 = takeQty(longShares, 100);
                        if (matchValue_5 == null) {
                            const matchIndex = tryFindIndex((lc) => {
                                if (getStrike(lc) <= scStrike) {
                                    return getExpiry(lc) >= scExpiry;
                                }
                                else {
                                    return false;
                                }
                            }, longCalls);
                            if (matchIndex == null) {
                                remainingShortQty = -1;
                            }
                            else {
                                const idx = matchIndex | 0;
                                const matchValue_6 = takeQty(singleton(item_1(idx, longCalls)), 1);
                                if (matchValue_6 == null) {
                                }
                                else {
                                    const usedLong = matchValue_6[0];
                                    const newLongCalls = choose((x_1) => x_1, mapIndexed((i, p_6) => {
                                        if (i === idx) {
                                            if (Math.abs(p_6.Quantity) > 1) {
                                                return new PositionInstance(p_6.Id, p_6.GroupId, p_6.DefinitionName, p_6.ComponentName, p_6.ParentId, p_6.BuyPrice, p_6.BuyDate, p_6.Quantity - 1, p_6.Instrument);
                                            }
                                            else {
                                                return undefined;
                                            }
                                        }
                                        else {
                                            return p_6;
                                        }
                                    }, longCalls));
                                    longCalls = newLongCalls;
                                    const unitShort_1 = new PositionInstance(sc.Id, sc.GroupId, sc.DefinitionName, sc.ComponentName, sc.ParentId, sc.BuyPrice, sc.BuyDate, -1, sc.Instrument);
                                    const valShort_1 = getLiquidationValue(unitShort_1, history, day, r);
                                    const net_1 = getLiquidationValue(usedLong, history, day, r) + valShort_1;
                                    void (candidates.push(new LiquidationCandidate(1, [unitShort_1, usedLong, net_1])));
                                    remainingShortQty = (remainingShortQty - 1);
                                }
                            }
                        }
                        else {
                            const shares = matchValue_5[0];
                            const restShares = matchValue_5[1];
                            longShares = restShares;
                            const unitShort = new PositionInstance(sc.Id, sc.GroupId, sc.DefinitionName, sc.ComponentName, sc.ParentId, sc.BuyPrice, sc.BuyDate, -1, sc.Instrument);
                            const valShort = getLiquidationValue(unitShort, history, day, r);
                            const net = getLiquidationValue(shares, history, day, r) + valShort;
                            void (candidates.push(new LiquidationCandidate(1, [unitShort, shares, net])));
                            remainingShortQty = (remainingShortQty - 1);
                        }
                    }
                }
            }
            finally {
                disposeSafe(enumerator_1);
            }
            const enumerator_2 = getEnumerator(shortPuts);
            try {
                while (enumerator_2["System.Collections.IEnumerator.MoveNext"]()) {
                    const sp = enumerator_2["System.Collections.Generic.IEnumerator`1.get_Current"]();
                    let remainingShortQty_1 = Math.abs(sp.Quantity);
                    const spStrike = getStrike(sp);
                    const spExpiry = getExpiry(sp) | 0;
                    while (remainingShortQty_1 >= 1) {
                        const matchIndex_1 = tryFindIndex((lp) => {
                            if (getStrike(lp) >= spStrike) {
                                return getExpiry(lp) >= spExpiry;
                            }
                            else {
                                return false;
                            }
                        }, longPuts);
                        if (matchIndex_1 == null) {
                            remainingShortQty_1 = -1;
                        }
                        else {
                            const idx_1 = matchIndex_1 | 0;
                            const matchValue_7 = takeQty(singleton(item_1(idx_1, longPuts)), 1);
                            if (matchValue_7 == null) {
                            }
                            else {
                                const usedLong_1 = matchValue_7[0];
                                const newLongPuts = choose((x_2) => x_2, mapIndexed((i_1, p_7) => {
                                    if (i_1 === idx_1) {
                                        if (Math.abs(p_7.Quantity) > 1) {
                                            return new PositionInstance(p_7.Id, p_7.GroupId, p_7.DefinitionName, p_7.ComponentName, p_7.ParentId, p_7.BuyPrice, p_7.BuyDate, p_7.Quantity - 1, p_7.Instrument);
                                        }
                                        else {
                                            return undefined;
                                        }
                                    }
                                    else {
                                        return p_7;
                                    }
                                }, longPuts));
                                longPuts = newLongPuts;
                                const unitShort_2 = new PositionInstance(sp.Id, sp.GroupId, sp.DefinitionName, sp.ComponentName, sp.ParentId, sp.BuyPrice, sp.BuyDate, -1, sp.Instrument);
                                const valShort_2 = getLiquidationValue(unitShort_2, history, day, r);
                                const net_2 = getLiquidationValue(usedLong_1, history, day, r) + valShort_2;
                                void (candidates.push(new LiquidationCandidate(1, [unitShort_2, usedLong_1, net_2])));
                                remainingShortQty_1 = (remainingShortQty_1 - 1);
                            }
                        }
                    }
                }
            }
            finally {
                disposeSafe(enumerator_2);
            }
            const enumerator_3 = getEnumerator(append(longShares, append(longCalls, longPuts)));
            try {
                while (enumerator_3["System.Collections.IEnumerator.MoveNext"]()) {
                    const p_8 = enumerator_3["System.Collections.Generic.IEnumerator`1.get_Current"]();
                    if (p_8.Quantity > 0) {
                        const valLong_3 = getLiquidationValue(p_8, history, day, r);
                        void (candidates.push(new LiquidationCandidate(0, [p_8, valLong_3])));
                    }
                }
            }
            finally {
                disposeSafe(enumerator_3);
            }
        }
    }
    finally {
        disposeSafe(enumerator);
    }
    return toList(candidates);
}

function getTickerName(p) {
    const matchValue = p.Instrument;
    switch (matchValue.tag) {
        case 1: {
            const matchValue_1 = matchValue.fields[0].Underlying;
            if (matchValue_1.tag === 1) {
                return matchValue_1.fields[0];
            }
            else {
                return matchValue_1.fields[0];
            }
        }
        case 2:
            return "COMPOUND";
        default: {
            const assetRef = matchValue.fields[0];
            if (assetRef.tag === 1) {
                return `${assetRef.fields[1]}x_${assetRef.fields[0]}`;
            }
            else {
                return assetRef.fields[0];
            }
        }
    }
}

export function reconcileCash(portfolio, requiredCash, history, day, r, costs) {
    const deficit = requiredCash - portfolio.Cash;
    if (deficit <= 0) {
        return [new Portfolio(portfolio.Cash - requiredCash, portfolio.Positions, portfolio.CompositeRegistry), empty()];
    }
    else {
        const sortedCandidates = sortBy((c_1) => {
            if (c_1.tag === 1) {
                return [getExpiry(c_1.fields[0]), -c_1.fields[2]];
            }
            else {
                return [getExpiry(c_1.fields[0]), -c_1.fields[1]];
            }
        }, filter((c) => {
            if (c.tag === 1) {
                return c.fields[2] > 0;
            }
            else {
                return c.fields[1] > 0;
            }
        }, matchPositions(portfolio.Positions, history, day, r)), {
            Compare: compareArrays,
        });
        let currentDeficit = deficit;
        let totalProceeds = 0;
        let reductions = empty_1({
            Compare: comparePrimitives,
        });
        let transactions = empty();
        const enumerator = getEnumerator(sortedCandidates);
        try {
            while (enumerator["System.Collections.IEnumerator.MoveNext"]()) {
                const cand = enumerator["System.Collections.Generic.IEnumerator`1.get_Current"]();
                if (currentDeficit > 0) {
                    if (cand.tag === 1) {
                        const shortPos = cand.fields[0];
                        const longPos = cand.fields[1];
                        const unitNet = cand.fields[2] / Math.abs(shortPos.Quantity);
                        const unitsToClose = min(Math.abs(shortPos.Quantity), Math.ceil(currentDeficit / unitNet));
                        const commission_1 = (costs.Commission.PerOrder * 2) + ((costs.Commission.PerUnit * unitsToClose) * 2);
                        const slippageAmount_1 = (unitNet * unitsToClose) * (costs.Slippage.DefaultSpread / 2);
                        const netProceeds_1 = ((unitsToClose * unitNet) - commission_1) - slippageAmount_1;
                        currentDeficit = (currentDeficit - netProceeds_1);
                        totalProceeds = (totalProceeds + netProceeds_1);
                        reductions = FSharpMap__Add(reductions, shortPos.Id, -unitsToClose + defaultArg(FSharpMap__TryFind(reductions, shortPos.Id), 0));
                        reductions = FSharpMap__Add(reductions, longPos.Id, unitsToClose + defaultArg(FSharpMap__TryFind(reductions, longPos.Id), 0));
                        transactions = cons(new Transaction(day, `SPREAD_${getTickerName(longPos)}`, "SELL", unitsToClose, 0, netProceeds_1, commission_1, slippageAmount_1, "LIQUIDATION"), transactions);
                    }
                    else {
                        const p_1 = cand.fields[0];
                        const unitVal = cand.fields[1] / p_1.Quantity;
                        const qtyToSell = min(p_1.Quantity, Math.ceil(currentDeficit / unitVal));
                        const commission = costs.Commission.PerOrder + (costs.Commission.PerUnit * qtyToSell);
                        const slippagePct = costs.Slippage.DefaultSpread;
                        const slippageAmount = (unitVal * qtyToSell) * (slippagePct / 2);
                        const netProceeds = ((qtyToSell * unitVal) - commission) - slippageAmount;
                        currentDeficit = (currentDeficit - netProceeds);
                        totalProceeds = (totalProceeds + netProceeds);
                        reductions = FSharpMap__Add(reductions, p_1.Id, qtyToSell + defaultArg(FSharpMap__TryFind(reductions, p_1.Id), 0));
                        transactions = cons(new Transaction(day, getTickerName(p_1), "SELL", qtyToSell, unitVal * (1 - (slippagePct / 2)), netProceeds, commission, slippageAmount, "LIQUIDATION"), transactions);
                    }
                }
            }
        }
        finally {
            disposeSafe(enumerator);
        }
        if (currentDeficit > 0) {
            return [new Portfolio(0, empty(), portfolio.CompositeRegistry), empty()];
        }
        else {
            const newPositions = filter((p_3) => (Math.abs(p_3.Quantity) > 1E-09), map((p_2) => {
                const matchValue = FSharpMap__TryFind(reductions, p_2.Id);
                if (matchValue == null) {
                    return p_2;
                }
                else {
                    return new PositionInstance(p_2.Id, p_2.GroupId, p_2.DefinitionName, p_2.ComponentName, p_2.ParentId, p_2.BuyPrice, p_2.BuyDate, p_2.Quantity - matchValue, p_2.Instrument);
                }
            }, portfolio.Positions));
            return [new Portfolio(totalProceeds - deficit, newPositions, portfolio.CompositeRegistry), transactions];
        }
    }
}

