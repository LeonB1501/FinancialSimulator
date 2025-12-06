import { lex, LexerError } from "../Language/Lexer.js";
import { FSharpResult$2 } from "../fable_modules/fable-library-js.4.27.0/Result.js";
import { run, ParseError } from "../Language/Parser.js";
import { calculateMaxLookback, elaborateProgram } from "../Language/Elaborator.js";
import { evaluate } from "./StrategyEvaluator.js";
import { generatePaths } from "../Simulation/PathGenerator.js";
import { SimulationConfiguration, SimulationRunResult } from "./EngineTypes.js";
import { ofList } from "../fable_modules/fable-library-js.4.27.0/Set.js";
import { map } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { setItem, fill } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { min, max } from "../fable_modules/fable-library-js.4.27.0/Double.js";

export function compileStrategy(dslCode, validTickers) {
    try {
        return elaborateProgram(run(lex(validTickers, dslCode)));
    }
    catch (matchValue) {
        return (matchValue instanceof LexerError) ? (new FSharpResult$2(1, [`Lexer Error: ${matchValue.Data0}`])) : ((matchValue instanceof ParseError) ? (new FSharpResult$2(1, [`Parser Error: ${matchValue.Data0}`])) : (new FSharpResult$2(1, [`Unknown Compilation Error: ${matchValue.message}`])));
    }
}

function runSingleIteration(program, configWithWarmup, warmupDays, initialCash, baseSeed, iterationIndex) {
    const rawResult = evaluate(iterationIndex, program, configWithWarmup, generatePaths(configWithWarmup, baseSeed + iterationIndex), initialCash);
    return new SimulationRunResult(rawResult.RunId, ((warmupDays > 0) && (rawResult.EquityCurve.length > warmupDays)) ? rawResult.EquityCurve.slice(warmupDays, rawResult.EquityCurve.length) : rawResult.EquityCurve, rawResult.FinalState, rawResult.TransactionHistory);
}

/**
 * Run simulation with progress callback support
 * The onProgress callback receives (completedIterations, totalIterations)
 */
export function runSimulationWithProgress(config, dslCode, initialCash, baseSeed, onProgress) {
    const matchValue = compileStrategy(dslCode, ofList(map((a) => a.Ticker, config.Assets), {
        Compare: comparePrimitives,
    }));
    if (matchValue.tag === 0) {
        const program = matchValue.fields[0];
        const requiredLookback = calculateMaxLookback(program) | 0;
        const warmupDays = ((requiredLookback > 0) ? (requiredLookback + 10) : 0) | 0;
        const configWithWarmup = new SimulationConfiguration(config.Assets, config.Correlations, config.TradingDays + warmupDays, config.Iterations, config.RiskFreeRate, config.Granularity, config.HistoricalData, config.StartDate, config.Scenario);
        try {
            const totalIterations = config.Iterations | 0;
            const results = fill(new Array(totalIterations), 0, totalIterations, null);
            const reportInterval = max(1, min(10, ~~(totalIterations / 100))) | 0;
            for (let i = 1; i <= totalIterations; i++) {
                setItem(results, i - 1, runSingleIteration(program, configWithWarmup, warmupDays, initialCash, baseSeed, i));
                if (((i % reportInterval) === 0) ? true : (i === totalIterations)) {
                    onProgress(i, totalIterations);
                }
            }
            return new FSharpResult$2(0, [results]);
        }
        catch (ex) {
            return new FSharpResult$2(1, [`Runtime Simulation Error: ${ex.message}`]);
        }
    }
    else {
        return new FSharpResult$2(1, [matchValue.fields[0]]);
    }
}

/**
 * Original runSimulation without progress callback (for backward compatibility)
 */
export function runSimulation(config, dslCode, initialCash, baseSeed) {
    return runSimulationWithProgress(config, dslCode, initialCash, baseSeed, (_arg, _arg_1) => {
    });
}

