import { lex, LexerError } from "../Language/Lexer.js";
import { FSharpResult$2 } from "../fable_modules/fable-library-js.4.27.0/Result.js";
import { run, ParseError } from "../Language/Parser.js";
import { calculateMaxLookback, elaborateProgram } from "../Language/Elaborator.js";
import { ofList } from "../fable_modules/fable-library-js.4.27.0/Set.js";
import { map } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { SimulationRunResult, SimulationConfiguration } from "./EngineTypes.js";
import { map as map_1 } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { evaluate } from "./StrategyEvaluator.js";
import { generatePaths } from "../Simulation/PathGenerator.js";
import { toArray } from "../fable_modules/fable-library-js.4.27.0/Seq.js";
import { rangeDouble } from "../fable_modules/fable-library-js.4.27.0/Range.js";

export function compileStrategy(dslCode, validTickers) {
    try {
        return elaborateProgram(run(lex(validTickers, dslCode)));
    }
    catch (matchValue) {
        return (matchValue instanceof LexerError) ? (new FSharpResult$2(1, [`Lexer Error: ${matchValue.Data0}`])) : ((matchValue instanceof ParseError) ? (new FSharpResult$2(1, [`Parser Error: ${matchValue.Data0}`])) : (new FSharpResult$2(1, [`Unknown Compilation Error: ${matchValue.message}`])));
    }
}

export function runSimulation(config, dslCode, initialCash, baseSeed) {
    const matchValue = compileStrategy(dslCode, ofList(map((a) => a.Ticker, config.Assets), {
        Compare: comparePrimitives,
    }));
    if (matchValue.tag === 0) {
        const program = matchValue.fields[0];
        const requiredLookback = calculateMaxLookback(program) | 0;
        const warmupDays = ((requiredLookback > 0) ? (requiredLookback + 10) : 0) | 0;
        const configWithWarmup = new SimulationConfiguration(config.Assets, config.Correlations, config.TradingDays + warmupDays, config.Iterations, config.RiskFreeRate, config.Granularity, config.HistoricalData, config.StartDate, config.Scenario);
        try {
            return new FSharpResult$2(0, [map_1((i) => {
                const rawResult = evaluate(i, program, configWithWarmup, generatePaths(configWithWarmup, baseSeed + i), initialCash);
                return new SimulationRunResult(rawResult.RunId, ((warmupDays > 0) && (rawResult.EquityCurve.length > warmupDays)) ? rawResult.EquityCurve.slice(warmupDays, rawResult.EquityCurve.length) : rawResult.EquityCurve, rawResult.FinalState);
            }, toArray(rangeDouble(1, 1, config.Iterations)))]);
        }
        catch (ex) {
            return new FSharpResult$2(1, [`Runtime Simulation Error: ${ex.message}`]);
        }
    }
    else {
        return new FSharpResult$2(1, [matchValue.fields[0]]);
    }
}

