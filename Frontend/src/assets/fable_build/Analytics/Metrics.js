import { tryFindIndex, zip, setItem, fill, item, sumBy, average, pairwise, map } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { max } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { ofArray } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { SingleRunMetrics, DrawdownStats } from "./AnalyticsTypes.js";
import { defaultArg } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { sumBy as sumBy_1 } from "../fable_modules/fable-library-js.4.27.0/List.js";

const TRADING_DAYS = 252;

function calculateCAGR(startValue, endValue, days) {
    if (((startValue <= 0) ? true : (endValue <= 0)) ? true : (days <= 0)) {
        return 0;
    }
    else {
        const years = days / TRADING_DAYS;
        return Math.pow(endValue / startValue, 1 / years) - 1;
    }
}

function calculateLogReturns(curve) {
    return map((tupledArg) => {
        const prev = tupledArg[0];
        const curr = tupledArg[1];
        if ((prev <= 0) ? true : (curr <= 0)) {
            return 0;
        }
        else {
            return Math.log(curr / prev);
        }
    }, pairwise(curve), Float64Array);
}

function calculateVolatility(returns) {
    if (returns.length < 2) {
        return 0;
    }
    else {
        const mean = average(returns, {
            GetZero: () => 0,
            Add: (x_1, y) => (x_1 + y),
            DivideByInt: (x, i) => (x / i),
        });
        const sumSq = sumBy((r) => Math.pow(r - mean, 2), returns, {
            GetZero: () => 0,
            Add: (x_2, y_1) => (x_2 + y_1),
        });
        return Math.sqrt(sumSq / (returns.length - 1)) * Math.sqrt(TRADING_DAYS);
    }
}

function calculateDownsideDeviation(returns, targetReturnDaily) {
    if (returns.length < 2) {
        return 0;
    }
    else {
        const downsideSq = sumBy((r) => {
            const diff = r - targetReturnDaily;
            if (diff < 0) {
                return Math.pow(diff, 2);
            }
            else {
                return 0;
            }
        }, returns, {
            GetZero: () => 0,
            Add: (x, y) => (x + y),
        });
        return Math.sqrt(downsideSq / (returns.length - 1)) * Math.sqrt(TRADING_DAYS);
    }
}

function calculateDrawdownStats(curve) {
    let peak = item(0, curve);
    let maxDrawdown = 0;
    const thresholds = new Float64Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
    let counts = map((_arg) => 0, thresholds, Int32Array);
    let thresholdTriggered = map((_arg_1) => false, thresholds);
    for (let idx = 0; idx <= (curve.length - 1); idx++) {
        const value = item(idx, curve);
        if (value > peak) {
            peak = value;
            fill(thresholdTriggered, 0, thresholdTriggered.length, false);
        }
        else {
            const dd = (peak - value) / peak;
            maxDrawdown = max(maxDrawdown, dd);
            for (let i = 0; i <= (thresholds.length - 1); i++) {
                if ((dd >= item(i, thresholds)) && !item(i, thresholdTriggered)) {
                    setItem(counts, i, (item(i, counts) + 1) | 0);
                    setItem(thresholdTriggered, i, true);
                }
            }
        }
    }
    const countsMap = ofArray(zip(thresholds, counts), {
        Compare: comparePrimitives,
    });
    return new DrawdownStats(maxDrawdown, countsMap);
}

export function calculateSingleRun(run, config) {
    const curve = run.EquityCurve;
    const days = (curve.length - 1) | 0;
    const startVal = item(0, curve);
    const endVal = item(days, curve);
    const cagr = calculateCAGR(startVal, endVal, days);
    const logReturns = calculateLogReturns(curve);
    const vol = calculateVolatility(logReturns);
    const excessReturn = cagr - config.RiskFreeRate;
    const sharpe = (vol > 0) ? (excessReturn / vol) : 0;
    const downsideVol = calculateDownsideDeviation(logReturns, config.RiskFreeRate / TRADING_DAYS);
    const sortino = (downsideVol > 0) ? (excessReturn / downsideVol) : 0;
    const ddStats = calculateDrawdownStats(curve);
    const target = defaultArg(config.TargetWealth, 1.7976931348623157E+308);
    const daysToGoal = tryFindIndex((v) => (v >= target), curve);
    return new SingleRunMetrics(run.RunId, endVal, cagr, vol, sharpe, sortino, ddStats, daysToGoal != null, daysToGoal, curve.some((v_1) => (v_1 <= 0)), sumBy_1((t) => t.Commission, run.TransactionHistory, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    }), sumBy_1((t_1) => t_1.Slippage, run.TransactionHistory, {
        GetZero: () => 0,
        Add: (x_1, y_1) => (x_1 + y_1),
    }));
}

