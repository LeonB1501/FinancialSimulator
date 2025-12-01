import { initialize, zip, sortBy, averageBy, choose, map as map_1, sumBy, average, sort, item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { FSharpMap__get_Item, FSharpMap__ContainsKey, ofList, empty } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { SimulationReport, DistributionStats } from "./AnalyticsTypes.js";
import { ofArray, map } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { toList } from "../fable_modules/fable-library-js.4.27.0/Seq.js";
import { rangeDouble } from "../fable_modules/fable-library-js.4.27.0/Range.js";
import { addDays } from "../fable_modules/fable-library-js.4.27.0/Date.js";

function calculatePercentile(sortedData, percentile) {
    if (sortedData.length === 0) {
        return 0;
    }
    else {
        const idx = (percentile / 100) * (sortedData.length - 1);
        const lower = ~~Math.floor(idx) | 0;
        const upper = ~~Math.ceil(idx) | 0;
        if (lower === upper) {
            return item(lower, sortedData);
        }
        else {
            const weight = idx - lower;
            return (item(lower, sortedData) * (1 - weight)) + (item(upper, sortedData) * weight);
        }
    }
}

function calculateDistribution(data) {
    let sumLogs;
    if (data.length === 0) {
        return new DistributionStats(0, 0, 0, empty({
            Compare: comparePrimitives,
        }));
    }
    else {
        const sorted = sort(data, {
            Compare: comparePrimitives,
        });
        const mean = average(sorted, {
            GetZero: () => 0,
            Add: (x_3, y_2) => (x_3 + y_2),
            DivideByInt: (x_2, i) => (x_2 / i),
        });
        const median = calculatePercentile(sorted, 50);
        const positiveData = sorted.filter((x_4) => (x_4 > 0));
        return new DistributionStats(mean, median, (positiveData.length === 0) ? 0 : ((sumLogs = sumBy((d) => Math.log(d), positiveData, {
            GetZero: () => 0,
            Add: (x_5, y_3) => (x_5 + y_3),
        }), Math.exp(sumLogs / positiveData.length))), ofList(map((p) => [p, calculatePercentile(sorted, p)], toList(rangeDouble(10, 10, 90))), {
            Compare: comparePrimitives,
        }));
    }
}

export function aggregate(runs, metrics, config, startDate) {
    const count = runs.length;
    const wealthStats = calculateDistribution(map_1((m) => m.FinalWealth, metrics, Float64Array));
    const timeStats = calculateDistribution(map_1((value) => value, choose((m_1) => m_1.DaysToGoal, metrics, Int32Array), Float64Array));
    let successCount;
    const array_4 = metrics.filter((m_2) => {
        const matchValue = config.TargetDays;
        const matchValue_1 = m_2.DaysToGoal;
        let matchResult, days, limit;
        if (matchValue == null) {
            if (matchValue_1 == null) {
                matchResult = 2;
            }
            else {
                matchResult = 1;
            }
        }
        else if (matchValue_1 == null) {
            matchResult = 2;
        }
        else {
            matchResult = 0;
            days = matchValue_1;
            limit = matchValue;
        }
        switch (matchResult) {
            case 0:
                return days <= limit;
            case 1:
                return true;
            default:
                return false;
        }
    });
    successCount = array_4.length;
    let ruinCount;
    const array_6 = metrics.filter((m_3) => m_3.IsRuined);
    ruinCount = array_6.length;
    const avgMaxDD = averageBy((m_4) => m_4.Drawdown.MaxDrawdown, metrics, {
        GetZero: () => 0,
        Add: (x_1, y) => (x_1 + y),
        DivideByInt: (x, i) => (x / i),
    });
    const avgSharpe = averageBy((m_5) => m_5.SharpeRatio, metrics, {
        GetZero: () => 0,
        Add: (x_3, y_1) => (x_3 + y_1),
        DivideByInt: (x_2, i_1) => (x_2 / i_1),
    });
    const avgSortino = averageBy((m_6) => m_6.SortinoRatio, metrics, {
        GetZero: () => 0,
        Add: (x_5, y_2) => (x_5 + y_2),
        DivideByInt: (x_4, i_2) => (x_4 / i_2),
    });
    const avgVol = averageBy((m_7) => m_7.AnnualizedVolatility, metrics, {
        GetZero: () => 0,
        Add: (x_7, y_3) => (x_7 + y_3),
        DivideByInt: (x_6, i_3) => (x_6 / i_3),
    });
    const ddFrequencies = ofList(map((t) => {
        let array_12;
        return [t, ((array_12 = metrics.filter((m_8) => {
            if (FSharpMap__ContainsKey(m_8.Drawdown.DrawdownCounts, t)) {
                return FSharpMap__get_Item(m_8.Drawdown.DrawdownCounts, t) > 0;
            }
            else {
                return false;
            }
        }), array_12.length)) / count];
    }, ofArray([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1])), {
        Compare: comparePrimitives,
    });
    const sortedByWealth = sortBy((tupledArg) => tupledArg[0].FinalWealth, zip(metrics, runs), {
        Compare: comparePrimitives,
    });
    const getPathAtPercentile = (p) => item(~~((p / 100) * (count - 1)), sortedByWealth)[1].EquityCurve;
    return new SimulationReport(wealthStats, timeStats, successCount / count, ruinCount / count, avgMaxDD, avgSharpe, avgSortino, avgVol, ddFrequencies, (runs.length < 5) ? map_1((r) => r.EquityCurve, runs) : [getPathAtPercentile(10), getPathAtPercentile(25), getPathAtPercentile(50), getPathAtPercentile(75), getPathAtPercentile(90)], initialize(item(0, runs).EquityCurve.length, (i_4) => addDays(startDate, i_4)));
}

