import { map } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { sumBy, item, average, map as map_1 } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { max } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { singleton, collect, delay, toArray } from "../fable_modules/fable-library-js.4.27.0/Seq.js";
import { rangeDouble } from "../fable_modules/fable-library-js.4.27.0/Range.js";

function getPriceSeries(ticker, history) {
    return map((p_1) => map_1((d) => d.Price, p_1.DailyData, Float64Array), tryFind((p) => (p.Ticker === ticker), history));
}

function calculateSMA(data, period, currentDay) {
    if (currentDay < (period - 1)) {
        return 0;
    }
    else {
        const startIdx = ((currentDay - period) + 1) | 0;
        return average(data.slice(startIdx, currentDay + 1), {
            GetZero: () => 0,
            Add: (x_1, y) => (x_1 + y),
            DivideByInt: (x, i) => (x / i),
        });
    }
}

function calculateEMA(data, period, currentDay) {
    if (currentDay < (period - 1)) {
        return 0;
    }
    else {
        const startIdx = max(0, currentDay - (period * 3)) | 0;
        let ema = item(startIdx, data);
        const k = 2 / (period + 1);
        for (let i = startIdx + 1; i <= currentDay; i++) {
            ema = ((item(i, data) * k) + (ema * (1 - k)));
        }
        return ema;
    }
}

function calculateRSI(data, period, currentDay) {
    if (currentDay < period) {
        return 0;
    }
    else {
        const startIdx = max(1, currentDay - (period * 3)) | 0;
        let avgGain = 0;
        let avgLoss = 0;
        for (let i = startIdx; i <= ((startIdx + period) - 1); i++) {
            const change = item(i, data) - item(i - 1, data);
            if (change > 0) {
                avgGain = (avgGain + change);
            }
            else {
                avgLoss = (avgLoss + Math.abs(change));
            }
        }
        avgGain = (avgGain / period);
        avgLoss = (avgLoss / period);
        for (let i_1 = startIdx + period; i_1 <= currentDay; i_1++) {
            const change_1 = item(i_1, data) - item(i_1 - 1, data);
            const gain = (change_1 > 0) ? change_1 : 0;
            const loss = (change_1 < 0) ? Math.abs(change_1) : 0;
            avgGain = (((avgGain * (period - 1)) + gain) / period);
            avgLoss = (((avgLoss * (period - 1)) + loss) / period);
        }
        if (avgLoss === 0) {
            return 100;
        }
        else {
            return 100 - (100 / (1 + (avgGain / avgLoss)));
        }
    }
}

function calculateVol(data, period, currentDay) {
    if (currentDay < period) {
        return 0;
    }
    else {
        const startIdx = ((currentDay - period) + 1) | 0;
        const returns = toArray(delay(() => collect((i) => ((item(i - 1, data) !== 0) ? singleton(Math.log(item(i, data) / item(i - 1, data))) : singleton(0)), rangeDouble(startIdx, 1, currentDay))));
        const mean = average(returns, {
            GetZero: () => 0,
            Add: (x_1, y) => (x_1 + y),
            DivideByInt: (x, i_1) => (x / i_1),
        });
        const sumSqDiff = sumBy((r) => Math.pow(r - mean, 2), returns, {
            GetZero: () => 0,
            Add: (x_2, y_1) => (x_2 + y_1),
        });
        return Math.sqrt(sumSqDiff / (period - 1)) * Math.sqrt(252);
    }
}

function calculateReturn(data, period, currentDay) {
    if (currentDay < period) {
        return 0;
    }
    else {
        const currentPrice = item(currentDay, data);
        const pastPrice = item(currentDay - period, data);
        if (pastPrice === 0) {
            return 0;
        }
        else {
            return (currentPrice - pastPrice) / pastPrice;
        }
    }
}

function calculatePastPrice(data, period, currentDay) {
    if (currentDay < period) {
        return 0;
    }
    else {
        return item(currentDay - period, data);
    }
}

export function calculate(indicator, history, currentDay) {
    const prices = getPriceSeries(indicator.Asset, history);
    if (prices != null) {
        const data = prices;
        let p;
        const matchValue = indicator.Period;
        if (matchValue == null) {
            const matchValue_1 = indicator.IndicatorType;
            switch (matchValue_1.tag) {
                case 2: {
                    p = 14;
                    break;
                }
                case 4:
                case 5: {
                    p = 1;
                    break;
                }
                default:
                    p = 20;
            }
        }
        else {
            p = matchValue;
        }
        const matchValue_2 = indicator.IndicatorType;
        switch (matchValue_2.tag) {
            case 1:
                return calculateEMA(data, p, currentDay);
            case 2:
                return calculateRSI(data, p, currentDay);
            case 3:
                return calculateVol(data, p, currentDay);
            case 4:
                return calculateReturn(data, p, currentDay);
            case 5:
                return calculatePastPrice(data, p, currentDay);
            default:
                return calculateSMA(data, p, currentDay);
        }
    }
    else {
        return 0;
    }
}

