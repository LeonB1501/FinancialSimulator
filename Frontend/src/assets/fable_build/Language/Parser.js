import { FSharpException } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { class_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { reverse, cons, empty, tail as tail_2, head as head_3, isEmpty } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { curry2, Lazy, uncurry2, equals } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { some } from "../fable_modules/fable-library-js.4.27.0/Option.js";
import { Program, DefinitionValue, Action, ActionTarget, PositionExpression, PositionComponent, ForAnyPositionStmt, ConditionalStmt, SetStmt, DefineStmt, Statement, Quantity, LogicalOp, Condition, ComparisonOp, ArithmeticOp, PropertyAccess, Indicator, IndicatorType, PortfolioQuery, Expression, Instrument, Literal, BoolLiteral, NumericLiteral } from "./AST.js";
import { Token } from "./Tokens.js";

export class ParseError extends FSharpException {
    constructor(Data0) {
        super();
        this.Data0 = Data0;
    }
}

export function ParseError_$reflection() {
    return class_type("Parser.ParseError", undefined, ParseError, class_type("System.Exception"));
}

export function pToken(tokenToMatch, tokens) {
    if (isEmpty(tokens)) {
        throw new ParseError(`Expected token '${tokenToMatch}' but found EOF`);
    }
    else if (equals(head_3(tokens), tokenToMatch)) {
        return [head_3(tokens), tail_2(tokens)];
    }
    else {
        throw new ParseError(`Expected token '${tokenToMatch}' but found '${head_3(tokens)}'`);
    }
}

export function op_BarGreaterGreater(parser_1, func, tokens) {
    const patternInput = parser_1(tokens);
    return [func(patternInput[0]), patternInput[1]];
}

export function op_GreaterGreaterEquals(parserA, func, tokens) {
    const patternInput = parserA(tokens);
    return func(patternInput[0], patternInput[1]);
}

export function op_LessBarGreater(parserA, parserB, tokens) {
    try {
        return parserA(tokens);
    }
    catch (matchValue) {
        if (matchValue instanceof ParseError) {
            return parserB(tokens);
        }
        else {
            throw matchValue;
        }
    }
}

export function many(parser_1, tokens) {
    let results = empty();
    let remainingTokens = tokens;
    let continueLoop = true;
    while (continueLoop) {
        try {
            const patternInput = parser_1(remainingTokens);
            results = cons(patternInput[0], results);
            remainingTokens = patternInput[1];
        }
        catch (matchValue) {
            if (matchValue instanceof ParseError) {
                continueLoop = false;
            }
            else {
                throw matchValue;
            }
        }
    }
    return [reverse(results), remainingTokens];
}

export function manyUntilEnd(parser_1, tokens) {
    let results = empty();
    let remainingTokens = tokens;
    let continueLoop = true;
    while (continueLoop) {
        if (isEmpty(remainingTokens)) {
            throw new ParseError("Block not closed with \'end\' - unexpected end of input");
        }
        else {
            switch (head_3(remainingTokens).tag) {
                case 1: {
                    continueLoop = false;
                    break;
                }
                case 44: {
                    throw new ParseError("Block not closed with \'end\' - found EOF");
                    break;
                }
                default:
                    try {
                        const patternInput = parser_1(remainingTokens);
                        results = cons(patternInput[0], results);
                        remainingTokens = patternInput[1];
                    }
                    catch (matchValue) {
                        if (matchValue instanceof ParseError) {
                            throw new ParseError(`Error in statement block: ${matchValue.Data0}`);
                        }
                        else {
                            throw matchValue;
                        }
                    }
            }
        }
    }
    return [reverse(results), remainingTokens];
}

export function optional(parser_1, tokens) {
    try {
        const patternInput = parser_1(tokens);
        return [some(patternInput[0]), patternInput[1]];
    }
    catch (matchValue) {
        if (matchValue instanceof ParseError) {
            return [undefined, tokens];
        }
        else {
            throw matchValue;
        }
    }
}

export class ParserBuilder {
    constructor() {
    }
}

export function ParserBuilder_$reflection() {
    return class_type("Parser.ParserBuilder", undefined, ParserBuilder);
}

export function ParserBuilder_$ctor() {
    return new ParserBuilder();
}

export function ParserBuilder__Bind_4FE343B3(_, p, f) {
    return (tokens) => op_GreaterGreaterEquals(p, f, tokens);
}

export function ParserBuilder__Return_1505(_, x) {
    return (tokens) => [x, tokens];
}

export const parser = ParserBuilder_$ctor();

export function pNumberValue(ts) {
    let matchResult, n, r;
    if (!isEmpty(ts)) {
        if (head_3(ts).tag === 26) {
            matchResult = 0;
            n = head_3(ts).fields[0];
            r = tail_2(ts);
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
            return [n, r];
        default:
            throw new ParseError("Expected number");
    }
}

export function pPercentageValue(ts) {
    let matchResult, p, r;
    if (!isEmpty(ts)) {
        if (head_3(ts).tag === 27) {
            matchResult = 0;
            p = head_3(ts).fields[0];
            r = tail_2(ts);
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
            return [p, r];
        default:
            throw new ParseError("Expected percentage");
    }
}

export function pDollarValue(ts) {
    let matchResult, d, r;
    if (!isEmpty(ts)) {
        if (head_3(ts).tag === 28) {
            matchResult = 0;
            d = head_3(ts).fields[0];
            r = tail_2(ts);
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
            return [d, r];
        default:
            throw new ParseError("Expected dollar amount");
    }
}

export function pIdentifierValue(ts) {
    let matchResult, id, r;
    if (!isEmpty(ts)) {
        if (head_3(ts).tag === 25) {
            matchResult = 0;
            id = head_3(ts).fields[0];
            r = tail_2(ts);
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
            return [id, r];
        default:
            throw new ParseError("Expected identifier");
    }
}

export const parseNumber = (tokens) => op_BarGreaterGreater(pNumberValue, (Item) => (new NumericLiteral(0, [Item])), tokens);

export const parsePercentage = (tokens) => op_BarGreaterGreater(pPercentageValue, (Item) => (new NumericLiteral(1, [Item])), tokens);

export const parseDollar = (tokens) => op_BarGreaterGreater(pDollarValue, (Item) => (new NumericLiteral(2, [Item])), tokens);

export const parseBoolean = (tokens_4) => op_LessBarGreater((tokens_1) => op_BarGreaterGreater((tokens) => pToken(new Token(12, []), tokens), (_arg) => (new BoolLiteral(0, [])), tokens_1), (tokens_3) => op_BarGreaterGreater((tokens_2) => pToken(new Token(13, []), tokens_2), (_arg_1) => (new BoolLiteral(1, [])), tokens_3), tokens_4);

export const parseLiteral = (tokens_6) => op_LessBarGreater((tokens_4) => op_LessBarGreater((tokens_2) => op_LessBarGreater((tokens) => op_BarGreaterGreater(parseNumber, (Item) => (new Literal(0, [Item])), tokens), (tokens_1) => op_BarGreaterGreater(parsePercentage, (Item_1) => (new Literal(0, [Item_1])), tokens_1), tokens_2), (tokens_3) => op_BarGreaterGreater(parseDollar, (Item_2) => (new Literal(0, [Item_2])), tokens_3), tokens_4), (tokens_5) => op_BarGreaterGreater(parseBoolean, (Item_3) => (new Literal(1, [Item_3])), tokens_5), tokens_6);

export const parseIdentifier = pIdentifierValue;

export function parseAssetReference(tokens) {
    if (isEmpty(tokens)) {
        throw new ParseError("Expected asset reference");
    }
    else if (head_3(tokens).tag === 22) {
        return [head_3(tokens).fields[0], tail_2(tokens)];
    }
    else {
        throw new ParseError(`Expected asset reference, found ${head_3(tokens)}`);
    }
}

export function parseOptionSpec(tokens) {
    if (isEmpty(tokens)) {
        throw new ParseError("Expected option spec");
    }
    else if (head_3(tokens).tag === 23) {
        return [head_3(tokens).fields[0], tail_2(tokens)];
    }
    else {
        throw new ParseError(`Expected option spec, found ${head_3(tokens)}`);
    }
}

export const parseInstrument = (tokens_4) => op_LessBarGreater((tokens) => op_BarGreaterGreater(parseAssetReference, (Item) => (new Instrument(0, [Item])), tokens), (tokens_2) => op_BarGreaterGreater(parseOptionSpec, (Item_1) => (new Instrument(1, [Item_1])), tokens_2), tokens_4);

export const pIdentifierOrAsset = (tokens_2) => op_LessBarGreater(pIdentifierValue, (tokens) => op_BarGreaterGreater(parseAssetReference, (ar) => {
    if (ar.tag === 1) {
        return ar.fields[0];
    }
    else {
        return ar.fields[0];
    }
}, tokens), tokens_2);

export function parsePrimaryExpr$0040149() {
    let pParen;
    const builder$0040 = parser;
    pParen = ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(42, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseExpression, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_2) => pToken(new Token(43, []), tokens_2), uncurry2((_arg_2) => ParserBuilder__Return_1505(builder$0040, new Expression(9, [_arg_1]))))))));
    let pQuery;
    let pPosQty;
    const builder$0040_1 = parser;
    pPosQty = ParserBuilder__Bind_4FE343B3(builder$0040_1, (tokens_9) => pToken(new Token(20, []), tokens_9), uncurry2((_arg_3) => ParserBuilder__Bind_4FE343B3(builder$0040_1, (tokens_10) => pToken(new Token(42, []), tokens_10), uncurry2((_arg_4) => ParserBuilder__Bind_4FE343B3(builder$0040_1, pIdentifierOrAsset, uncurry2((_arg_5) => ParserBuilder__Bind_4FE343B3(builder$0040_1, (tokens_11) => pToken(new Token(43, []), tokens_11), uncurry2((_arg_6) => ParserBuilder__Return_1505(builder$0040_1, new PortfolioQuery(2, [_arg_5]))))))))));
    let pPosVal;
    const builder$0040_2 = parser;
    pPosVal = ParserBuilder__Bind_4FE343B3(builder$0040_2, (tokens_12) => pToken(new Token(21, []), tokens_12), uncurry2((_arg_7) => ParserBuilder__Bind_4FE343B3(builder$0040_2, (tokens_13) => pToken(new Token(42, []), tokens_13), uncurry2((_arg_8) => ParserBuilder__Bind_4FE343B3(builder$0040_2, pIdentifierOrAsset, uncurry2((_arg_9) => ParserBuilder__Bind_4FE343B3(builder$0040_2, (tokens_14) => pToken(new Token(43, []), tokens_14), uncurry2((_arg_10) => ParserBuilder__Return_1505(builder$0040_2, new PortfolioQuery(3, [_arg_9]))))))))));
    pQuery = ((tokens_22) => op_BarGreaterGreater((tokens_21) => op_LessBarGreater((tokens_20) => op_LessBarGreater((tokens_19) => op_LessBarGreater((tokens_16) => op_BarGreaterGreater((tokens_15) => pToken(new Token(18, []), tokens_15), (_arg_11) => (new PortfolioQuery(0, [])), tokens_16), (tokens_18) => op_BarGreaterGreater((tokens_17) => pToken(new Token(19, []), tokens_17), (_arg_12) => (new PortfolioQuery(1, [])), tokens_18), tokens_19), pPosQty, tokens_20), pPosVal, tokens_21), (Item_3) => (new Expression(6, [Item_3])), tokens_22));
    return (tokens_31) => op_GreaterGreaterEquals((tokens_29) => op_LessBarGreater((tokens_28) => op_LessBarGreater((tokens_27) => op_LessBarGreater((tokens_26) => op_LessBarGreater((tokens_25) => op_LessBarGreater((tokens_24) => op_LessBarGreater(pParen, (tokens_3) => op_BarGreaterGreater(parseLiteral, (Item) => (new Expression(0, [Item])), tokens_3), tokens_24), (tokens_4) => op_BarGreaterGreater((ts) => {
        let matchResult, d, r;
        if (!isEmpty(ts)) {
            if (head_3(ts).tag === 24) {
                matchResult = 0;
                d = head_3(ts).fields[0];
                r = tail_2(ts);
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
                return [d, r];
            default:
                throw new ParseError("Expected indicator");
        }
    }, (indicatorData) => {
        let matchValue;
        return new Expression(5, [new Indicator(indicatorData.Asset, (matchValue = indicatorData.TypeName.toLocaleLowerCase(), (matchValue === "sma") ? (new IndicatorType(0, [])) : ((matchValue === "ema") ? (new IndicatorType(1, [])) : ((matchValue === "rsi") ? (new IndicatorType(2, [])) : ((matchValue === "vol") ? (new IndicatorType(3, [])) : ((matchValue === "return") ? (new IndicatorType(4, [])) : ((matchValue === "pastprice") ? (new IndicatorType(5, [])) : (() => {
            throw new ParseError(`Invalid indicator type '${matchValue}'`);
        })())))))), indicatorData.Period)]);
    }, tokens_4), tokens_25), (tokens_5) => op_BarGreaterGreater(parseAssetReference, (Item_1) => (new Expression(2, [Item_1])), tokens_5), tokens_26), (tokens_7) => op_BarGreaterGreater(parseOptionSpec, (Item_2) => (new Expression(3, [Item_2])), tokens_7), tokens_27), pQuery, tokens_28), (tokens_23) => op_BarGreaterGreater(pIdentifierValue, (Item_4) => (new Expression(1, [Item_4])), tokens_23), tokens_29), (baseExpr, tokens_30) => {
        const loop = (acc_mut, remainingTokens_mut) => {
            loop:
            while (true) {
                const acc = acc_mut, remainingTokens = remainingTokens_mut;
                let matchResult_1, prop, rest$0027;
                if (!isEmpty(remainingTokens)) {
                    if (head_3(remainingTokens).tag === 41) {
                        if (!isEmpty(tail_2(remainingTokens))) {
                            if (head_3(tail_2(remainingTokens)).tag === 25) {
                                matchResult_1 = 0;
                                prop = head_3(tail_2(remainingTokens)).fields[0];
                                rest$0027 = tail_2(tail_2(remainingTokens));
                            }
                            else {
                                matchResult_1 = 1;
                            }
                        }
                        else {
                            matchResult_1 = 1;
                        }
                    }
                    else {
                        matchResult_1 = 1;
                    }
                }
                else {
                    matchResult_1 = 1;
                }
                switch (matchResult_1) {
                    case 0: {
                        acc_mut = (new Expression(4, [new PropertyAccess(acc, prop)]));
                        remainingTokens_mut = rest$0027;
                        continue loop;
                    }
                    default:
                        return [acc, remainingTokens];
                }
                break;
            }
        };
        return loop(baseExpr, tokens_30);
    }, tokens_31);
}

export const parsePrimaryExpr$0040149$002D1 = new Lazy(parsePrimaryExpr$0040149);

export function parseUnaryExpr$0040203() {
    const parserB = parsePrimaryExpr$0040149$002D1.Value;
    return (tokens_3) => op_LessBarGreater((tokens_2) => op_GreaterGreaterEquals((tokens) => pToken(new Token(30, []), tokens), uncurry2((_arg) => {
        const parser_1 = parsePrimaryExpr$0040149$002D1.Value;
        return (tokens_1) => op_BarGreaterGreater(parser_1, (Item) => (new Expression(8, [Item])), tokens_1);
    }), tokens_2), parserB, tokens_3);
}

export const parseUnaryExpr$0040203$002D1 = new Lazy(parseUnaryExpr$0040203);

export function parseMultiplicativeExpr$0040206() {
    const parserA_2 = parseUnaryExpr$0040203$002D1.Value;
    return (tokens_11) => op_GreaterGreaterEquals(parserA_2, uncurry2((left) => {
        const loop = (currentLeft_mut, tokens_8_mut) => {
            loop:
            while (true) {
                const currentLeft = currentLeft_mut, tokens_8 = tokens_8_mut;
                const matchValue = optional((tokens_10) => op_GreaterGreaterEquals((tokens_7) => op_LessBarGreater((tokens_4) => op_LessBarGreater((tokens_1) => op_BarGreaterGreater((tokens) => pToken(new Token(31, []), tokens), (_arg) => (new ArithmeticOp(2, [])), tokens_1), (tokens_3) => op_BarGreaterGreater((tokens_2) => pToken(new Token(32, []), tokens_2), (_arg_1) => (new ArithmeticOp(3, [])), tokens_3), tokens_4), (tokens_6) => op_BarGreaterGreater((tokens_5) => pToken(new Token(33, []), tokens_5), (_arg_2) => (new ArithmeticOp(4, [])), tokens_6), tokens_7), uncurry2((op) => {
                    const parser_4 = parseUnaryExpr$0040203$002D1.Value;
                    return (tokens_9) => op_BarGreaterGreater(parser_4, (right) => [op, right], tokens_9);
                }), tokens_10), tokens_8);
                if (matchValue[0] == null) {
                    return [currentLeft, tokens_8];
                }
                else {
                    currentLeft_mut = (new Expression(7, [matchValue[0][0], currentLeft, matchValue[0][1]]));
                    tokens_8_mut = matchValue[1];
                    continue loop;
                }
                break;
            }
        };
        return curry2(loop)(left);
    }), tokens_11);
}

export const parseMultiplicativeExpr$0040206$002D1 = new Lazy(parseMultiplicativeExpr$0040206);

export function parseAdditiveExpr$0040217() {
    const parserA_1 = parseMultiplicativeExpr$0040206$002D1.Value;
    return (tokens_8) => op_GreaterGreaterEquals(parserA_1, uncurry2((left) => {
        const loop = (currentLeft_mut, tokens_5_mut) => {
            loop:
            while (true) {
                const currentLeft = currentLeft_mut, tokens_5 = tokens_5_mut;
                const matchValue = optional((tokens_7) => op_GreaterGreaterEquals((tokens_4) => op_LessBarGreater((tokens_1) => op_BarGreaterGreater((tokens) => pToken(new Token(29, []), tokens), (_arg) => (new ArithmeticOp(0, [])), tokens_1), (tokens_3) => op_BarGreaterGreater((tokens_2) => pToken(new Token(30, []), tokens_2), (_arg_1) => (new ArithmeticOp(1, [])), tokens_3), tokens_4), uncurry2((op) => {
                    const parser_3 = parseMultiplicativeExpr$0040206$002D1.Value;
                    return (tokens_6) => op_BarGreaterGreater(parser_3, (right) => [op, right], tokens_6);
                }), tokens_7), tokens_5);
                if (matchValue[0] == null) {
                    return [currentLeft, tokens_5];
                }
                else {
                    currentLeft_mut = (new Expression(7, [matchValue[0][0], currentLeft, matchValue[0][1]]));
                    tokens_5_mut = matchValue[1];
                    continue loop;
                }
                break;
            }
        };
        return curry2(loop)(left);
    }), tokens_8);
}

export const parseAdditiveExpr$0040217$002D1 = new Lazy(parseAdditiveExpr$0040217);

export function parseComparison$0040227() {
    return (tokens_22) => op_GreaterGreaterEquals(parseExpression, (left, tokens_21) => op_GreaterGreaterEquals((tokens_18) => optional((tokens_17) => op_LessBarGreater((tokens_14) => op_LessBarGreater((tokens_11) => op_LessBarGreater((tokens_8) => op_LessBarGreater((tokens_5) => op_LessBarGreater((tokens_2) => op_BarGreaterGreater((tokens_1) => pToken(new Token(34, []), tokens_1), (_arg) => (new ComparisonOp(0, [])), tokens_2), (tokens_4) => op_BarGreaterGreater((tokens_3) => pToken(new Token(35, []), tokens_3), (_arg_1) => (new ComparisonOp(1, [])), tokens_4), tokens_5), (tokens_7) => op_BarGreaterGreater((tokens_6) => pToken(new Token(36, []), tokens_6), (_arg_2) => (new ComparisonOp(2, [])), tokens_7), tokens_8), (tokens_10) => op_BarGreaterGreater((tokens_9) => pToken(new Token(37, []), tokens_9), (_arg_3) => (new ComparisonOp(3, [])), tokens_10), tokens_11), (tokens_13) => op_BarGreaterGreater((tokens_12) => pToken(new Token(38, []), tokens_12), (_arg_4) => (new ComparisonOp(4, [])), tokens_13), tokens_14), (tokens_16) => op_BarGreaterGreater((tokens_15) => pToken(new Token(39, []), tokens_15), (_arg_5) => (new ComparisonOp(5, [])), tokens_16), tokens_17), tokens_18), uncurry2((opOpt) => {
        if (opOpt == null) {
            let matchResult;
            switch (left.tag) {
                case 0: {
                    if (left.fields[0].tag === 1) {
                        matchResult = 0;
                    }
                    else {
                        matchResult = 2;
                    }
                    break;
                }
                case 1: {
                    matchResult = 1;
                    break;
                }
                default:
                    matchResult = 2;
            }
            switch (matchResult) {
                case 0:
                    return (ts) => [new Condition(4, [left]), ts];
                case 1:
                    return (ts_1) => [new Condition(4, [left]), ts_1];
                default:
                    return (_arg_6) => {
                        throw new ParseError("Expected comparison operator after expression in condition");
                    };
            }
        }
        else {
            const op = opOpt;
            return (tokens_20) => op_BarGreaterGreater(parseExpression, (right) => (new Condition(0, [op, left, right])), tokens_20);
        }
    }), tokens_21), tokens_22);
}

export const parseComparison$0040227$002D1 = new Lazy(parseComparison$0040227);

export function parsePrimaryCond$0040243() {
    let pParen;
    const builder$0040 = parser;
    pParen = ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(42, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseCondition, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_2) => pToken(new Token(43, []), tokens_2), uncurry2((_arg_2) => ParserBuilder__Return_1505(builder$0040, new Condition(3, [_arg_1]))))))));
    const parserB = parseComparison$0040227$002D1.Value;
    return (tokens_7) => op_LessBarGreater((tokens_6) => op_LessBarGreater((tokens_5) => op_GreaterGreaterEquals((tokens_3) => pToken(new Token(17, []), tokens_3), uncurry2((_arg_3) => {
        const parser_1 = parsePrimaryCond$0040243$002D1.Value;
        return (tokens_4) => op_BarGreaterGreater(parser_1, (Item) => (new Condition(2, [Item])), tokens_4);
    }), tokens_5), pParen, tokens_6), parserB, tokens_7);
}

export const parsePrimaryCond$0040243$002D1 = new Lazy(parsePrimaryCond$0040243);

export function parseLogicalAndCond$0040252() {
    const parserA = parsePrimaryCond$0040243$002D1.Value;
    return (tokens_3) => op_GreaterGreaterEquals(parserA, uncurry2((left) => {
        const loop = (currentLeft_mut, tokens_mut) => {
            loop:
            while (true) {
                const currentLeft = currentLeft_mut, tokens = tokens_mut;
                const matchValue = optional((tokens_2) => op_GreaterGreaterEquals((tokens_1) => pToken(new Token(15, []), tokens_1), uncurry2((_arg) => parsePrimaryCond$0040243$002D1.Value), tokens_2), tokens);
                if (matchValue[0] == null) {
                    return [currentLeft, tokens];
                }
                else {
                    currentLeft_mut = (new Condition(1, [new LogicalOp(0, []), currentLeft, matchValue[0]]));
                    tokens_mut = matchValue[1];
                    continue loop;
                }
                break;
            }
        };
        return curry2(loop)(left);
    }), tokens_3);
}

export const parseLogicalAndCond$0040252$002D1 = new Lazy(parseLogicalAndCond$0040252);

export function parseLogicalOrCond$0040261() {
    const parserA = parseLogicalAndCond$0040252$002D1.Value;
    return (tokens_3) => op_GreaterGreaterEquals(parserA, uncurry2((left) => {
        const loop = (currentLeft_mut, tokens_mut) => {
            loop:
            while (true) {
                const currentLeft = currentLeft_mut, tokens = tokens_mut;
                const matchValue = optional((tokens_2) => op_GreaterGreaterEquals((tokens_1) => pToken(new Token(16, []), tokens_1), uncurry2((_arg) => parseLogicalAndCond$0040252$002D1.Value), tokens_2), tokens);
                if (matchValue[0] == null) {
                    return [currentLeft, tokens];
                }
                else {
                    currentLeft_mut = (new Condition(1, [new LogicalOp(1, []), currentLeft, matchValue[0]]));
                    tokens_mut = matchValue[1];
                    continue loop;
                }
                break;
            }
        };
        return curry2(loop)(left);
    }), tokens_3);
}

export const parseLogicalOrCond$0040261$002D1 = new Lazy(parseLogicalOrCond$0040261);

export function parseExpression(tokens) {
    return parseAdditiveExpr$0040217$002D1.Value(tokens);
}

export function parseQuantity(tokens) {
    if (isEmpty(tokens)) {
        throw new ParseError("Expected quantity, found EOF");
    }
    else {
        switch (head_3(tokens).tag) {
            case 42: {
                const patternInput = parseExpression(tokens);
                return [new Quantity(2, [patternInput[0]]), patternInput[1]];
            }
            case 26: {
                const patternInput_1 = parseNumber(tokens);
                return [new Quantity(0, [patternInput_1[0]]), patternInput_1[1]];
            }
            case 27: {
                const patternInput_2 = parsePercentage(tokens);
                return [new Quantity(0, [patternInput_2[0]]), patternInput_2[1]];
            }
            case 28: {
                const patternInput_3 = parseDollar(tokens);
                return [new Quantity(0, [patternInput_3[0]]), patternInput_3[1]];
            }
            case 25: {
                const patternInput_4 = parseIdentifier(tokens);
                return [new Quantity(1, [patternInput_4[0]]), patternInput_4[1]];
            }
            default:
                throw new ParseError(`Expected quantity, found ${head_3(tokens)}`);
        }
    }
}

export const parsePrimaryExpr = parsePrimaryExpr$0040149$002D1.Value;

export const parseUnaryExpr = parseUnaryExpr$0040203$002D1.Value;

export const parseMultiplicativeExpr = parseMultiplicativeExpr$0040206$002D1.Value;

export const parseAdditiveExpr = parseAdditiveExpr$0040217$002D1.Value;

export const parseComparison = parseComparison$0040227$002D1.Value;

export const parsePrimaryCond = parsePrimaryCond$0040243$002D1.Value;

export const parseLogicalAndCond = parseLogicalAndCond$0040252$002D1.Value;

export function parseCondition(tokens) {
    return parseLogicalOrCond$0040261$002D1.Value(tokens);
}

export const parseLogicalOrCond = parseLogicalOrCond$0040261$002D1.Value;

export function parseStatement$0040271() {
    let parserA_3;
    let parserA_2;
    let parserA_1;
    let parserA;
    const parser_1 = parseDefineStatement$0040304$002D1.Value;
    parserA = ((tokens) => op_BarGreaterGreater(parser_1, (Item) => (new Statement(0, [Item])), tokens));
    let parserB;
    const parser_2 = parseSetStatement$0040312$002D1.Value;
    parserB = ((tokens_1) => op_BarGreaterGreater(parser_2, (Item_1) => (new Statement(1, [Item_1])), tokens_1));
    parserA_1 = ((tokens_2) => op_LessBarGreater(parserA, parserB, tokens_2));
    let parserB_1;
    const parser_3 = parseConditionalStatement$0040321$002D1.Value;
    parserB_1 = ((tokens_3) => op_BarGreaterGreater(parser_3, (Item_2) => (new Statement(3, [Item_2])), tokens_3));
    parserA_2 = ((tokens_4) => op_LessBarGreater(parserA_1, parserB_1, tokens_4));
    let parserB_2;
    const parser_4 = parseForAnyPositionStatement$0040330$002D1.Value;
    parserB_2 = ((tokens_5) => op_BarGreaterGreater(parser_4, (Item_3) => (new Statement(4, [Item_3])), tokens_5));
    parserA_3 = ((tokens_6) => op_LessBarGreater(parserA_2, parserB_2, tokens_6));
    let parserB_3;
    const parser_5 = parseActionStatement$0040365$002D1.Value;
    parserB_3 = ((tokens_7) => op_BarGreaterGreater(parser_5, (Item_4) => (new Statement(2, [Item_4])), tokens_7));
    return (tokens_8) => op_LessBarGreater(parserA_3, parserB_3, tokens_8);
}

export const parseStatement$0040271$002D1 = new Lazy(parseStatement$0040271);

export function parseDefineStatement$0040304() {
    const builder$0040 = parser;
    return ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(9, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseIdentifier, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_1) => pToken(new Token(3, []), tokens_1), uncurry2((_arg_2) => ParserBuilder__Bind_4FE343B3(builder$0040, parseDefinitionValue, uncurry2((_arg_3) => ParserBuilder__Return_1505(builder$0040, new DefineStmt(_arg_1, _arg_3))))))))));
}

export const parseDefineStatement$0040304$002D1 = new Lazy(parseDefineStatement$0040304);

export function parseSetStatement$0040312() {
    const builder$0040 = parser;
    return ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(10, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseIdentifier, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_1) => pToken(new Token(11, []), tokens_1), uncurry2((_arg_2) => ParserBuilder__Bind_4FE343B3(builder$0040, parseExpression, uncurry2((_arg_3) => ParserBuilder__Return_1505(builder$0040, new SetStmt(_arg_1, _arg_3))))))))));
}

export const parseSetStatement$0040312$002D1 = new Lazy(parseSetStatement$0040312);

export function parseStatementBlock$0040320() {
    const parser_1 = parseStatement$0040271$002D1.Value;
    return (tokens) => manyUntilEnd(parser_1, tokens);
}

export const parseStatementBlock$0040320$002D1 = new Lazy(parseStatementBlock$0040320);

export function parseConditionalStatement$0040321() {
    const builder$0040 = parser;
    return ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(0, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseCondition, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_2) => pToken(new Token(40, []), tokens_2), uncurry2((_arg_2) => ParserBuilder__Bind_4FE343B3(builder$0040, parseStatementBlock$0040320$002D1.Value, uncurry2((_arg_3) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_3) => pToken(new Token(1, []), tokens_3), uncurry2((_arg_4) => ParserBuilder__Return_1505(builder$0040, new ConditionalStmt(_arg_1, _arg_3))))))))))));
}

export const parseConditionalStatement$0040321$002D1 = new Lazy(parseConditionalStatement$0040321);

export function parseForAnyPositionStatement$0040330() {
    const builder$0040 = parser;
    return ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(2, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, pIdentifierOrAsset, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_1) => pToken(new Token(3, []), tokens_1), uncurry2((_arg_2) => ParserBuilder__Bind_4FE343B3(builder$0040, parseIdentifier, uncurry2((_arg_3) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_2) => pToken(new Token(40, []), tokens_2), uncurry2((_arg_4) => ParserBuilder__Bind_4FE343B3(builder$0040, parseStatementBlock$0040320$002D1.Value, uncurry2((_arg_5) => ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_3) => pToken(new Token(1, []), tokens_3), uncurry2((_arg_6) => ParserBuilder__Return_1505(builder$0040, new ForAnyPositionStmt(_arg_1, _arg_3, _arg_5))))))))))))))));
}

export const parseForAnyPositionStatement$0040330$002D1 = new Lazy(parseForAnyPositionStatement$0040330);

export function parsePositionComponent$0040341() {
    const builder$0040 = parser;
    return ParserBuilder__Bind_4FE343B3(builder$0040, (tokens_4) => op_LessBarGreater((tokens_1) => op_BarGreaterGreater((tokens) => pToken(new Token(4, []), tokens), (_arg) => ((q) => ((i) => (new PositionComponent(0, [q, i])))), tokens_1), (tokens_3) => op_BarGreaterGreater((tokens_2) => pToken(new Token(5, []), tokens_2), (_arg_1) => ((q_1) => ((i_1) => (new PositionComponent(1, [q_1, i_1])))), tokens_3), tokens_4), uncurry2((_arg_2) => ParserBuilder__Bind_4FE343B3(builder$0040, parseQuantity, uncurry2((_arg_3) => ParserBuilder__Bind_4FE343B3(builder$0040, parseInstrument, uncurry2((_arg_4) => ParserBuilder__Return_1505(builder$0040, _arg_2(_arg_3)(_arg_4))))))));
}

export const parsePositionComponent$0040341$002D1 = new Lazy(parsePositionComponent$0040341);

export function parsePositionExpression$0040350() {
    let pComponentExpr;
    const parser_1 = parsePositionComponent$0040341$002D1.Value;
    pComponentExpr = ((tokens) => op_BarGreaterGreater(parser_1, (Item) => (new PositionExpression(0, [Item])), tokens));
    const pReferenceExpr = (tokens_1) => op_BarGreaterGreater(parseIdentifier, (Item_1) => (new PositionExpression(2, [Item_1])), tokens_1);
    return (tokens_7) => op_GreaterGreaterEquals((tokens_2) => op_LessBarGreater(pComponentExpr, pReferenceExpr, tokens_2), uncurry2((left) => {
        const loop = (currentLeft_mut, tokens_3_mut) => {
            loop:
            while (true) {
                const currentLeft = currentLeft_mut, tokens_3 = tokens_3_mut;
                const matchValue = optional((tokens_6) => op_GreaterGreaterEquals((tokens_4) => pToken(new Token(15, []), tokens_4), (_arg, tokens_5) => op_LessBarGreater(pComponentExpr, pReferenceExpr, tokens_5), tokens_6), tokens_3);
                if (matchValue[0] == null) {
                    return [currentLeft, tokens_3];
                }
                else {
                    currentLeft_mut = (new PositionExpression(1, [currentLeft, matchValue[0]]));
                    tokens_3_mut = matchValue[1];
                    continue loop;
                }
                break;
            }
        };
        return curry2(loop)(left);
    }), tokens_7);
}

export const parsePositionExpression$0040350$002D1 = new Lazy(parsePositionExpression$0040350);

export function parseActionTarget$0040362() {
    return (tokens_3) => op_LessBarGreater((tokens) => op_BarGreaterGreater(parseAssetReference, (Item) => (new ActionTarget(0, [Item])), tokens), (tokens_2) => op_BarGreaterGreater(parseIdentifier, (Item_1) => (new ActionTarget(1, [Item_1])), tokens_2), tokens_3);
}

export const parseActionTarget$0040362$002D1 = new Lazy(parseActionTarget$0040362);

export function parseActionStatement$0040365() {
    let pBuy;
    const builder$0040 = parser;
    pBuy = ParserBuilder__Bind_4FE343B3(builder$0040, (tokens) => pToken(new Token(4, []), tokens), uncurry2((_arg) => ParserBuilder__Bind_4FE343B3(builder$0040, parseQuantity, uncurry2((_arg_1) => ParserBuilder__Bind_4FE343B3(builder$0040, parseActionTarget$0040362$002D1.Value, uncurry2((_arg_2) => ParserBuilder__Return_1505(builder$0040, new Action(0, [_arg_1, _arg_2]))))))));
    let pSell;
    const builder$0040_1 = parser;
    pSell = ParserBuilder__Bind_4FE343B3(builder$0040_1, (tokens_2) => pToken(new Token(5, []), tokens_2), uncurry2((_arg_3) => ParserBuilder__Bind_4FE343B3(builder$0040_1, parseQuantity, uncurry2((_arg_4) => ParserBuilder__Bind_4FE343B3(builder$0040_1, parseActionTarget$0040362$002D1.Value, uncurry2((_arg_5) => ParserBuilder__Return_1505(builder$0040_1, new Action(1, [_arg_4, _arg_5]))))))));
    let pBuyMax;
    const builder$0040_2 = parser;
    pBuyMax = ParserBuilder__Bind_4FE343B3(builder$0040_2, (tokens_4) => pToken(new Token(6, []), tokens_4), uncurry2((_arg_6) => ParserBuilder__Bind_4FE343B3(builder$0040_2, parseActionTarget$0040362$002D1.Value, uncurry2((_arg_7) => ParserBuilder__Return_1505(builder$0040_2, new Action(2, [_arg_7]))))));
    let pSellAll;
    const builder$0040_3 = parser;
    pSellAll = ParserBuilder__Bind_4FE343B3(builder$0040_3, (tokens_5) => pToken(new Token(7, []), tokens_5), uncurry2((_arg_8) => ParserBuilder__Bind_4FE343B3(builder$0040_3, parseActionTarget$0040362$002D1.Value, uncurry2((_arg_9) => ParserBuilder__Return_1505(builder$0040_3, new Action(3, [_arg_9]))))));
    let pRebalance;
    const builder$0040_4 = parser;
    pRebalance = ParserBuilder__Bind_4FE343B3(builder$0040_4, (tokens_6) => pToken(new Token(8, []), tokens_6), uncurry2((_arg_10) => ParserBuilder__Bind_4FE343B3(builder$0040_4, pPercentageValue, uncurry2((_arg_11) => ParserBuilder__Bind_4FE343B3(builder$0040_4, parseActionTarget$0040362$002D1.Value, uncurry2((_arg_12) => ParserBuilder__Return_1505(builder$0040_4, new Action(4, [_arg_11, _arg_12]))))))));
    return (tokens_10) => op_LessBarGreater((tokens_9) => op_LessBarGreater((tokens_8) => op_LessBarGreater((tokens_7) => op_LessBarGreater(pBuy, pSell, tokens_7), pBuyMax, tokens_8), pSellAll, tokens_9), pRebalance, tokens_10);
}

export const parseActionStatement$0040365$002D1 = new Lazy(parseActionStatement$0040365);

export const parseStatement = parseStatement$0040271$002D1.Value;

export function parseDefinitionValue(tokens) {
    let matchResult;
    if (!isEmpty(tokens)) {
        switch (head_3(tokens).tag) {
            case 4:
            case 5: {
                matchResult = 0;
                break;
            }
            default:
                matchResult = 1;
        }
    }
    else {
        matchResult = 1;
    }
    switch (matchResult) {
        case 0: {
            const patternInput = parsePositionExpression$0040350$002D1.Value(tokens);
            return [new DefinitionValue(1, [patternInput[0]]), patternInput[1]];
        }
        default:
            try {
                const patternInput_1 = parseExpression(tokens);
                const rest_1 = patternInput_1[1];
                let matchResult_1;
                if (!isEmpty(rest_1)) {
                    if (head_3(rest_1).tag === 15) {
                        matchResult_1 = 0;
                    }
                    else {
                        matchResult_1 = 1;
                    }
                }
                else {
                    matchResult_1 = 1;
                }
                switch (matchResult_1) {
                    case 0: {
                        const patternInput_2 = parsePositionExpression$0040350$002D1.Value(tokens);
                        return [new DefinitionValue(1, [patternInput_2[0]]), patternInput_2[1]];
                    }
                    default:
                        return [new DefinitionValue(0, [patternInput_1[0]]), rest_1];
                }
            }
            catch (matchValue) {
                if (matchValue instanceof ParseError) {
                    const patternInput_3 = parsePositionExpression$0040350$002D1.Value(tokens);
                    return [new DefinitionValue(1, [patternInput_3[0]]), patternInput_3[1]];
                }
                else {
                    throw matchValue;
                }
            }
    }
}

export const parseDefineStatement = parseDefineStatement$0040304$002D1.Value;

export const parseSetStatement = parseSetStatement$0040312$002D1.Value;

export const parseStatementBlock = parseStatementBlock$0040320$002D1.Value;

export const parseConditionalStatement = parseConditionalStatement$0040321$002D1.Value;

export const parseForAnyPositionStatement = parseForAnyPositionStatement$0040330$002D1.Value;

export const parsePositionComponent = parsePositionComponent$0040341$002D1.Value;

export const parsePositionExpression = parsePositionExpression$0040350$002D1.Value;

export const parseActionTarget = parseActionTarget$0040362$002D1.Value;

export const parseActionStatement = parseActionStatement$0040365$002D1.Value;

export const parseProgram = (tokens_1) => op_BarGreaterGreater((tokens) => many(parseStatement, tokens), (stmts) => (new Program(stmts)), tokens_1);

export function run(tokens) {
    const patternInput = parseProgram(tokens);
    const rest = patternInput[1];
    let matchResult, t;
    if (isEmpty(rest)) {
        matchResult = 0;
    }
    else if (head_3(rest).tag === 44) {
        if (isEmpty(tail_2(rest))) {
            matchResult = 0;
        }
        else {
            matchResult = 1;
            t = head_3(rest);
        }
    }
    else {
        matchResult = 1;
        t = head_3(rest);
    }
    switch (matchResult) {
        case 0:
            return patternInput[0];
        default:
            throw new ParseError(`Unexpected token '${t}' after end of program.`);
    }
}

