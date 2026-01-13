import { length, singleton, append, empty, sumBy, isEmpty, partition } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { price } from "../Simulation/PricingModels.js";
import { SimulationRunResult, EvaluationState, Transaction, Portfolio } from "./EngineTypes.js";
import { calculatePortfolioValue } from "./PortfolioQueries.js";
import { reconcileCash } from "./Reconciler.js";
import { interpretStep, emptyState } from "./Interpreter.js";
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
        }), patternInput[1], portfolio.CompositeRegistry, portfolio.TaxLots, portfolio.TaxLiabilityYTD, portfolio.RealizedGainsYTD);
    }
}

function processCashflows(portfolio, scenario, currentDay, history, riskFreeRate, costs, taxConfig) {
    let matchValue;
    let currentPortfolio = portfolio;
    let transactions = empty();
    if ((matchValue = taxConfig.PaymentMode, (matchValue.tag === 1) ? ((currentDay > 0) && ((currentDay % matchValue.fields[0]) === 0)) : ((currentDay > 0) && ((currentDay % 252) === 0)))) {
        const totalTax = currentPortfolio.TaxLiabilityYTD + (calculatePortfolioValue(currentPortfolio, history, currentDay, riskFreeRate) * taxConfig.WealthTaxRate);
        if (totalTax > 0) {
            const patternInput = reconcileCash(currentPortfolio, totalTax, history, currentDay, riskFreeRate, costs);
            const postTaxPortfolio = patternInput[0];
            const taxTxn = new Transaction(currentDay, "TAX_PAYMENT", "TAX", 0, 0, -totalTax, 0, 0, totalTax, "PERIODIC_SETTLEMENT");
            currentPortfolio = (new Portfolio(postTaxPortfolio.Cash, postTaxPortfolio.Positions, postTaxPortfolio.CompositeRegistry, postTaxPortfolio.TaxLots, 0, postTaxPortfolio.RealizedGainsYTD));
            transactions = append(transactions, append(patternInput[1], singleton(taxTxn)));
        }
    }
    if ((currentDay > 0) && ((currentDay % 30) === 0)) {
        const year = currentDay / 365;
        const currentMonth = ~~(currentDay / 30) | 0;
        switch (scenario.tag) {
            case 1: {
                const p = scenario.fields[0];
                const amount = p.MonthlyContribution * Math.pow(1 + p.ContributionGrowthRate, Math.floor(year));
                currentPortfolio = (new Portfolio(currentPortfolio.Cash + amount, currentPortfolio.Positions, currentPortfolio.CompositeRegistry, currentPortfolio.TaxLots, currentPortfolio.TaxLiabilityYTD, currentPortfolio.RealizedGainsYTD));
                break;
            }
            case 2: {
                const p_1 = scenario.fields[0];
                const inflationFactor = Math.pow(1 + p_1.InflationRate, Math.floor(year));
                const netWithdrawal = (p_1.MonthlyWithdrawal * inflationFactor) - ((currentMonth >= p_1.PensionStartMonth) ? (p_1.MonthlyPension * inflationFactor) : 0);
                if (netWithdrawal <= 0) {
                    currentPortfolio = (new Portfolio(currentPortfolio.Cash + Math.abs(netWithdrawal), currentPortfolio.Positions, currentPortfolio.CompositeRegistry, currentPortfolio.TaxLots, currentPortfolio.TaxLiabilityYTD, currentPortfolio.RealizedGainsYTD));
                }
                else if (currentPortfolio.Cash >= netWithdrawal) {
                    currentPortfolio = (new Portfolio(currentPortfolio.Cash - netWithdrawal, currentPortfolio.Positions, currentPortfolio.CompositeRegistry, currentPortfolio.TaxLots, currentPortfolio.TaxLiabilityYTD, currentPortfolio.RealizedGainsYTD));
                }
                else {
                    const patternInput_1 = reconcileCash(currentPortfolio, netWithdrawal, history, currentDay, riskFreeRate, costs);
                    currentPortfolio = patternInput_1[0];
                    transactions = append(transactions, patternInput_1[1]);
                }
                break;
            }
            default:
                undefined;
        }
    }
    return [currentPortfolio, transactions];
}

export function evaluate(runId, program, config, history, initialCash) {
    let matchValue, TransactionHistory;
    let currentState = emptyState((matchValue = config.Scenario, (matchValue.tag === 2) ? matchValue.fields[0].InitialPortfolio : initialCash), config.RiskFreeRate);
    const equityCurve = new Float64Array(config.TradingDays + 1);
    for (let day = 0; day <= config.TradingDays; day++) {
        currentState = (new EvaluationState(day, currentState.Portfolio, currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, currentState.TransactionHistory));
        const settledPortfolio = processSettlement(currentState.Portfolio, history, day, config.RiskFreeRate);
        currentState = (new EvaluationState(currentState.CurrentDay, settledPortfolio, currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, currentState.TransactionHistory));
        const patternInput = processCashflows(currentState.Portfolio, config.Scenario, day, history, config.RiskFreeRate, config.ExecutionCosts, config.Tax);
        currentState = ((TransactionHistory = append(currentState.TransactionHistory, patternInput[1]), new EvaluationState(currentState.CurrentDay, patternInput[0], currentState.ScopeStack, currentState.GlobalScope, currentState.RiskFreeRate, TransactionHistory)));
        if (((length(currentState.Portfolio.Positions) > 0) ? true : (currentState.Portfolio.Cash > 0)) && ((day === 0) ? true : ((day % config.Granularity) === 0))) {
            currentState = interpretStep(program, currentState, history, config.ExecutionCosts, config.Tax);
        }
        const dailyValue = calculatePortfolioValue(currentState.Portfolio, history, day, config.RiskFreeRate);
        setItem(equityCurve, day, dailyValue);
    }
    return new SimulationRunResult(runId, equityCurve, currentState, currentState.TransactionHistory);
}

