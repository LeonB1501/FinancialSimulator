import { length, sumBy, isEmpty, partition } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { price } from "../Simulation/PricingModels.js";
import { SimulationRunResult, EvaluationState, Portfolio } from "./EngineTypes.js";
import { reconcileCash } from "./Reconciler.js";
import { interpretStep, emptyState } from "./Interpreter.js";
import { calculatePortfolioValue } from "./PortfolioQueries.js";
import { setItem } from "../fable_modules/fable-library-js.4.27.0/Array.js";

function processSettlement(portfolio, history, currentDay, riskFreeRate) {
    const patternInput = partition((p) => {
        const matchValue = p.Instrument;
        if (matchValue.tag === 1) {
            return matchValue.fields[0].ExpiryDay <= currentDay;
        }
        else {
            return false;
        }
    }, portfolio.Positions);
    const expired = patternInput[0];
    if (isEmpty(expired)) {
        return portfolio;
    }
    else {
        return new Portfolio(portfolio.Cash + sumBy((p_1) => {
            const matchValue_1 = p_1.Instrument;
            if (matchValue_1.tag === 1) {
                return (price(matchValue_1.fields[0], history, currentDay, riskFreeRate) * p_1.Quantity) * 100;
            }
            else {
                return 0;
            }
        }, expired, {
            GetZero: () => 0,
            Add: (x, y) => (x + y),
        }), patternInput[1], portfolio.CompositeRegistry);
    }
}

function processCashflows(portfolio, scenario, currentDay, history, riskFreeRate) {
    if ((currentDay > 0) && ((currentDay % 30) === 0)) {
        const year = currentDay / 365;
        const currentMonth = ~~(currentDay / 30) | 0;
        switch (scenario.tag) {
            case 1: {
                const p = scenario.fields[0];
                return new Portfolio(portfolio.Cash + (p.MonthlyContribution * Math.pow(1 + p.ContributionGrowthRate, Math.floor(year))), portfolio.Positions, portfolio.CompositeRegistry);
            }
            case 2: {
                const p_1 = scenario.fields[0];
                const inflationFactor = Math.pow(1 + p_1.InflationRate, Math.floor(year));
                const netWithdrawal = (p_1.MonthlyWithdrawal * inflationFactor) - ((currentMonth >= p_1.PensionStartMonth) ? (p_1.MonthlyPension * inflationFactor) : 0);
                if (netWithdrawal <= 0) {
                    return new Portfolio(portfolio.Cash + Math.abs(netWithdrawal), portfolio.Positions, portfolio.CompositeRegistry);
                }
                else if (portfolio.Cash >= netWithdrawal) {
                    return new Portfolio(portfolio.Cash - netWithdrawal, portfolio.Positions, portfolio.CompositeRegistry);
                }
                else {
                    return reconcileCash(portfolio, netWithdrawal, history, currentDay, riskFreeRate);
                }
            }
            default:
                return portfolio;
        }
    }
    else {
        return portfolio;
    }
}

export function evaluate(runId, program, config, history, initialCash) {
    let matchValue;
    let currentState = emptyState((matchValue = config.Scenario, (matchValue.tag === 2) ? matchValue.fields[0].InitialPortfolio : initialCash), config.RiskFreeRate);
    const equityCurve = new Float64Array(config.TradingDays + 1);
    for (let day = 0; day <= config.TradingDays; day++) {
        currentState = (new EvaluationState(day, currentState.Portfolio, currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, currentState.TransactionHistory));
        const settledPortfolio = processSettlement(currentState.Portfolio, history, day, config.RiskFreeRate);
        currentState = (new EvaluationState(currentState.CurrentDay, settledPortfolio, currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, currentState.TransactionHistory));
        const cashflowPortfolio = processCashflows(currentState.Portfolio, config.Scenario, day, history, config.RiskFreeRate);
        currentState = (new EvaluationState(currentState.CurrentDay, cashflowPortfolio, currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, currentState.TransactionHistory));
        if (((length(currentState.Portfolio.Positions) > 0) ? true : (currentState.Portfolio.Cash > 0)) && ((day === 0) ? true : ((day % config.Granularity) === 0))) {
            currentState = interpretStep(program, currentState, history);
        }
        const dailyValue = calculatePortfolioValue(currentState.Portfolio, history, day, config.RiskFreeRate);
        setItem(equityCurve, day, dailyValue);
    }
    return new SimulationRunResult(runId, equityCurve, currentState, currentState.TransactionHistory);
}

