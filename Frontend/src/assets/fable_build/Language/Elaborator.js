import { Record, FSharpException } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { record_type, list_type, tuple_type, string_type, class_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { T_PositionInfo, T_Type, T_Type_$reflection } from "./Types.js";
import { PositionExpression, PositionExpression_$reflection } from "./AST.js";
import { map as map_1, reverse, contains, singleton, fold, exists, head, tryFind, tail, isEmpty, cons, empty } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { FSharpMap__get_Keys, map, FSharpMap__Add, FSharpMap__ContainsKey, FSharpMap__TryFind, empty as empty_1 } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { stringHash, equals, disposeSafe, getEnumerator, comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { some } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { Result_Bind, FSharpResult$2 } from "../fable_modules/fable-library-js.4.27.0/Result.js";
import { empty as empty_2, union, singleton as singleton_1 } from "../fable_modules/fable-library-js.4.27.0/Set.js";
import { join } from "../fable_modules/fable-library-js.4.27.0/String.js";
import { max } from "../fable_modules/fable-library-js.4.27.0/Double.js";

export class TypeError$ extends FSharpException {
    constructor(Data0) {
        super();
        this.Data0 = Data0;
    }
}

export function TypeError$_$reflection() {
    return class_type("Elaborator.TypeError", undefined, TypeError$, class_type("System.Exception"));
}

export class TypeContext extends Record {
    constructor(ScopeStack, GlobalScope, PositionDefinitions) {
        super();
        this.ScopeStack = ScopeStack;
        this.GlobalScope = GlobalScope;
        this.PositionDefinitions = PositionDefinitions;
    }
}

export function TypeContext_$reflection() {
    return record_type("Elaborator.TypeContext", [], TypeContext, () => [["ScopeStack", list_type(list_type(tuple_type(string_type, T_Type_$reflection())))], ["GlobalScope", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [string_type, T_Type_$reflection()])], ["PositionDefinitions", class_type("Microsoft.FSharp.Collections.FSharpMap`2", [string_type, PositionExpression_$reflection()])]]);
}

export function emptyContext() {
    return new TypeContext(empty(), empty_1({
        Compare: comparePrimitives,
    }), empty_1({
        Compare: comparePrimitives,
    }));
}

export function pushScope(ctx) {
    return new TypeContext(cons(empty(), ctx.ScopeStack), ctx.GlobalScope, ctx.PositionDefinitions);
}

export function popScope(ctx) {
    const matchValue = ctx.ScopeStack;
    if (isEmpty(matchValue)) {
        throw new Error("FATAL: Pop from empty scope stack");
    }
    else {
        return new TypeContext(tail(matchValue), ctx.GlobalScope, ctx.PositionDefinitions);
    }
}

export function lookup(id, ctx) {
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
    const matchValue_1 = searchLocal(ctx.ScopeStack);
    if (matchValue_1 == null) {
        return FSharpMap__TryFind(ctx.GlobalScope, id);
    }
    else {
        return matchValue_1;
    }
}

export function defineLocal(id, t, ctx) {
    const matchValue = ctx.ScopeStack;
    if (isEmpty(matchValue)) {
        throw new Error("FATAL: Cannot define local variable without a scope.");
    }
    else {
        const currentScope = head(matchValue);
        if (exists((tupledArg) => (tupledArg[0] === id), currentScope)) {
            return new FSharpResult$2(1, [`Identifier '${id}' is already defined in this scope.`]);
        }
        else {
            return new FSharpResult$2(0, [new TypeContext(cons(cons([id, t], currentScope), tail(matchValue)), ctx.GlobalScope, ctx.PositionDefinitions)]);
        }
    }
}

export function defineGlobal(id, t, ctx) {
    if (FSharpMap__ContainsKey(ctx.GlobalScope, id)) {
        return new FSharpResult$2(0, [ctx]);
    }
    else {
        return new FSharpResult$2(0, [new TypeContext(ctx.ScopeStack, FSharpMap__Add(ctx.GlobalScope, id, t), ctx.PositionDefinitions)]);
    }
}

export function definePosition(name, posExpr, ctx) {
    return new FSharpResult$2(0, [new TypeContext(ctx.ScopeStack, ctx.GlobalScope, FSharpMap__Add(ctx.PositionDefinitions, name, posExpr))]);
}

export class ResultBuilder {
    constructor() {
    }
}

export function ResultBuilder_$reflection() {
    return class_type("Elaborator.ResultBuilder", undefined, ResultBuilder);
}

export function ResultBuilder_$ctor() {
    return new ResultBuilder();
}

export function ResultBuilder__Bind_764BA1D3(_, m, f) {
    return Result_Bind(f, m);
}

export function ResultBuilder__Return_1505(_, x) {
    return new FSharpResult$2(0, [x]);
}

export function ResultBuilder__ReturnFrom_Z6CF16FB5(_, m) {
    return m;
}

export function ResultBuilder__Zero(_) {
    return new FSharpResult$2(0, [undefined]);
}

export function ResultBuilder__Combine_592D599(_, a, b) {
    if (a.tag === 1) {
        return new FSharpResult$2(1, [a.fields[0]]);
    }
    else {
        return b;
    }
}

export function ResultBuilder__Delay_Z494D0C1F(_, f) {
    return f();
}

export function ResultBuilder__For_47E0214D(_, sequence, body) {
    let currentResult = new FSharpResult$2(0, [undefined]);
    const e = getEnumerator(sequence);
    try {
        let shouldContinue = true;
        while (shouldContinue && e["System.Collections.IEnumerator.MoveNext"]()) {
            if (currentResult.tag === 1) {
                shouldContinue = false;
            }
            else {
                currentResult = body(e["System.Collections.Generic.IEnumerator`1.get_Current"]());
            }
        }
        return currentResult;
    }
    finally {
        disposeSafe(e);
    }
}

export const result = ResultBuilder_$ctor();

export function lookupOrError(id, ctx) {
    const matchValue = lookup(id, ctx);
    if (matchValue == null) {
        return new FSharpResult$2(0, [new T_Type(4, [])]);
    }
    else {
        return new FSharpResult$2(0, [matchValue]);
    }
}

export function elaborateSeq(elaborator, ctx, items) {
    return fold((ctxResult, item) => {
        const builder$0040 = result;
        return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ResultBuilder__Bind_764BA1D3(builder$0040, ctxResult, (_arg) => ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, elaborator(_arg, item))));
    }, new FSharpResult$2(0, [ctx]), items);
}

export function withScope(elaborationFunc, ctx) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ResultBuilder__Bind_764BA1D3(builder$0040, elaborationFunc(pushScope(ctx)), (_arg) => {
        const finalBlockCtx = _arg;
        return ResultBuilder__Return_1505(builder$0040, new TypeContext(ctx.ScopeStack, finalBlockCtx.GlobalScope, finalBlockCtx.PositionDefinitions));
    }));
}

function elaborateExpression(ctx, expr) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        switch (expr.tag) {
            case 1:
                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, lookupOrError(expr.fields[0], ctx));
            case 2:
                return ResultBuilder__Return_1505(builder$0040, new T_Type(4, []));
            case 3:
                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, ["Option specifications can only be used inside a \'buy\' or \'sell\' component."]));
            case 7: {
                const op = expr.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, expr.fields[1]), (_arg) => {
                    const t1 = _arg;
                    return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, expr.fields[2]), (_arg_1) => {
                        const t2 = _arg_1;
                        const resolveType = (t) => {
                            if (equals(t, new T_Type(4, []))) {
                                return new T_Type(2, []);
                            }
                            else {
                                return t;
                            }
                        };
                        const rt1 = resolveType(t1);
                        const rt2 = resolveType(t2);
                        let matchResult;
                        switch (op.tag) {
                            case 1: {
                                switch (rt1.tag) {
                                    case 0: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 0;
                                                break;
                                            }
                                            case 2: {
                                                matchResult = 3;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 2: {
                                        switch (rt2.tag) {
                                            case 2: {
                                                matchResult = 1;
                                                break;
                                            }
                                            case 0: {
                                                matchResult = 4;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 1: {
                                        if (rt2.tag === 1) {
                                            matchResult = 2;
                                        }
                                        else {
                                            matchResult = 16;
                                        }
                                        break;
                                    }
                                    default:
                                        matchResult = 16;
                                }
                                break;
                            }
                            case 2: {
                                switch (rt1.tag) {
                                    case 0: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 5;
                                                break;
                                            }
                                            case 1: {
                                                matchResult = 6;
                                                break;
                                            }
                                            case 2: {
                                                matchResult = 8;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 1: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 7;
                                                break;
                                            }
                                            case 2: {
                                                matchResult = 10;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 2: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 9;
                                                break;
                                            }
                                            case 1: {
                                                matchResult = 11;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    default:
                                        matchResult = 16;
                                }
                                break;
                            }
                            case 4: {
                                if (rt1.tag === 0) {
                                    if (rt2.tag === 0) {
                                        matchResult = 5;
                                    }
                                    else {
                                        matchResult = 16;
                                    }
                                }
                                else {
                                    matchResult = 16;
                                }
                                break;
                            }
                            case 3: {
                                switch (rt1.tag) {
                                    case 0: {
                                        if (rt2.tag === 0) {
                                            matchResult = 12;
                                        }
                                        else {
                                            matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 2: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 13;
                                                break;
                                            }
                                            case 2: {
                                                matchResult = 14;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 1: {
                                        if (rt2.tag === 0) {
                                            matchResult = 15;
                                        }
                                        else {
                                            matchResult = 16;
                                        }
                                        break;
                                    }
                                    default:
                                        matchResult = 16;
                                }
                                break;
                            }
                            default:
                                switch (rt1.tag) {
                                    case 0: {
                                        switch (rt2.tag) {
                                            case 0: {
                                                matchResult = 0;
                                                break;
                                            }
                                            case 2: {
                                                matchResult = 3;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 2: {
                                        switch (rt2.tag) {
                                            case 2: {
                                                matchResult = 1;
                                                break;
                                            }
                                            case 0: {
                                                matchResult = 4;
                                                break;
                                            }
                                            default:
                                                matchResult = 16;
                                        }
                                        break;
                                    }
                                    case 1: {
                                        if (rt2.tag === 1) {
                                            matchResult = 2;
                                        }
                                        else {
                                            matchResult = 16;
                                        }
                                        break;
                                    }
                                    default:
                                        matchResult = 16;
                                }
                        }
                        switch (matchResult) {
                            case 0:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                            case 1:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 2:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(1, []));
                            case 3:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 4:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 5:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                            case 6:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(1, []));
                            case 7:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(1, []));
                            case 8:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 9:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 10:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 11:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 12:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                            case 13:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            case 14:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                            case 15:
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(1, []));
                            default:
                                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Operator '${op}' cannot be applied to operands of type '${t1}' and '${t2}'.`]));
                        }
                    });
                });
            }
            case 8:
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, expr.fields[0]), (_arg_2) => {
                    const t_1 = _arg_2;
                    switch (t_1.tag) {
                        case 0:
                        case 1:
                        case 2:
                            return ResultBuilder__Return_1505(builder$0040, t_1);
                        default:
                            return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Unary minus requires a numeric operand, but got type '${t_1}'.`]));
                    }
                });
            case 9:
                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, elaborateExpression(ctx, expr.fields[0]));
            case 5:
                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
            case 6: {
                const query = expr.fields[0];
                switch (query.tag) {
                    case 1:
                        return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                    case 2: {
                        const id_1 = query.fields[0];
                        return ResultBuilder__Bind_764BA1D3(builder$0040, lookupOrError(id_1, ctx), (_arg_3) => {
                            const targetType = _arg_3;
                            switch (targetType.tag) {
                                case 4:
                                case 5:
                                    return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                                default:
                                    return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Cannot query info of '${id_1}' which is not an Asset or Position.`]));
                            }
                        });
                    }
                    case 3: {
                        const id_2 = query.fields[0];
                        return ResultBuilder__Bind_764BA1D3(builder$0040, lookupOrError(id_2, ctx), (_arg_4) => {
                            const targetType_1 = _arg_4;
                            switch (targetType_1.tag) {
                                case 4:
                                case 5:
                                    return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                                default:
                                    return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Cannot query info of '${id_2}' which is not an Asset or Position.`]));
                            }
                        });
                    }
                    default:
                        return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                }
            }
            case 4: {
                const pa = expr.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, pa.Object), (_arg_5) => {
                    const objectType = _arg_5;
                    if (objectType.tag === 6) {
                        const matchValue_1 = pa.Property.toLocaleLowerCase();
                        switch (matchValue_1) {
                            case "dte":
                            case "quantity":
                            case "delta":
                            case "gamma":
                            case "theta":
                            case "vega":
                            case "rho":
                            case "buy_date":
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(0, []));
                            case "price":
                            case "buy_price":
                            case "value":
                                return ResultBuilder__Return_1505(builder$0040, new T_Type(2, []));
                            default:
                                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, getTypeFromPositionDefinition(ctx, objectType.fields[0].Name, singleton(matchValue_1)));
                        }
                    }
                    else {
                        return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Property access via '.' can only be used on a position instance, but got type '${objectType}'.`]));
                    }
                });
            }
            default: {
                const lit = expr.fields[0];
                return (lit.tag === 1) ? ResultBuilder__Return_1505(builder$0040, new T_Type(3, [])) : ((lit.fields[0].tag === 1) ? ResultBuilder__Return_1505(builder$0040, new T_Type(1, [])) : ((lit.fields[0].tag === 2) ? ResultBuilder__Return_1505(builder$0040, new T_Type(2, [])) : ResultBuilder__Return_1505(builder$0040, new T_Type(0, []))));
            }
        }
    });
}

function elaborateCondition(ctx, cond) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ResultBuilder__Bind_764BA1D3(builder$0040, elaborateCondition$0027(ctx, cond), (_arg) => {
        const condType = _arg;
        return !equals(condType, new T_Type(3, [])) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Expected a boolean condition, but got type '${condType}'.`])) : ResultBuilder__Zero(builder$0040);
    }));
}

function elaborateCondition$0027(ctx, cond) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ((cond.tag === 1) ? ResultBuilder__Bind_764BA1D3(builder$0040, elaborateCondition(ctx, cond.fields[1]), () => ResultBuilder__Bind_764BA1D3(builder$0040, elaborateCondition(ctx, cond.fields[2]), () => ResultBuilder__Return_1505(builder$0040, new T_Type(3, [])))) : ((cond.tag === 2) ? ResultBuilder__Bind_764BA1D3(builder$0040, elaborateCondition(ctx, cond.fields[0]), () => ResultBuilder__Return_1505(builder$0040, new T_Type(3, []))) : ((cond.tag === 3) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, elaborateCondition$0027(ctx, cond.fields[0])) : ((cond.tag === 4) ? ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, cond.fields[0]), (_arg_5) => {
        const t_1 = _arg_5;
        return equals(t_1, new T_Type(3, [])) ? ResultBuilder__Return_1505(builder$0040, new T_Type(3, [])) : ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Expected a boolean condition, but expression has type '${t_1}'.`]));
    }) : ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, cond.fields[1]), (_arg) => {
        const t1 = _arg;
        return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, cond.fields[2]), (_arg_1) => {
            const t2 = _arg_1;
            const resolveType = (t) => {
                if (equals(t, new T_Type(4, []))) {
                    return new T_Type(2, []);
                }
                else {
                    return t;
                }
            };
            const rt1 = resolveType(t1);
            const rt2 = resolveType(t2);
            let matchResult;
            switch (rt1.tag) {
                case 0: {
                    switch (rt2.tag) {
                        case 0:
                        case 1:
                        case 2: {
                            matchResult = 0;
                            break;
                        }
                        default:
                            matchResult = 2;
                    }
                    break;
                }
                case 1: {
                    switch (rt2.tag) {
                        case 1:
                        case 0: {
                            matchResult = 0;
                            break;
                        }
                        default:
                            matchResult = 2;
                    }
                    break;
                }
                case 2: {
                    switch (rt2.tag) {
                        case 2:
                        case 0: {
                            matchResult = 0;
                            break;
                        }
                        default:
                            matchResult = 2;
                    }
                    break;
                }
                case 3: {
                    if (rt2.tag === 3) {
                        matchResult = 1;
                    }
                    else {
                        matchResult = 2;
                    }
                    break;
                }
                default:
                    matchResult = 2;
            }
            switch (matchResult) {
                case 0:
                    return ResultBuilder__Return_1505(builder$0040, new T_Type(3, []));
                case 1:
                    return ResultBuilder__Return_1505(builder$0040, new T_Type(3, []));
                default:
                    return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Cannot compare types '${t1}' and '${t2}'.`]));
            }
        });
    }))))));
}

function elaborateStatement(ctx, stmt) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        let matchValue, builder$0040_1;
        switch (stmt.tag) {
            case 1: {
                const setStmt = stmt.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, lookupOrError(setStmt.Name, ctx), (_arg_3) => {
                    const varType = _arg_3;
                    return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateExpression(ctx, setStmt.Value), (_arg_4) => {
                        const exprType = _arg_4;
                        return ResultBuilder__Combine_592D599(builder$0040, !equals(varType, exprType) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Type mismatch: Cannot set variable '${setStmt.Name}' of type '${varType}' to an expression of type '${exprType}'.`])) : ResultBuilder__Zero(builder$0040), ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ResultBuilder__Return_1505(builder$0040, ctx)));
                    });
                });
            }
            case 2:
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateAction(ctx, stmt.fields[0]), () => ResultBuilder__Return_1505(builder$0040, ctx));
            case 3: {
                const condStmt = stmt.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaborateCondition(ctx, condStmt.Condition), () => ResultBuilder__Bind_764BA1D3(builder$0040, withScope((blockCtx) => elaborateBlock(blockCtx, condStmt.ThenBlock), ctx), (_arg_7) => ResultBuilder__Return_1505(builder$0040, new TypeContext(ctx.ScopeStack, _arg_7.GlobalScope, ctx.PositionDefinitions))));
            }
            case 4: {
                const loopStmt = stmt.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, lookupOrError(loopStmt.PositionType, ctx), (_arg_8) => {
                    const posType = _arg_8;
                    return (posType.tag === 5) ? ResultBuilder__Bind_764BA1D3(builder$0040, withScope((blockCtx_1) => {
                        const builder$0040_2 = result;
                        return ResultBuilder__Delay_Z494D0C1F(builder$0040_2, () => ResultBuilder__Bind_764BA1D3(builder$0040_2, defineLocal(loopStmt.InstanceVariable, new T_Type(6, [posType.fields[0]]), blockCtx_1), (_arg_9) => ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040_2, elaborateBlock(_arg_9, loopStmt.Block))));
                    }, ctx), (_arg_10) => ResultBuilder__Return_1505(builder$0040, new TypeContext(ctx.ScopeStack, _arg_10.GlobalScope, ctx.PositionDefinitions))) : ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Cannot loop over '${loopStmt.PositionType}', which is not a position but a '${posType}'.`]));
                });
            }
            default: {
                const def = stmt.fields[0];
                const isGlobal = isEmpty(ctx.ScopeStack);
                return ResultBuilder__Bind_764BA1D3(builder$0040, (matchValue = def.Value, (matchValue.tag === 1) ? ((builder$0040_1 = result, ResultBuilder__Delay_Z494D0C1F(builder$0040_1, () => ResultBuilder__Combine_592D599(builder$0040_1, !isGlobal ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040_1, new FSharpResult$2(1, ["Position definitions are only allowed at the top level."])) : ResultBuilder__Zero(builder$0040_1), ResultBuilder__Delay_Z494D0C1F(builder$0040_1, () => ResultBuilder__Bind_764BA1D3(builder$0040_1, elaboratePositionExpression(ctx, matchValue.fields[0]), () => ResultBuilder__Return_1505(builder$0040_1, new T_Type(5, [new T_PositionInfo(def.Name)])))))))) : elaborateExpression(ctx, matchValue.fields[0])), (_arg_1) => {
                    const valueType = _arg_1;
                    return ResultBuilder__Bind_764BA1D3(builder$0040, isGlobal ? defineGlobal(def.Name, valueType, ctx) : defineLocal(def.Name, valueType, ctx), (_arg_2) => {
                        const ctx$0027 = _arg_2;
                        const matchValue_1 = def.Value;
                        let matchResult, p_1, id;
                        if (matchValue_1.tag === 0) {
                            if (matchValue_1.fields[0].tag === 1) {
                                if (valueType.tag === 5) {
                                    matchResult = 1;
                                    id = matchValue_1.fields[0].fields[0];
                                }
                                else {
                                    matchResult = 2;
                                }
                            }
                            else {
                                matchResult = 2;
                            }
                        }
                        else {
                            matchResult = 0;
                            p_1 = matchValue_1.fields[0];
                        }
                        switch (matchResult) {
                            case 0:
                                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, definePosition(def.Name, p_1, ctx$0027));
                            case 1:
                                return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, definePosition(def.Name, new PositionExpression(2, [id]), ctx$0027));
                            default:
                                return ResultBuilder__Return_1505(builder$0040, ctx$0027);
                        }
                    });
                });
            }
        }
    });
}

function elaborateAction(ctx, action) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        let q;
        return ResultBuilder__Bind_764BA1D3(builder$0040, (action.tag === 0) ? ((q = action.fields[0], (q.tag === 2) ? elaborateExpression(ctx, q.fields[0]) : ((q.tag === 1) ? lookupOrError(q.fields[0], ctx) : ((q.fields[0].tag === 0) ? (new FSharpResult$2(0, [new T_Type(0, [])])) : (new FSharpResult$2(1, ["Only plain numbers can be used as a trade quantity."])))))) : ((action.tag === 1) ? ((q = action.fields[0], (q.tag === 2) ? elaborateExpression(ctx, q.fields[0]) : ((q.tag === 1) ? lookupOrError(q.fields[0], ctx) : ((q.fields[0].tag === 0) ? (new FSharpResult$2(0, [new T_Type(0, [])])) : (new FSharpResult$2(1, ["Only plain numbers can be used as a trade quantity."])))))) : (new FSharpResult$2(0, [new T_Type(0, [])]))), (_arg) => {
            const qtyType = _arg;
            return ResultBuilder__Combine_592D599(builder$0040, !equals(qtyType, new T_Type(0, [])) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Expected a plain number (T_Float) for the quantity, but got an expression of type '${qtyType}'.`])) : ResultBuilder__Zero(builder$0040), ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
                const target = (action.tag === 1) ? action.fields[1] : ((action.tag === 2) ? action.fields[0] : ((action.tag === 3) ? action.fields[0] : ((action.tag === 4) ? action.fields[1] : action.fields[1])));
                return ResultBuilder__Bind_764BA1D3(builder$0040, (target.tag === 1) ? lookupOrError(target.fields[0], ctx) : (new FSharpResult$2(0, [new T_Type(4, [])])), (_arg_1) => {
                    const targetType = _arg_1;
                    switch (targetType.tag) {
                        case 4:
                        case 5:
                        case 6:
                            return ResultBuilder__Return_1505(builder$0040, undefined);
                        default:
                            return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Invalid target for a trade action. Expected a tradable type, but got '${targetType}'.`]));
                    }
                });
            }));
        });
    });
}

function elaboratePositionExpression(ctx, posExpr) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        switch (posExpr.tag) {
            case 1:
                return ResultBuilder__Bind_764BA1D3(builder$0040, elaboratePositionExpression(ctx, posExpr.fields[0]), () => ResultBuilder__Bind_764BA1D3(builder$0040, elaboratePositionExpression(ctx, posExpr.fields[1]), () => ResultBuilder__Return_1505(builder$0040, undefined)));
            case 2: {
                const id_1 = posExpr.fields[0];
                return ResultBuilder__Bind_764BA1D3(builder$0040, lookupOrError(id_1, ctx), (_arg_3) => {
                    const refType = _arg_3;
                    return (refType.tag === 5) ? ResultBuilder__Return_1505(builder$0040, undefined) : ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Identifier '${id_1}' is not a position definition, it has type '${refType}'.`]));
                });
            }
            default: {
                const comp = posExpr.fields[0];
                const patternInput = (comp.tag === 1) ? [comp.fields[0], comp.fields[1]] : [comp.fields[0], comp.fields[1]];
                const qty = patternInput[0];
                const instrument = patternInput[1];
                return ResultBuilder__Bind_764BA1D3(builder$0040, (qty.tag === 1) ? lookupOrError(qty.fields[0], ctx) : ((qty.tag === 2) ? elaborateExpression(ctx, qty.fields[0]) : ((qty.fields[0].tag === 0) ? (new FSharpResult$2(0, [new T_Type(0, [])])) : (new FSharpResult$2(1, ["Invalid quantity in position definition"])))), (_arg) => ResultBuilder__Combine_592D599(builder$0040, !equals(_arg, new T_Type(0, [])) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, ["Quantity in position definition must be a plain number."])) : ResultBuilder__Zero(builder$0040), ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
                    if (instrument.tag === 0) {
                        return ResultBuilder__Zero(builder$0040);
                    }
                    else {
                        const optSpec = instrument.fields[0];
                        return ResultBuilder__Combine_592D599(builder$0040, (optSpec.DTE <= 0) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Option DTE must be positive, but got ${optSpec.DTE}.`])) : ResultBuilder__Zero(builder$0040), ResultBuilder__Delay_Z494D0C1F(builder$0040, () => (((optSpec.GreekValue === 0) ? true : (Math.abs(optSpec.GreekValue) >= 1)) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Option delta '${optSpec.GreekValue}' is out of the valid range (-1.0, 1.0).`])) : ResultBuilder__Zero(builder$0040))));
                    }
                })));
            }
        }
    });
}

function getTypeFromPositionDefinition(ctx, posName, componentPath) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        const matchValue = FSharpMap__TryFind(ctx.PositionDefinitions, posName);
        if (matchValue != null) {
            const posExpr = matchValue;
            if (!isEmpty(componentPath)) {
                const restOfPath = tail(componentPath);
                const componentName = head(componentPath);
                const findComponent = (expr_mut) => {
                    findComponent:
                    while (true) {
                        const expr = expr_mut;
                        switch (expr.tag) {
                            case 1: {
                                const left = expr.fields[0];
                                let matchResult, refName_2;
                                if (left.tag === 2) {
                                    if (left.fields[0] === componentName) {
                                        matchResult = 0;
                                        refName_2 = left.fields[0];
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
                                        return getTypeFromPositionDefinition(ctx, refName_2, restOfPath);
                                    default: {
                                        expr_mut = expr.fields[1];
                                        continue findComponent;
                                    }
                                }
                            }
                            case 0:
                                return undefined;
                            default: {
                                const refName = expr.fields[0];
                                if (refName === componentName) {
                                    return getTypeFromPositionDefinition(ctx, refName, restOfPath);
                                }
                                else {
                                    return undefined;
                                }
                            }
                        }
                        break;
                    }
                };
                const matchValue_1 = findComponent(posExpr);
                return (matchValue_1 == null) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Position '${posName}' does not have a named component '${componentName}'.`])) : ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, matchValue_1);
            }
            else {
                return ResultBuilder__Return_1505(builder$0040, new T_Type(6, [new T_PositionInfo(posName)]));
            }
        }
        else {
            return ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040, new FSharpResult$2(1, [`Internal Error: Could not find definition for position '${posName}'.`]));
        }
    });
}

function elaborateBlock(ctx, statements) {
    return elaborateSeq(elaborateStatement, ctx, statements);
}

function checkAcyclicPositions(ctx) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => {
        const dependencyGraph = map((_arg, posExpr) => {
            const getDependencies = (expr) => {
                switch (expr.tag) {
                    case 2:
                        return singleton_1(expr.fields[0], {
                            Compare: comparePrimitives,
                        });
                    case 1:
                        return union(getDependencies(expr.fields[0]), getDependencies(expr.fields[1]));
                    default:
                        return empty_2({
                            Compare: comparePrimitives,
                        });
                }
            };
            return getDependencies(posExpr);
        }, ctx.PositionDefinitions);
        const visit = (path, node) => {
            const builder$0040_1 = result;
            return ResultBuilder__Delay_Z494D0C1F(builder$0040_1, () => ResultBuilder__Combine_592D599(builder$0040_1, contains(node, path, {
                Equals: (x_2, y_2) => (x_2 === y_2),
                GetHashCode: stringHash,
            }) ? ResultBuilder__ReturnFrom_Z6CF16FB5(builder$0040_1, new FSharpResult$2(1, [`Cyclic position definition detected: ${join(" -> ", reverse(cons(node, path)))}`])) : ResultBuilder__Zero(builder$0040_1), ResultBuilder__Delay_Z494D0C1F(builder$0040_1, () => {
                const matchValue = FSharpMap__TryFind(dependencyGraph, node);
                if (matchValue == null) {
                    return ResultBuilder__Zero(builder$0040_1);
                }
                else {
                    return ResultBuilder__For_47E0214D(builder$0040_1, matchValue, (_arg_1) => ResultBuilder__Bind_764BA1D3(builder$0040_1, visit(cons(node, path), _arg_1), () => ResultBuilder__Return_1505(builder$0040_1, undefined)));
                }
            })));
        };
        return ResultBuilder__For_47E0214D(builder$0040, FSharpMap__get_Keys(ctx.PositionDefinitions), (_arg_3) => ResultBuilder__Bind_764BA1D3(builder$0040, visit(empty(), _arg_3), () => ResultBuilder__Return_1505(builder$0040, undefined)));
    });
}

function getExpressionLookback(expr_mut) {
    getExpressionLookback:
    while (true) {
        const expr = expr_mut;
        switch (expr.tag) {
            case 5: {
                const ind = expr.fields[0];
                const matchValue = ind.Period;
                if (matchValue == null) {
                    const matchValue_1 = ind.IndicatorType;
                    switch (matchValue_1.tag) {
                        case 2:
                            return 14;
                        case 4:
                        case 5:
                            return 1;
                        default:
                            return 20;
                    }
                }
                else {
                    return matchValue | 0;
                }
            }
            case 7:
                return max(getExpressionLookback(expr.fields[1]), getExpressionLookback(expr.fields[2])) | 0;
            case 8: {
                expr_mut = expr.fields[0];
                continue getExpressionLookback;
            }
            case 9: {
                expr_mut = expr.fields[0];
                continue getExpressionLookback;
            }
            case 4: {
                expr_mut = expr.fields[0].Object;
                continue getExpressionLookback;
            }
            default:
                return 0;
        }
        break;
    }
}

function getConditionLookback(cond_mut) {
    getConditionLookback:
    while (true) {
        const cond = cond_mut;
        switch (cond.tag) {
            case 1:
                return max(getConditionLookback(cond.fields[1]), getConditionLookback(cond.fields[2])) | 0;
            case 2: {
                cond_mut = cond.fields[0];
                continue getConditionLookback;
            }
            case 3: {
                cond_mut = cond.fields[0];
                continue getConditionLookback;
            }
            case 4:
                return getExpressionLookback(cond.fields[0]) | 0;
            default:
                return max(getExpressionLookback(cond.fields[1]), getExpressionLookback(cond.fields[2])) | 0;
        }
        break;
    }
}

function getStatementLookback(stmt) {
    switch (stmt.tag) {
        case 1:
            return getExpressionLookback(stmt.fields[0].Value) | 0;
        case 3: {
            const cond = stmt.fields[0];
            return max(getConditionLookback(cond.Condition), fold(max, 0, map_1(getStatementLookback, cond.ThenBlock))) | 0;
        }
        case 4:
            return fold(max, 0, map_1(getStatementLookback, stmt.fields[0].Block)) | 0;
        case 2: {
            const action = stmt.fields[0];
            let matchResult, q;
            switch (action.tag) {
                case 0: {
                    matchResult = 0;
                    q = action.fields[0];
                    break;
                }
                case 1: {
                    matchResult = 0;
                    q = action.fields[0];
                    break;
                }
                default:
                    matchResult = 1;
            }
            switch (matchResult) {
                case 0:
                    if (q.tag === 2) {
                        return getExpressionLookback(q.fields[0]) | 0;
                    }
                    else {
                        return 0;
                    }
                default:
                    return 0;
            }
        }
        default: {
            const matchValue = stmt.fields[0].Value;
            if (matchValue.tag === 1) {
                return 0;
            }
            else {
                return getExpressionLookback(matchValue.fields[0]) | 0;
            }
        }
    }
}

export function calculateMaxLookback(program) {
    return fold(max, 0, map_1(getStatementLookback, program.Statements));
}

export function elaborateProgram(program) {
    const builder$0040 = result;
    return ResultBuilder__Delay_Z494D0C1F(builder$0040, () => ResultBuilder__Bind_764BA1D3(builder$0040, elaborateBlock(emptyContext(), program.Statements), (_arg) => ResultBuilder__Bind_764BA1D3(builder$0040, checkAcyclicPositions(_arg), () => ResultBuilder__Return_1505(builder$0040, program))));
}

