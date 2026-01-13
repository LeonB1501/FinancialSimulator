import { Union, Record } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { union_type, anonRecord_type, list_type, class_type, int32_type, record_type, float64_type, string_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { PrimitiveTrade, SellParams, RebalanceAnalysis, ResolvedInstrument, PositionInstance, Portfolio, PositionInstance_$reflection } from "./EngineTypes.js";
import { singleton as singleton_1, collect, forAll, sortByDescending, fold, empty, head, tail, isEmpty, cons, sumBy, append, filter, min, map, sortBy, ofArray } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { disposeSafe, getEnumerator, equals, stringHash, comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { List_groupBy } from "../fable_modules/fable-library-js.4.27.0/Seq2.js";
import { defaultArg, value } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { FSharpSet__Contains, singleton, ofList } from "../fable_modules/fable-library-js.4.27.0/Set.js";
import { calculateOptionPrice } from "../Simulation/PricingModels.js";
import { FSharpMap__get_Item } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { max } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { newGuid } from "../fable_modules/fable-library-js.4.27.0/Guid.js";
import { FSharpResult$2 } from "../fable_modules/fable-library-js.4.27.0/Result.js";

export class Scenario extends Record {
    constructor(Name, PriceMultiplier, VolMultiplier) {
        super();
        this.Name = Name;
        this.PriceMultiplier = PriceMultiplier;
        this.VolMultiplier = VolMultiplier;
    }
}

export function Scenario_$reflection() {
    return record_type("RiskManager.Scenario", [], Scenario, () => [["Name", string_type], ["PriceMultiplier", float64_type], ["VolMultiplier", float64_type]]);
}

export class SellableUnit extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["SingleUnit", "CompositeUnit"];
    }
}

export function SellableUnit_$reflection() {
    return union_type("RiskManager.SellableUnit", [], SellableUnit, () => [[["Item", PositionInstance_$reflection()]], [["Item", anonRecord_type(["BuyDate", int32_type], ["GroupId", class_type("System.Guid")], ["Positions", list_type(PositionInstance_$reflection())])]]]);
}

const stressScenarios = ofArray([new Scenario("Flat", 1, 1), new Scenario("Crash -20%", 0.8, 1.3), new Scenario("Crash -50%", 0.5, 2), new Scenario("Crash -99%", 0.01, 1), new Scenario("Moon +20%", 1.2, 0.9), new Scenario("Moon +100%", 2, 1.5)]);

function getSellableUnits(portfolio) {
    const grouped = sortBy((c) => {
        if (c.tag === 1) {
            return c.fields[0].BuyDate | 0;
        }
        else {
            return 0;
        }
    }, map((tupledArg) => {
        const posList = tupledArg[1];
        return new SellableUnit(1, [{
            BuyDate: min(map((p_2) => p_2.BuyDate, posList), {
                Compare: comparePrimitives,
            }),
            GroupId: tupledArg[0],
            Positions: posList,
        }]);
    }, List_groupBy((p_1) => value(p_1.GroupId), filter((p) => (p.GroupId != null), portfolio.Positions), {
        Equals: (x, y) => (x === y),
        GetHashCode: stringHash,
    })), {
        Compare: comparePrimitives,
    });
    return append(map((Item) => (new SellableUnit(0, [Item])), sortBy((p_4) => p_4.BuyDate, filter((p_3) => (p_3.GroupId == null), portfolio.Positions), {
        Compare: comparePrimitives,
    })), grouped);
}

function removeUnit(portfolio, unit) {
    const idsToRemove = (unit.tag === 1) ? ofList(map((p_1) => p_1.Id, unit.fields[0].Positions), {
        Compare: comparePrimitives,
    }) : singleton(unit.fields[0].Id, {
        Compare: comparePrimitives,
    });
    return new Portfolio(portfolio.Cash, filter((p_2) => !FSharpSet__Contains(idsToRemove, p_2.Id), portfolio.Positions), portfolio.CompositeRegistry, portfolio.TaxLots, portfolio.TaxLiabilityYTD, portfolio.RealizedGainsYTD);
}

function getUnderlyingTicker(instrument) {
    switch (instrument.tag) {
        case 1: {
            const matchValue = instrument.fields[0].Underlying;
            if (matchValue.tag === 1) {
                return matchValue.fields[0];
            }
            else {
                return matchValue.fields[0];
            }
        }
        case 2:
            return "COMPOUND";
        default: {
            const assetRef = instrument.fields[0];
            if (assetRef.tag === 1) {
                return assetRef.fields[0];
            }
            else {
                return assetRef.fields[0];
            }
        }
    }
}

function calculatePositionValue(position, scenario, marketData, currentDay, riskFreeRate) {
    let matchValue_1;
    const matchValue = position.Instrument;
    switch (matchValue.tag) {
        case 1: {
            const opt = matchValue.fields[0];
            return (calculateOptionPrice(opt, FSharpMap__get_Item(marketData, (matchValue_1 = opt.Underlying, (matchValue_1.tag === 1) ? matchValue_1.fields[0] : matchValue_1.fields[0])).Price * scenario.PriceMultiplier, scenario.VolMultiplier, opt.ExpiryDay - currentDay, riskFreeRate) * position.Quantity) * 100;
        }
        case 2:
            return 0;
        default: {
            const assetRef = matchValue.fields[0];
            const basePrice = FSharpMap__get_Item(marketData, (assetRef.tag === 1) ? assetRef.fields[0] : assetRef.fields[0]).Price;
            return ((assetRef.tag === 1) ? max(0, basePrice * (1 + ((scenario.PriceMultiplier - 1) * assetRef.fields[1]))) : (basePrice * scenario.PriceMultiplier)) * position.Quantity;
        }
    }
}

function calculateBuyingPower(portfolio, marketData, currentDay, riskFreeRate) {
    const currentScenario = new Scenario("Current", 1, 1);
    return (portfolio.Cash + sumBy((p) => calculatePositionValue(p, currentScenario, marketData, currentDay, riskFreeRate), portfolio.Positions, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    })) - sumBy((tupledArg) => {
        const positions = tupledArg[1];
        if (tupledArg[0] === "COMPOUND") {
            return 0;
        }
        else {
            const currentVal = sumBy((p_2) => calculatePositionValue(p_2, currentScenario, marketData, currentDay, riskFreeRate), positions, {
                GetZero: () => 0,
                Add: (x_2, y_2) => (x_2 + y_2),
            });
            const worstCasePnL = min(map((scenario) => (sumBy((p_3) => calculatePositionValue(p_3, scenario, marketData, currentDay, riskFreeRate), positions, {
                GetZero: () => 0,
                Add: (x_3, y_3) => (x_3 + y_3),
            }) - currentVal), stressScenarios), {
                Compare: comparePrimitives,
            });
            if (worstCasePnL < 0) {
                return Math.abs(worstCasePnL);
            }
            else {
                return 0;
            }
        }
    }, List_groupBy((p_1) => getUnderlyingTicker(p_1.Instrument), portfolio.Positions, {
        Equals: (x_1, y_1) => (x_1 === y_1),
        GetHashCode: stringHash,
    }), {
        GetZero: () => 0,
        Add: (x_5, y_5) => (x_5 + y_5),
    });
}

function simulateTrade(portfolio, trade, marketData, currentDay, riskFreeRate) {
    const currentScenario = new Scenario("Current", 1, 1);
    switch (trade.tag) {
        case 0: {
            const p = trade.fields[0];
            const cost = calculatePositionValue(new PositionInstance("00000000-0000-0000-0000-000000000000", undefined, "", undefined, undefined, 0, 0, p.Quantity, p.Instrument), currentScenario, marketData, currentDay, riskFreeRate);
            return new Portfolio(portfolio.Cash - cost, cons(new PositionInstance(newGuid(), undefined, defaultArg(p.DefinitionName, ""), p.ComponentName, undefined, cost / p.Quantity, currentDay, p.Quantity, p.Instrument), portfolio.Positions), portfolio.CompositeRegistry, portfolio.TaxLots, portfolio.TaxLiabilityYTD, portfolio.RealizedGainsYTD);
        }
        case 1: {
            const p_1 = trade.fields[0];
            const proceeds = calculatePositionValue(new PositionInstance("00000000-0000-0000-0000-000000000000", undefined, "", undefined, undefined, 0, 0, p_1.Quantity, p_1.Instrument), currentScenario, marketData, currentDay, riskFreeRate);
            const reducePositions = (remainingToSell_mut, positions_mut, acc_mut) => {
                reducePositions:
                while (true) {
                    const remainingToSell = remainingToSell_mut, positions = positions_mut, acc = acc_mut;
                    if (remainingToSell <= 0) {
                        return append(acc, positions);
                    }
                    else if (!isEmpty(positions)) {
                        const rest = tail(positions);
                        const pos = head(positions);
                        if (equals(pos.Instrument, p_1.Instrument)) {
                            if (pos.Quantity > remainingToSell) {
                                return append(acc, cons(new PositionInstance(pos.Id, pos.GroupId, pos.DefinitionName, pos.ComponentName, pos.ParentId, pos.BuyPrice, pos.BuyDate, pos.Quantity - remainingToSell, pos.Instrument), rest));
                            }
                            else {
                                remainingToSell_mut = (remainingToSell - pos.Quantity);
                                positions_mut = rest;
                                acc_mut = acc;
                                continue reducePositions;
                            }
                        }
                        else {
                            remainingToSell_mut = remainingToSell;
                            positions_mut = rest;
                            acc_mut = cons(pos, acc);
                            continue reducePositions;
                        }
                    }
                    else {
                        return cons(new PositionInstance(newGuid(), undefined, "SHORT", undefined, undefined, proceeds / p_1.Quantity, currentDay, -remainingToSell, p_1.Instrument), acc);
                    }
                    break;
                }
            };
            return new Portfolio(portfolio.Cash + proceeds, reducePositions(p_1.Quantity, sortBy((p_2) => p_2.BuyDate, portfolio.Positions, {
                Compare: comparePrimitives,
            }), empty()), portfolio.CompositeRegistry, portfolio.TaxLots, portfolio.TaxLiabilityYTD, portfolio.RealizedGainsYTD);
        }
        default:
            return portfolio;
    }
}

export function validateTrades(trades, portfolio, marketData, currentDay, riskFreeRate) {
    const bp = calculateBuyingPower(fold((port, trade) => simulateTrade(port, trade, marketData, currentDay, riskFreeRate), portfolio, trades), marketData, currentDay, riskFreeRate);
    if (bp >= 0) {
        return new FSharpResult$2(0, [undefined]);
    }
    else {
        return new FSharpResult$2(1, [`Insufficient Buying Power. Post-trade BP would be $%P(F2)`]);
    }
}

export function calculateMaxQuantity(tradesForOneUnit, portfolio, marketData, currentDay, riskFreeRate) {
    const currentBP = calculateBuyingPower(portfolio, marketData, currentDay, riskFreeRate);
    const costPerUnit = currentBP - calculateBuyingPower(fold((port, trade) => simulateTrade(port, trade, marketData, currentDay, riskFreeRate), portfolio, tradesForOneUnit), marketData, currentDay, riskFreeRate);
    if (costPerUnit <= 0) {
        return 10000;
    }
    else {
        return ~~Math.floor(currentBP / costPerUnit) | 0;
    }
}

export function analyzeAndPlanRebalance(target, targetPercentage, portfolio, marketData, currentDay, riskFreeRate) {
    const currentScenario = new Scenario("Current", 1, 1);
    const targetValue = (portfolio.Cash + sumBy((p) => calculatePositionValue(p, currentScenario, marketData, currentDay, riskFreeRate), portfolio.Positions, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    })) * (targetPercentage / 100);
    let patternInput;
    if (target.tag === 1) {
        throw new Error("Identifier targets not supported for rebalancing logic yet");
    }
    else {
        const assetRef = target.fields[0];
        patternInput = [FSharpMap__get_Item(marketData, (assetRef.tag === 1) ? assetRef.fields[0] : assetRef.fields[0]).Price, new ResolvedInstrument(0, [assetRef])];
    }
    const targetPrice = patternInput[0];
    const targetQty = (targetPrice === 0) ? 0 : (targetValue / targetPrice);
    const cost = targetQty * targetPrice;
    const targetPositionInstance = new PositionInstance(newGuid(), undefined, "REBALANCE_TARGET", undefined, undefined, targetPrice, currentDay, targetQty, patternInput[1]);
    const goalPortfolio = new Portfolio(portfolio.Cash - cost, cons(targetPositionInstance, portfolio.Positions), portfolio.CompositeRegistry, portfolio.TaxLots, portfolio.TaxLiabilityYTD, portfolio.RealizedGainsYTD);
    const startBP = calculateBuyingPower(goalPortfolio, marketData, currentDay, riskFreeRate);
    if (startBP >= 0) {
        return new RebalanceAnalysis(true, empty(), "Sufficient Capital");
    }
    else {
        let currentBP = startBP;
        let unitsToSell = empty();
        let solved = false;
        const enumerator = getEnumerator(sortByDescending((x_3) => x_3.Impact, filter((x_2) => (x_2.Impact > 0), map((unit_1) => {
            const testPortfolio = removeUnit(goalPortfolio, unit_1);
            return {
                Impact: calculateBuyingPower(new Portfolio(testPortfolio.Cash + ((unit_1.tag === 1) ? sumBy((p_4) => calculatePositionValue(p_4, currentScenario, marketData, currentDay, riskFreeRate), unit_1.fields[0].Positions, {
                    GetZero: () => 0,
                    Add: (x_1, y_1) => (x_1 + y_1),
                }) : calculatePositionValue(unit_1.fields[0], currentScenario, marketData, currentDay, riskFreeRate)), testPortfolio.Positions, testPortfolio.CompositeRegistry, testPortfolio.TaxLots, testPortfolio.TaxLiabilityYTD, testPortfolio.RealizedGainsYTD), marketData, currentDay, riskFreeRate) - startBP,
                Unit: unit_1,
            };
        }, filter((unit) => {
            if (unit.tag === 1) {
                return forAll((p_2) => (p_2.Id !== targetPositionInstance.Id), unit.fields[0].Positions);
            }
            else {
                return unit.fields[0].Id !== targetPositionInstance.Id;
            }
        }, getSellableUnits(goalPortfolio)))), {
            Compare: comparePrimitives,
        }));
        try {
            while (enumerator["System.Collections.IEnumerator.MoveNext"]()) {
                const candidate = enumerator["System.Collections.Generic.IEnumerator`1.get_Current"]();
                if (!solved) {
                    unitsToSell = cons(candidate.Unit, unitsToSell);
                    currentBP = (currentBP + candidate.Impact);
                    if (currentBP >= 0) {
                        solved = true;
                    }
                }
            }
        }
        finally {
            disposeSafe(enumerator);
        }
        if (solved) {
            return new RebalanceAnalysis(true, collect((unit_2) => {
                if (unit_2.tag === 1) {
                    return map((p_6) => (new PrimitiveTrade(1, [new SellParams(p_6.Instrument, p_6.Quantity, p_6.ComponentName, p_6.DefinitionName)])), unit_2.fields[0].Positions);
                }
                else {
                    const p_5 = unit_2.fields[0];
                    return singleton_1(new PrimitiveTrade(1, [new SellParams(p_5.Instrument, p_5.Quantity, p_5.ComponentName, p_5.DefinitionName)]));
                }
            }, unitsToSell), "Rebalance Plan Generated");
        }
        else {
            return new RebalanceAnalysis(false, empty(), "Cannot raise sufficient Buying Power");
        }
    }
}

