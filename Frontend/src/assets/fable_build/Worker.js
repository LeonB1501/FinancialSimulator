import { Record } from "./fable_modules/fable-library-js.4.27.0/Types.js";
import { SimulationRunResult_$reflection, SimulationConfiguration_$reflection } from "./Engine/EngineTypes.js";
import { list_type, array_type, option_type, bool_type, record_type, int32_type, float64_type, string_type } from "./fable_modules/fable-library-js.4.27.0/Reflection.js";
import { SimulationReport_$reflection, AnalysisConfiguration_$reflection } from "./Analytics/AnalyticsTypes.js";
import { Auto_generateBoxedDecoder_Z6670B51, fromString } from "./fable_modules/Thoth.Json.10.2.0/Decode.fs.js";
import { comparePrimitives, uncurry2 } from "./fable_modules/fable-library-js.4.27.0/Util.js";
import { compileStrategy, runSimulation } from "./Engine/SimulationEngine.js";
import { Auto_generateBoxedEncoder_437914C6, toString } from "./fable_modules/Thoth.Json.10.2.0/Encode.fs.js";
import { aggregate } from "./Analytics/Aggregator.js";
import { map } from "./fable_modules/fable-library-js.4.27.0/Array.js";
import { calculateSingleRun } from "./Analytics/Metrics.js";
import { ofList } from "./fable_modules/fable-library-js.4.27.0/Set.js";
import { empty, singleton } from "./fable_modules/fable-library-js.4.27.0/List.js";

export class SimulationRequest extends Record {
    constructor(Config, DslCode, InitialCash, BaseSeed, Analysis) {
        super();
        this.Config = Config;
        this.DslCode = DslCode;
        this.InitialCash = InitialCash;
        this.BaseSeed = (BaseSeed | 0);
        this.Analysis = Analysis;
    }
}

export function SimulationRequest_$reflection() {
    return record_type("Worker.SimulationRequest", [], SimulationRequest, () => [["Config", SimulationConfiguration_$reflection()], ["DslCode", string_type], ["InitialCash", float64_type], ["BaseSeed", int32_type], ["Analysis", AnalysisConfiguration_$reflection()]]);
}

export class SimulationResponse extends Record {
    constructor(Success, Error$, Report, RawResults) {
        super();
        this.Success = Success;
        this.Error = Error$;
        this.Report = Report;
        this.RawResults = RawResults;
    }
}

export function SimulationResponse_$reflection() {
    return record_type("Worker.SimulationResponse", [], SimulationResponse, () => [["Success", bool_type], ["Error", option_type(string_type)], ["Report", option_type(SimulationReport_$reflection())], ["RawResults", option_type(array_type(SimulationRunResult_$reflection()))]]);
}

export class ValidationRequest extends Record {
    constructor(DslCode, ValidTickers) {
        super();
        this.DslCode = DslCode;
        this.ValidTickers = ValidTickers;
    }
}

export function ValidationRequest_$reflection() {
    return record_type("Worker.ValidationRequest", [], ValidationRequest, () => [["DslCode", string_type], ["ValidTickers", list_type(string_type)]]);
}

export class ValidationError extends Record {
    constructor(Line, Column, Message) {
        super();
        this.Line = (Line | 0);
        this.Column = (Column | 0);
        this.Message = Message;
    }
}

export function ValidationError_$reflection() {
    return record_type("Worker.ValidationError", [], ValidationError, () => [["Line", int32_type], ["Column", int32_type], ["Message", string_type]]);
}

export class ValidationResponse extends Record {
    constructor(IsValid, Errors) {
        super();
        this.IsValid = IsValid;
        this.Errors = Errors;
    }
}

export function ValidationResponse_$reflection() {
    return record_type("Worker.ValidationResponse", [], ValidationResponse, () => [["IsValid", bool_type], ["Errors", list_type(ValidationError_$reflection())]]);
}

export function runSimulationWrapper(jsonInput) {
    const matchValue = fromString(uncurry2(Auto_generateBoxedDecoder_Z6670B51(SimulationRequest_$reflection(), undefined, undefined)), jsonInput);
    if (matchValue.tag === 0) {
        const req = matchValue.fields[0];
        const matchValue_1 = runSimulation(req.Config, req.DslCode, req.InitialCash, req.BaseSeed);
        if (matchValue_1.tag === 1) {
            const response_2 = new SimulationResponse(false, matchValue_1.fields[0], undefined, undefined);
            return toString(0, Auto_generateBoxedEncoder_437914C6(SimulationResponse_$reflection(), undefined, undefined, undefined)(response_2));
        }
        else {
            const results = matchValue_1.fields[0];
            const response_1 = new SimulationResponse(true, undefined, aggregate(results, map((r) => calculateSingleRun(r, req.Analysis), results), req.Analysis, req.Config.StartDate), results);
            return toString(0, Auto_generateBoxedEncoder_437914C6(SimulationResponse_$reflection(), undefined, undefined, undefined)(response_1));
        }
    }
    else {
        const response = new SimulationResponse(false, `JSON Parse Error: ${matchValue.fields[0]}`, undefined, undefined);
        return toString(0, Auto_generateBoxedEncoder_437914C6(SimulationResponse_$reflection(), undefined, undefined, undefined)(response));
    }
}

export function validateStrategyWrapper(jsonInput) {
    const matchValue = fromString(uncurry2(Auto_generateBoxedDecoder_Z6670B51(ValidationRequest_$reflection(), undefined, undefined)), jsonInput);
    if (matchValue.tag === 0) {
        const req = matchValue.fields[0];
        const matchValue_1 = compileStrategy(req.DslCode, ofList(req.ValidTickers, {
            Compare: comparePrimitives,
        }));
        if (matchValue_1.tag === 1) {
            const response_2 = new ValidationResponse(false, singleton(new ValidationError(1, 1, matchValue_1.fields[0])));
            return toString(0, Auto_generateBoxedEncoder_437914C6(ValidationResponse_$reflection(), undefined, undefined, undefined)(response_2));
        }
        else {
            const response_1 = new ValidationResponse(true, empty());
            return toString(0, Auto_generateBoxedEncoder_437914C6(ValidationResponse_$reflection(), undefined, undefined, undefined)(response_1));
        }
    }
    else {
        const response = new ValidationResponse(false, singleton(new ValidationError(1, 1, `JSON Parse Error: ${matchValue.fields[0]}`)));
        return toString(0, Auto_generateBoxedEncoder_437914C6(ValidationResponse_$reflection(), undefined, undefined, undefined)(response));
    }
}

