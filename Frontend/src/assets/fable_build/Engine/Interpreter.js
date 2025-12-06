import { FSharpException } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { class_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { singleton, append, filter, fold, map, updateAt, tryFindIndex, head, tryFind, tail, isEmpty, cons, empty } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { ofList, FSharpMap__Add, FSharpMap__ContainsKey, FSharpMap__TryFind, empty as empty_1 } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { equals, comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { ConcreteOption, SellParams, BuyParams, PrimitiveTrade, RebalanceParams, ResolvedInstrument, Value, MarketDataPoint, EvaluationState, Portfolio } from "./EngineTypes.js";
import { some } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { findStrikeForDelta, rho, vega, theta, gamma, delta, price as price_1 } from "../Simulation/PricingModels.js";
import { calculate } from "../Simulation/Indicators.js";
import { calculatePositionValue, calculatePositionQuantity, calculatePortfolioValue } from "./PortfolioQueries.js";
import { BoolLiteral } from "../Language/AST.js";
import { calculateMaxQuantity, validateTrades } from "./RiskManager.js";
import { executeTrades } from "./TradeExecutor.js";

export class InterpreterError extends FSharpException {
    constructor(Data0) {
        super();
        this.Data0 = Data0;
    }
}

export function InterpreterError_$reflection() {
    return class_type("Interpreter.InterpreterError", undefined, InterpreterError, class_type("System.Exception"));
}

export function emptyState(initialCash, riskFreeRate) {
    return new EvaluationState(0, new Portfolio(initialCash, empty(), empty_1({
        Compare: comparePrimitives,
    })), empty(), empty_1({
        Compare: comparePrimitives,
    }), riskFreeRate, empty());
}

export function pushScope(state) {
    return new EvaluationState(state.CurrentDay, state.Portfolio, cons(empty(), state.ScopeStack), state.GlobalScope, state.RiskFreeRate, state.TransactionHistory);
}

export function popScope(state) {
    const matchValue = state.ScopeStack;
    if (isEmpty(matchValue)) {
        throw new Error("FATAL: Pop from empty scope stack");
    }
    else {
        return new EvaluationState(state.CurrentDay, state.Portfolio, tail(matchValue), state.GlobalScope, state.RiskFreeRate, state.TransactionHistory);
    }
}

export function lookup(id, state) {
    const searchLocal = (scopes_mut) => {
        searchLocal:
        while (true) {
            const scopes = scopes_mut;
            if (!isEmpty(scopes)) {
                const matchValue = tryFind((tupledArg) => (tupledArg[0] === id), head(scopes));
                if (matchValue == null) {
                    scopes_mut = tail(scopes);
                    continue searchLocal;
                }
                else {
                    return some(matchValue[1]);
                }
            }
            else {
                return undefined;
            }
            break;
        }
    };
    const matchValue_1 = searchLocal(state.ScopeStack);
    if (matchValue_1 == null) {
        return FSharpMap__TryFind(state.GlobalScope, id);
    }
    else {
        return matchValue_1;
    }
}

export function defineLocal(id, v, state) {
    const matchValue = state.ScopeStack;
    if (isEmpty(matchValue)) {
        throw new Error("FATAL: Cannot define local variable without a scope.");
    }
    else {
        return new EvaluationState(state.CurrentDay, state.Portfolio, cons(cons([id, v], head(matchValue)), tail(matchValue)), state.GlobalScope, state.RiskFreeRate, state.TransactionHistory);
    }
}

export function defineGlobal(id, v, state) {
    if (FSharpMap__ContainsKey(state.GlobalScope, id)) {
        return state;
    }
    else {
        return new EvaluationState(state.CurrentDay, state.Portfolio, state.ScopeStack, FSharpMap__Add(state.GlobalScope, id, v), state.RiskFreeRate, state.TransactionHistory);
    }
}

export function setVar(id, v, state) {
    const updateInStack = (scopes) => {
        if (!isEmpty(scopes)) {
            const rest = tail(scopes);
            const currentScope = head(scopes);
            const matchValue = tryFindIndex((tupledArg) => (tupledArg[0] === id), currentScope);
            if (matchValue == null) {
                const patternInput = updateInStack(rest);
                return [patternInput[0], cons(currentScope, patternInput[1])];
            }
            else {
                return [true, cons(updateAt(matchValue, [id, v], currentScope), rest)];
            }
        }
        else {
            return [false, empty()];
        }
    };
    const patternInput_1 = updateInStack(state.ScopeStack);
    if (patternInput_1[0]) {
        return new EvaluationState(state.CurrentDay, state.Portfolio, patternInput_1[1], state.GlobalScope, state.RiskFreeRate, state.TransactionHistory);
    }
    else if (FSharpMap__ContainsKey(state.GlobalScope, id)) {
        return new EvaluationState(state.CurrentDay, state.Portfolio, state.ScopeStack, FSharpMap__Add(state.GlobalScope, id, v), state.RiskFreeRate, state.TransactionHistory);
    }
    else {
        throw new InterpreterError(`Cannot 'set' an unbound variable '${id}'.`);
    }
}

function valueToFloat(v) {
    switch (v.tag) {
        case 0:
            return v.fields[0];
        case 1:
            return v.fields[0];
        case 2:
            return v.fields[0];
        case 3:
            if (v.fields[0]) {
                return 1;
            }
            else {
                return 0;
            }
        default:
            throw new InterpreterError(`Cannot convert value '${v}' to a float for comparison.`);
    }
}

function getMarketSnapshot(history, currentDay) {
    return ofList(map((path) => {
        const data = item(currentDay, path.DailyData);
        return [path.Ticker, new MarketDataPoint(data.Price, data.Vol)];
    }, history), {
        Compare: comparePrimitives,
    });
}

function calculateInstanceValue(instance, history, currentDay, riskFreeRate) {
    const matchValue = instance.Instrument;
    switch (matchValue.tag) {
        case 1:
            return (price_1(matchValue.fields[0], history, currentDay, riskFreeRate) * instance.Quantity) * 100;
        case 2:
            return 0;
        default: {
            const assetRef = matchValue.fields[0];
            const ticker = (assetRef.tag === 1) ? (`${assetRef.fields[1]}x_${assetRef.fields[0]}`) : assetRef.fields[0];
            const matchValue_1 = tryFind((p) => (p.Ticker === ticker), history);
            if (matchValue_1 == null) {
                return 0;
            }
            else {
                return item(currentDay, matchValue_1.DailyData).Price * instance.Quantity;
            }
        }
    }
}

function interpretExpression(state_mut, history_mut, expr_mut) {
    interpretExpression:
    while (true) {
        const state = state_mut, history = history_mut, expr = expr_mut;
        switch (expr.tag) {
            case 1: {
                const id = expr.fields[0];
                const matchValue = lookup(id, state);
                if (matchValue == null) {
                    throw new InterpreterError(`Unbound variable '${id}'.`);
                }
                else {
                    return matchValue;
                }
            }
            case 2: {
                const assetRef = expr.fields[0];
                const ticker = (assetRef.tag === 1) ? (`${assetRef.fields[1]}x_${assetRef.fields[0]}`) : assetRef.fields[0];
                const matchValue_1 = tryFind((p_1) => (p_1.Ticker === ticker), history);
                if (matchValue_1 != null) {
                    return new Value(2, [item(state.CurrentDay, matchValue_1.DailyData).Price]);
                }
                else {
                    throw new InterpreterError(`Market data not found for ticker '${ticker}'.`);
                }
            }
            case 7: {
                const op = expr.fields[0];
                const v1 = interpretExpression(state, history, expr.fields[1]);
                const v2 = interpretExpression(state, history, expr.fields[2]);
                let matchResult, f1, f2, d1, d2, p1, p2, f1_1, f2_1, d1_1, d2_1, p1_1, p2_1, f1_2, f2_2, f_1, p_2, f_2, p_3, d_1, f_3, d_2, f_4, d_3, p_4, d_4, p_5, f1_3, f2_3, d_5, f_5, d1_2, d2_2, f_6, p_6, f1_4, f2_4;
                switch (op.tag) {
                    case 1: {
                        switch (v1.tag) {
                            case 0: {
                                if (v2.tag === 0) {
                                    matchResult = 3;
                                    f1_1 = v1.fields[0];
                                    f2_1 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            case 2: {
                                if (v2.tag === 2) {
                                    matchResult = 4;
                                    d1_1 = v1.fields[0];
                                    d2_1 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            case 1: {
                                if (v2.tag === 1) {
                                    matchResult = 5;
                                    p1_1 = v1.fields[0];
                                    p2_1 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            default:
                                matchResult = 18;
                        }
                        break;
                    }
                    case 2: {
                        switch (v1.tag) {
                            case 0: {
                                switch (v2.tag) {
                                    case 0: {
                                        matchResult = 6;
                                        f1_2 = v1.fields[0];
                                        f2_2 = v2.fields[0];
                                        break;
                                    }
                                    case 1: {
                                        matchResult = 7;
                                        f_1 = v1.fields[0];
                                        p_2 = v2.fields[0];
                                        break;
                                    }
                                    case 2: {
                                        matchResult = 9;
                                        d_1 = v2.fields[0];
                                        f_3 = v1.fields[0];
                                        break;
                                    }
                                    default:
                                        matchResult = 18;
                                }
                                break;
                            }
                            case 1: {
                                switch (v2.tag) {
                                    case 0: {
                                        matchResult = 8;
                                        f_2 = v2.fields[0];
                                        p_3 = v1.fields[0];
                                        break;
                                    }
                                    case 2: {
                                        matchResult = 11;
                                        d_3 = v2.fields[0];
                                        p_4 = v1.fields[0];
                                        break;
                                    }
                                    default:
                                        matchResult = 18;
                                }
                                break;
                            }
                            case 2: {
                                switch (v2.tag) {
                                    case 0: {
                                        matchResult = 10;
                                        d_2 = v1.fields[0];
                                        f_4 = v2.fields[0];
                                        break;
                                    }
                                    case 1: {
                                        matchResult = 12;
                                        d_4 = v1.fields[0];
                                        p_5 = v2.fields[0];
                                        break;
                                    }
                                    default:
                                        matchResult = 18;
                                }
                                break;
                            }
                            default:
                                matchResult = 18;
                        }
                        break;
                    }
                    case 3: {
                        switch (v1.tag) {
                            case 0: {
                                if (v2.tag === 0) {
                                    matchResult = 13;
                                    f1_3 = v1.fields[0];
                                    f2_3 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            case 2: {
                                switch (v2.tag) {
                                    case 0: {
                                        matchResult = 14;
                                        d_5 = v1.fields[0];
                                        f_5 = v2.fields[0];
                                        break;
                                    }
                                    case 2: {
                                        matchResult = 15;
                                        d1_2 = v1.fields[0];
                                        d2_2 = v2.fields[0];
                                        break;
                                    }
                                    default:
                                        matchResult = 18;
                                }
                                break;
                            }
                            case 1: {
                                if (v2.tag === 0) {
                                    matchResult = 16;
                                    f_6 = v2.fields[0];
                                    p_6 = v1.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            default:
                                matchResult = 18;
                        }
                        break;
                    }
                    case 4: {
                        if (v1.tag === 0) {
                            if (v2.tag === 0) {
                                matchResult = 17;
                                f1_4 = v1.fields[0];
                                f2_4 = v2.fields[0];
                            }
                            else {
                                matchResult = 18;
                            }
                        }
                        else {
                            matchResult = 18;
                        }
                        break;
                    }
                    default:
                        switch (v1.tag) {
                            case 0: {
                                if (v2.tag === 0) {
                                    matchResult = 0;
                                    f1 = v1.fields[0];
                                    f2 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            case 2: {
                                if (v2.tag === 2) {
                                    matchResult = 1;
                                    d1 = v1.fields[0];
                                    d2 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            case 1: {
                                if (v2.tag === 1) {
                                    matchResult = 2;
                                    p1 = v1.fields[0];
                                    p2 = v2.fields[0];
                                }
                                else {
                                    matchResult = 18;
                                }
                                break;
                            }
                            default:
                                matchResult = 18;
                        }
                }
                switch (matchResult) {
                    case 0:
                        return new Value(0, [f1 + f2]);
                    case 1:
                        return new Value(2, [d1 + d2]);
                    case 2:
                        return new Value(1, [p1 + p2]);
                    case 3:
                        return new Value(0, [f1_1 - f2_1]);
                    case 4:
                        return new Value(2, [d1_1 - d2_1]);
                    case 5:
                        return new Value(1, [p1_1 - p2_1]);
                    case 6:
                        return new Value(0, [f1_2 * f2_2]);
                    case 7:
                        return new Value(1, [f_1 * p_2]);
                    case 8:
                        return new Value(1, [p_3 * f_2]);
                    case 9:
                        return new Value(2, [f_3 * d_1]);
                    case 10:
                        return new Value(2, [d_2 * f_4]);
                    case 11:
                        return new Value(2, [p_4 * d_3]);
                    case 12:
                        return new Value(2, [d_4 * p_5]);
                    case 13:
                        if (f2_3 === 0) {
                            throw new InterpreterError("Division by zero.");
                        }
                        else {
                            return new Value(0, [f1_3 / f2_3]);
                        }
                    case 14:
                        if (f_5 === 0) {
                            throw new InterpreterError("Division by zero.");
                        }
                        else {
                            return new Value(2, [d_5 / f_5]);
                        }
                    case 15:
                        if (d2_2 === 0) {
                            throw new InterpreterError("Division by zero.");
                        }
                        else {
                            return new Value(0, [d1_2 / d2_2]);
                        }
                    case 16:
                        if (f_6 === 0) {
                            throw new InterpreterError("Division by zero.");
                        }
                        else {
                            return new Value(1, [p_6 / f_6]);
                        }
                    case 17:
                        if (f2_4 === 0) {
                            throw new InterpreterError("Modulo by zero.");
                        }
                        else {
                            return new Value(0, [f1_4 % f2_4]);
                        }
                    default:
                        throw new InterpreterError("Invalid arithmetic operation.");
                }
            }
            case 8: {
                const matchValue_3 = interpretExpression(state, history, expr.fields[0]);
                switch (matchValue_3.tag) {
                    case 0:
                        return new Value(0, [-matchValue_3.fields[0]]);
                    case 1:
                        return new Value(1, [-matchValue_3.fields[0]]);
                    case 2:
                        return new Value(2, [-matchValue_3.fields[0]]);
                    default:
                        throw new InterpreterError(`Cannot apply unary minus to non-numeric value '${matchValue_3}'.`);
                }
            }
            case 9: {
                state_mut = state;
                history_mut = history;
                expr_mut = expr.fields[0];
                continue interpretExpression;
            }
            case 5:
                return new Value(0, [calculate(expr.fields[0], history, state.CurrentDay)]);
            case 6: {
                const query = expr.fields[0];
                switch (query.tag) {
                    case 1:
                        return new Value(2, [calculatePortfolioValue(state.Portfolio, history, state.CurrentDay, state.RiskFreeRate)]);
                    case 2:
                        return new Value(0, [calculatePositionQuantity(state.Portfolio, query.fields[0])]);
                    case 3:
                        return new Value(2, [calculatePositionValue(state.Portfolio, query.fields[0], history, state.CurrentDay, state.RiskFreeRate)]);
                    default:
                        return new Value(2, [state.Portfolio.Cash]);
                }
            }
            case 4: {
                const pa = expr.fields[0];
                const objectValue = interpretExpression(state, history, pa.Object);
                if (objectValue.tag === 6) {
                    const instance = objectValue.fields[0];
                    const propertyName = pa.Property.toLocaleLowerCase();
                    switch (propertyName) {
                        case "quantity":
                            return new Value(0, [instance.Quantity]);
                        case "buy_price":
                            return new Value(2, [instance.BuyPrice]);
                        case "buy_date":
                            return new Value(0, [instance.BuyDate]);
                        case "price":
                            if (instance.Quantity === 0) {
                                return new Value(2, [0]);
                            }
                            else {
                                return new Value(2, [calculateInstanceValue(instance, history, state.CurrentDay, state.RiskFreeRate) / instance.Quantity]);
                            }
                        case "value":
                            return new Value(2, [calculateInstanceValue(instance, history, state.CurrentDay, state.RiskFreeRate)]);
                        case "delta":
                        case "gamma":
                        case "theta":
                        case "vega":
                        case "rho": {
                            const matchValue_4 = instance.Instrument;
                            if (matchValue_4.tag === 1) {
                                const opt = matchValue_4.fields[0];
                                return new Value(0, [(propertyName === "delta") ? delta(opt, history, state.CurrentDay, state.RiskFreeRate) : ((propertyName === "gamma") ? gamma(opt, history, state.CurrentDay, state.RiskFreeRate) : ((propertyName === "theta") ? theta(opt, history, state.CurrentDay, state.RiskFreeRate) : ((propertyName === "vega") ? vega(opt, history, state.CurrentDay, state.RiskFreeRate) : ((propertyName === "rho") ? rho(opt, history, state.CurrentDay, state.RiskFreeRate) : 0))))]);
                            }
                            else {
                                return new Value(0, [0]);
                            }
                        }
                        default: {
                            const nestedComponentName = propertyName;
                            const sibling = tryFind((p_8) => {
                                if ((p_8.GroupId != null) && equals(p_8.GroupId, instance.GroupId)) {
                                    return equals(p_8.ComponentName, nestedComponentName);
                                }
                                else {
                                    return false;
                                }
                            }, state.Portfolio.Positions);
                            if (sibling == null) {
                                const matchValue_5 = tryFind((p_9) => (equals(p_9.ParentId, instance.Id) && equals(p_9.ComponentName, nestedComponentName)), state.Portfolio.Positions);
                                if (matchValue_5 == null) {
                                    throw new InterpreterError(`Component '${nestedComponentName}' not found in position '${instance.DefinitionName}'.`);
                                }
                                else {
                                    return new Value(6, [matchValue_5]);
                                }
                            }
                            else {
                                return new Value(6, [sibling]);
                            }
                        }
                    }
                }
                else {
                    throw new InterpreterError(`Cannot access property on non-instance value '${objectValue}'.`);
                }
            }
            case 3:
                throw new InterpreterError("Interpreter Error: Encountered a standalone OptionExpr.");
            default: {
                const lit = expr.fields[0];
                if (lit.tag === 1) {
                    return new Value(3, [equals(lit.fields[0], new BoolLiteral(0, []))]);
                }
                else {
                    switch (lit.fields[0].tag) {
                        case 1:
                            return new Value(1, [lit.fields[0].fields[0]]);
                        case 2:
                            return new Value(2, [lit.fields[0].fields[0]]);
                        default:
                            return new Value(0, [lit.fields[0].fields[0]]);
                    }
                }
            }
        }
        break;
    }
}

function interpretCondition(state_mut, history_mut, cond_mut) {
    interpretCondition:
    while (true) {
        const state = state_mut, history = history_mut, cond = cond_mut;
        switch (cond.tag) {
            case 1:
                if (cond.fields[0].tag === 1) {
                    if (interpretCondition(state, history, cond.fields[1])) {
                        return true;
                    }
                    else {
                        state_mut = state;
                        history_mut = history;
                        cond_mut = cond.fields[2];
                        continue interpretCondition;
                    }
                }
                else if (interpretCondition(state, history, cond.fields[1])) {
                    state_mut = state;
                    history_mut = history;
                    cond_mut = cond.fields[2];
                    continue interpretCondition;
                }
                else {
                    return false;
                }
            case 2:
                return !interpretCondition(state, history, cond.fields[0]);
            case 3: {
                state_mut = state;
                history_mut = history;
                cond_mut = cond.fields[0];
                continue interpretCondition;
            }
            case 4: {
                const matchValue = interpretExpression(state, history, cond.fields[0]);
                if (matchValue.tag === 3) {
                    return matchValue.fields[0];
                }
                else {
                    throw new InterpreterError("Expression in a boolean context did not evaluate to a boolean.");
                }
            }
            default: {
                const v1 = interpretExpression(state, history, cond.fields[1]);
                const v2 = interpretExpression(state, history, cond.fields[2]);
                const f1 = valueToFloat(v1);
                const f2 = valueToFloat(v2);
                switch (cond.fields[0].tag) {
                    case 1:
                        return f1 < f2;
                    case 2:
                        return f1 >= f2;
                    case 3:
                        return f1 <= f2;
                    case 4:
                        return f1 === f2;
                    case 5:
                        return f1 !== f2;
                    default:
                        return f1 > f2;
                }
            }
        }
        break;
    }
}

function interpretStatement(state, history, stmt) {
    switch (stmt.tag) {
        case 1: {
            const setStmt = stmt.fields[0];
            return setVar(setStmt.Name, interpretExpression(state, history, setStmt.Value), state);
        }
        case 3: {
            const condStmt = stmt.fields[0];
            if (interpretCondition(state, history, condStmt.Condition)) {
                return popScope(interpretBlock(pushScope(state), history, condStmt.ThenBlock));
            }
            else {
                return state;
            }
        }
        case 4: {
            const loopStmt = stmt.fields[0];
            return fold((currentState, instance) => popScope(interpretBlock(defineLocal(loopStmt.InstanceVariable, new Value(6, [instance]), pushScope(currentState)), history, loopStmt.Block)), state, filter((p_1) => {
                if (p_1.DefinitionName === loopStmt.PositionType) {
                    return equals(p_1.ParentId, undefined);
                }
                else {
                    return false;
                }
            }, state.Portfolio.Positions));
        }
        case 2:
            return interpretAction(state, history, stmt.fields[0]);
        default: {
            const def = stmt.fields[0];
            const isGlobal = isEmpty(state.ScopeStack);
            let valueToDefine;
            const matchValue = def.Value;
            valueToDefine = ((matchValue.tag === 1) ? (new Value(5, [matchValue.fields[0]])) : interpretExpression(state, history, matchValue.fields[0]));
            if (isGlobal) {
                return defineGlobal(def.Name, valueToDefine, state);
            }
            else {
                return defineLocal(def.Name, valueToDefine, state);
            }
        }
    }
}

function interpretBlock(state, history, statements) {
    return fold((currentState, stmt) => interpretStatement(currentState, history, stmt), state, statements);
}

function interpretAction(state, history, action) {
    const trades = expandTrade(action, state, history);
    const validationResult = validateTrades(trades, state.Portfolio, getMarketSnapshot(history, state.CurrentDay), state.CurrentDay, state.RiskFreeRate);
    if (validationResult.tag === 1) {
        return state;
    }
    else {
        const patternInput = executeTrades(trades, state.Portfolio, history, state.CurrentDay, state.RiskFreeRate);
        return new EvaluationState(state.CurrentDay, patternInput[0], state.ScopeStack, state.GlobalScope, state.RiskFreeRate, append(state.TransactionHistory, patternInput[1]));
    }
}

function expandTrade(action, state, history) {
    let assetRef_1;
    const evaluateQuantity = (qty) => {
        switch (qty.tag) {
            case 1: {
                const matchValue = lookup(qty.fields[0], state);
                if (matchValue == null) {
                    throw new InterpreterError(`Unbound quantity variable '${qty.fields[0]}'.`);
                }
                else if (matchValue.tag === 0) {
                    const f = matchValue.fields[0];
                    return f;
                }
                else {
                    const v = matchValue;
                    throw new InterpreterError(`Quantity variable '${qty.fields[0]}' is not a float, got '${v}'.`);
                }
            }
            case 2: {
                const matchValue_1 = interpretExpression(state, history, qty.fields[0]);
                if (matchValue_1.tag === 0) {
                    return matchValue_1.fields[0];
                }
                else {
                    throw new InterpreterError(`Quantity expression did not evaluate to a float, got '${matchValue_1}'.`);
                }
            }
            default:
                if (qty.fields[0].tag === 0) {
                    return qty.fields[0].fields[0];
                }
                else {
                    throw new InterpreterError("Only plain numbers can be used as a trade quantity.");
                }
        }
    };
    const evaluateTarget = (target) => {
        if (target.tag === 1) {
            const id_1 = target.fields[0];
            const matchValue_2 = lookup(id_1, state);
            if (matchValue_2 == null) {
                throw new InterpreterError(`Unbound identifier '${id_1}' in action target.`);
            }
            else {
                return matchValue_2;
            }
        }
        else {
            return new Value(4, [target.fields[0]]);
        }
    };
    const getDefinitionName = (target_1) => {
        if (target_1.tag === 1) {
            return target_1.fields[0];
        }
        else {
            return undefined;
        }
    };
    switch (action.tag) {
        case 1: {
            const target_3 = action.fields[1];
            const quantityValue_1 = evaluateQuantity(action.fields[0]);
            return expandTargetToTrades(evaluateTarget(target_3), quantityValue_1, false, getDefinitionName(target_3), state, history);
        }
        case 2: {
            const target_4 = action.fields[0];
            const targetValue_2 = evaluateTarget(target_4);
            const defName_2 = getDefinitionName(target_4);
            return expandTargetToTrades(targetValue_2, calculateMaxQuantity(expandTargetToTrades(targetValue_2, 1, true, defName_2, state, history), state.Portfolio, getMarketSnapshot(history, state.CurrentDay), state.CurrentDay, state.RiskFreeRate), true, defName_2, state, history);
        }
        case 3: {
            const target_5 = action.fields[0];
            const currentQty = calculatePositionQuantity(state.Portfolio, (target_5.tag === 0) ? ((assetRef_1 = target_5.fields[0], (assetRef_1.tag === 1) ? (`${assetRef_1.fields[0]}_${assetRef_1.fields[1]}x`) : assetRef_1.fields[0])) : target_5.fields[0]);
            if (currentQty <= 0) {
                return empty();
            }
            else {
                return expandTargetToTrades(evaluateTarget(target_5), currentQty, false, getDefinitionName(target_5), state, history);
            }
        }
        case 4: {
            const targetValue_4 = evaluateTarget(action.fields[1]);
            if (targetValue_4.tag === 4) {
                return singleton(new PrimitiveTrade(2, [new RebalanceParams(new ResolvedInstrument(0, [targetValue_4.fields[0]]), action.fields[0])]));
            }
            else {
                throw new InterpreterError("Rebalancing is only supported for simple assets.");
            }
        }
        default: {
            const target_2 = action.fields[1];
            const quantityValue = evaluateQuantity(action.fields[0]);
            return expandTargetToTrades(evaluateTarget(target_2), quantityValue, true, getDefinitionName(target_2), state, history);
        }
    }
}

function expandTargetToTrades(targetValue, quantity, isBuy, definitionName, state, history) {
    switch (targetValue.tag) {
        case 4: {
            const resolved = new ResolvedInstrument(0, [targetValue.fields[0]]);
            if (isBuy) {
                return singleton(new PrimitiveTrade(0, [new BuyParams(resolved, quantity, undefined, definitionName)]));
            }
            else {
                return singleton(new PrimitiveTrade(1, [new SellParams(resolved, quantity, undefined, definitionName)]));
            }
        }
        case 5:
            return expandPositionExpression(targetValue.fields[0], quantity, isBuy, definitionName, state, history);
        case 6: {
            const instance = targetValue.fields[0];
            if (isBuy) {
                throw new InterpreterError("Cannot \'buy\' a specific position instance. Use the position type instead.");
            }
            else {
                return singleton(new PrimitiveTrade(1, [new SellParams(instance.Instrument, quantity, instance.ComponentName, instance.DefinitionName)]));
            }
        }
        default:
            throw new InterpreterError(`Invalid target for a trade action: '${targetValue}'.`);
    }
}

function expandPositionExpression(posExpr, multiplier, isBuy, positionName, state, history) {
    const expand = (expr_mut, componentName_mut) => {
        let matchValue, f, v, matchValue_1;
        expand:
        while (true) {
            const expr = expr_mut, componentName = componentName_mut;
            switch (expr.tag) {
                case 1:
                    return append(expand(expr.fields[0], undefined), expand(expr.fields[1], undefined));
                case 2: {
                    const id_1 = expr.fields[0];
                    const matchValue_2 = lookup(id_1, state);
                    if (matchValue_2 == null) {
                        throw new InterpreterError(`Unbound position reference '${id_1}'.`);
                    }
                    else if (matchValue_2.tag === 5) {
                        const p = matchValue_2.fields[0];
                        expr_mut = p;
                        componentName_mut = id_1;
                        continue expand;
                    }
                    else {
                        const v_2 = matchValue_2;
                        throw new InterpreterError(`Identifier '${id_1}' is not a position definition, got '${v_2}'.`);
                    }
                }
                default: {
                    const comp = expr.fields[0];
                    const patternInput = (comp.tag === 1) ? [comp.fields[0], comp.fields[1]] : [comp.fields[0], comp.fields[1]];
                    const qty = patternInput[0];
                    const finalQty = ((qty.tag === 1) ? ((matchValue = lookup(qty.fields[0], state), (matchValue == null) ? (() => {
                        throw new InterpreterError(`Unbound quantity identifier '${qty.fields[0]}'.`);
                    })() : ((matchValue.tag === 0) ? ((f = matchValue.fields[0], f)) : ((v = matchValue, (() => {
                        throw new InterpreterError(`Quantity '${qty.fields[0]}' is not a float, got '${v}'.`);
                    })()))))) : ((qty.tag === 2) ? ((matchValue_1 = interpretExpression(state, history, qty.fields[0]), (matchValue_1.tag === 0) ? matchValue_1.fields[0] : (() => {
                        throw new InterpreterError(`Quantity expression must evaluate to float, got '${matchValue_1}'.`);
                    })())) : ((qty.fields[0].tag === 0) ? qty.fields[0].fields[0] : (() => {
                        throw new InterpreterError("Invalid quantity type in position component.");
                    })()))) * multiplier;
                    const resolvedInstrument = resolveInstrument(patternInput[1], state, history);
                    if ((comp.tag === 1) ? !isBuy : isBuy) {
                        return singleton(new PrimitiveTrade(0, [new BuyParams(resolvedInstrument, finalQty, componentName, positionName)]));
                    }
                    else {
                        return singleton(new PrimitiveTrade(1, [new SellParams(resolvedInstrument, finalQty, componentName, positionName)]));
                    }
                }
            }
            break;
        }
    };
    return expand(posExpr, undefined);
}

function resolveInstrument(instrument, state, history) {
    if (instrument.tag === 1) {
        const optSpec = instrument.fields[0];
        return new ResolvedInstrument(1, [new ConcreteOption(optSpec.Underlying, findStrikeForDelta(optSpec, history, state.CurrentDay, state.RiskFreeRate), state.CurrentDay + optSpec.DTE, optSpec.GreekValue > 0)]);
    }
    else {
        return new ResolvedInstrument(0, [instrument.fields[0]]);
    }
}

export function interpretStep(program, currentState, priceHistory) {
    return interpretBlock(currentState, priceHistory, program.Statements);
}

