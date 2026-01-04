import { price as price_1 } from "../Simulation/PricingModels.js";
import { filter, sumBy, tryFind } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";

function getMarketPrice(instrument, history, currentDay, riskFreeRate) {
    let path;
    switch (instrument.tag) {
        case 1:
            return price_1(instrument.fields[0], history, currentDay, riskFreeRate);
        case 2:
            return 0;
        default: {
            const assetRef = instrument.fields[0];
            const ticker = (assetRef.tag === 1) ? (`${assetRef.fields[1]}x_${assetRef.fields[0]}`) : assetRef.fields[0];
            const matchValue = tryFind((p) => (p.Ticker === ticker), history);
            let matchResult, path_1;
            if (matchValue != null) {
                if ((path = matchValue, currentDay < path.DailyData.length)) {
                    matchResult = 0;
                    path_1 = matchValue;
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
                    return item(currentDay, path_1.DailyData).Price;
                default:
                    return 0;
            }
        }
    }
}

function positionMatches(p, identifier) {
    if (p.DefinitionName === identifier) {
        return true;
    }
    else {
        const matchValue = p.Instrument;
        if (matchValue.tag === 0) {
            const assetRef = matchValue.fields[0];
            if (assetRef.tag === 1) {
                return (`${assetRef.fields[0]}_${assetRef.fields[1]}x`) === identifier;
            }
            else {
                return assetRef.fields[0] === identifier;
            }
        }
        else {
            return false;
        }
    }
}

export function calculatePortfolioValue(portfolio, history, currentDay, riskFreeRate) {
    return portfolio.Cash + sumBy((p) => (getMarketPrice(p.Instrument, history, currentDay, riskFreeRate) * p.Quantity), portfolio.Positions, {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    });
}

export function calculatePositionQuantity(portfolio, identifier) {
    return sumBy((p_1) => p_1.Quantity, filter((p) => positionMatches(p, identifier), portfolio.Positions), {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    });
}

export function calculatePositionValue(portfolio, identifier, history, currentDay, riskFreeRate) {
    return sumBy((p_1) => (getMarketPrice(p_1.Instrument, history, currentDay, riskFreeRate) * p_1.Quantity), filter((p) => positionMatches(p, identifier), portfolio.Positions), {
        GetZero: () => 0,
        Add: (x, y) => (x + y),
    });
}

