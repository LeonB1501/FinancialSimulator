import { FSharpRef, FSharpException } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { class_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { tryFind, ofList } from "../fable_modules/fable-library-js.4.27.0/Map.js";
import { IndicatorData, Token } from "./Tokens.js";
import { ofSeq, singleton, empty, tail as tail_2, head as head_2, isEmpty, reverse, cons, toArray, ofArray } from "../fable_modules/fable-library-js.4.27.0/List.js";
import { comparePrimitives } from "../fable_modules/fable-library-js.4.27.0/Util.js";
import { isNullOrEmpty, join, substring, split } from "../fable_modules/fable-library-js.4.27.0/String.js";
import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";
import { parse, tryParse } from "../fable_modules/fable-library-js.4.27.0/Double.js";
import { OptionSpec, GreekType, AssetReference } from "./AST.js";
import { isLetter, isWhiteSpace, isLetterOrDigit, isDigit } from "../fable_modules/fable-library-js.4.27.0/Char.js";
import { match } from "../fable_modules/fable-library-js.4.27.0/RegExp.js";
import { parse as parse_1 } from "../fable_modules/fable-library-js.4.27.0/Int32.js";
import { FSharpSet__Contains } from "../fable_modules/fable-library-js.4.27.0/Set.js";

export class LexerError extends FSharpException {
    constructor(Data0) {
        super();
        this.Data0 = Data0;
    }
}

export function LexerError_$reflection() {
    return class_type("Lexer.LexerError", undefined, LexerError, class_type("System.Exception"));
}

export function lex(tickerSet, input) {
    const keywords = ofList(ofArray([["when", new Token(0, [])], ["end", new Token(1, [])], ["for_any_position", new Token(2, [])], ["as", new Token(3, [])], ["buy", new Token(4, [])], ["sell", new Token(5, [])], ["buy_max", new Token(6, [])], ["sell_all", new Token(7, [])], ["rebalance_to", new Token(8, [])], ["define", new Token(9, [])], ["set", new Token(10, [])], ["to", new Token(11, [])], ["true", new Token(12, [])], ["false", new Token(13, [])], ["t_bills", new Token(14, [])], ["and", new Token(15, [])], ["or", new Token(16, [])], ["not", new Token(17, [])], ["cash_available", new Token(18, [])], ["portfolio_value", new Token(19, [])], ["position_quantity", new Token(20, [])], ["position_value", new Token(21, [])]]), {
        Compare: comparePrimitives,
    });
    const charsToString = (chars) => (toArray(chars).join(''));
    const readWhile = (predicate, chars_1) => {
        const loop = (acc_mut, remaining_mut) => {
            loop:
            while (true) {
                const acc = acc_mut, remaining = remaining_mut;
                let matchResult, head_1, tail_1;
                if (!isEmpty(remaining)) {
                    if (predicate(head_2(remaining))) {
                        matchResult = 0;
                        head_1 = head_2(remaining);
                        tail_1 = tail_2(remaining);
                    }
                    else {
                        matchResult = 1;
                    }
                }
                else {
                    matchResult = 1;
                }
                switch (matchResult) {
                    case 0: {
                        acc_mut = cons(head_1, acc);
                        remaining_mut = tail_1;
                        continue loop;
                    }
                    default:
                        return [charsToString(reverse(acc)), remaining];
                }
                break;
            }
        };
        return loop(empty(), chars_1);
    };
    const parseAssetReferenceFromString = (id) => {
        const parts = split(id, ["_"], undefined, 0);
        if ((parts.length >= 2) && item(parts.length - 1, parts).endsWith("x")) {
            const lastPart = item(parts.length - 1, parts);
            if (lastPart.startsWith("minus") && (lastPart.length > 6)) {
                let matchValue;
                let outArg = 0;
                matchValue = [tryParse(substring(lastPart, 5, lastPart.length - 6), new FSharpRef(() => outArg, (v) => {
                    outArg = v;
                })), outArg];
                if (matchValue[0]) {
                    return new AssetReference(1, [join("_", parts.slice(0, (parts.length - 2) + 1)), -matchValue[1]]);
                }
                else {
                    return new AssetReference(0, [id]);
                }
            }
            else {
                let matchValue_1;
                let outArg_1 = 0;
                matchValue_1 = [tryParse(substring(lastPart, 0, lastPart.length - 1), new FSharpRef(() => outArg_1, (v_1) => {
                    outArg_1 = v_1;
                })), outArg_1];
                if (matchValue_1[0]) {
                    return new AssetReference(1, [join("_", parts.slice(0, (parts.length - 2) + 1)), matchValue_1[1]]);
                }
                else {
                    return new AssetReference(0, [id]);
                }
            }
        }
        else {
            return new AssetReference(0, [id]);
        }
    };
    const lex$0027 = (chars_2_mut) => {
        let c_1, c_3, c_5, c_7, c_9;
        lex$0027:
        while (true) {
            const chars_2 = chars_2_mut;
            let matchResult_1, c_11, rest_1, rest_2, rest_3, rest_4, rest_5, rest_6, rest_7, rest_8, rest_9, rest_10, rest_11, rest_12, rest_13, rest_14, rest_15, rest_16, c_13, c_14, c_15;
            if (!isEmpty(chars_2)) {
                if (isWhiteSpace(head_2(chars_2))) {
                    matchResult_1 = 1;
                    c_11 = head_2(chars_2);
                    rest_1 = tail_2(chars_2);
                }
                else {
                    switch (head_2(chars_2)) {
                        case "!": {
                            if (!isEmpty(tail_2(chars_2))) {
                                if (head_2(tail_2(chars_2)) === "=") {
                                    matchResult_1 = 13;
                                    rest_13 = tail_2(tail_2(chars_2));
                                }
                                else if ((c_1 = head_2(chars_2), isDigit(c_1) ? true : (c_1 === "-"))) {
                                    matchResult_1 = 17;
                                    c_13 = head_2(chars_2);
                                }
                                else if (isLetter(head_2(chars_2))) {
                                    matchResult_1 = 18;
                                    c_14 = head_2(chars_2);
                                }
                                else {
                                    matchResult_1 = 19;
                                    c_15 = head_2(chars_2);
                                }
                            }
                            else if ((c_3 = head_2(chars_2), isDigit(c_3) ? true : (c_3 === "-"))) {
                                matchResult_1 = 17;
                                c_13 = head_2(chars_2);
                            }
                            else if (isLetter(head_2(chars_2))) {
                                matchResult_1 = 18;
                                c_14 = head_2(chars_2);
                            }
                            else {
                                matchResult_1 = 19;
                                c_15 = head_2(chars_2);
                            }
                            break;
                        }
                        case "$": {
                            matchResult_1 = 16;
                            rest_16 = tail_2(chars_2);
                            break;
                        }
                        case "%": {
                            matchResult_1 = 9;
                            rest_9 = tail_2(chars_2);
                            break;
                        }
                        case "(": {
                            matchResult_1 = 2;
                            rest_2 = tail_2(chars_2);
                            break;
                        }
                        case ")": {
                            matchResult_1 = 3;
                            rest_3 = tail_2(chars_2);
                            break;
                        }
                        case "*": {
                            matchResult_1 = 7;
                            rest_7 = tail_2(chars_2);
                            break;
                        }
                        case "+": {
                            matchResult_1 = 6;
                            rest_6 = tail_2(chars_2);
                            break;
                        }
                        case ".": {
                            matchResult_1 = 5;
                            rest_5 = tail_2(chars_2);
                            break;
                        }
                        case "/": {
                            matchResult_1 = 8;
                            rest_8 = tail_2(chars_2);
                            break;
                        }
                        case ":": {
                            matchResult_1 = 4;
                            rest_4 = tail_2(chars_2);
                            break;
                        }
                        case "<": {
                            if (!isEmpty(tail_2(chars_2))) {
                                if (head_2(tail_2(chars_2)) === "=") {
                                    matchResult_1 = 11;
                                    rest_11 = tail_2(tail_2(chars_2));
                                }
                                else {
                                    matchResult_1 = 15;
                                    rest_15 = tail_2(chars_2);
                                }
                            }
                            else {
                                matchResult_1 = 15;
                                rest_15 = tail_2(chars_2);
                            }
                            break;
                        }
                        case "=": {
                            if (!isEmpty(tail_2(chars_2))) {
                                if (head_2(tail_2(chars_2)) === "=") {
                                    matchResult_1 = 12;
                                    rest_12 = tail_2(tail_2(chars_2));
                                }
                                else if ((c_5 = head_2(chars_2), isDigit(c_5) ? true : (c_5 === "-"))) {
                                    matchResult_1 = 17;
                                    c_13 = head_2(chars_2);
                                }
                                else if (isLetter(head_2(chars_2))) {
                                    matchResult_1 = 18;
                                    c_14 = head_2(chars_2);
                                }
                                else {
                                    matchResult_1 = 19;
                                    c_15 = head_2(chars_2);
                                }
                            }
                            else if ((c_7 = head_2(chars_2), isDigit(c_7) ? true : (c_7 === "-"))) {
                                matchResult_1 = 17;
                                c_13 = head_2(chars_2);
                            }
                            else if (isLetter(head_2(chars_2))) {
                                matchResult_1 = 18;
                                c_14 = head_2(chars_2);
                            }
                            else {
                                matchResult_1 = 19;
                                c_15 = head_2(chars_2);
                            }
                            break;
                        }
                        case ">": {
                            if (!isEmpty(tail_2(chars_2))) {
                                if (head_2(tail_2(chars_2)) === "=") {
                                    matchResult_1 = 10;
                                    rest_10 = tail_2(tail_2(chars_2));
                                }
                                else {
                                    matchResult_1 = 14;
                                    rest_14 = tail_2(chars_2);
                                }
                            }
                            else {
                                matchResult_1 = 14;
                                rest_14 = tail_2(chars_2);
                            }
                            break;
                        }
                        default:
                            if ((c_9 = head_2(chars_2), isDigit(c_9) ? true : (c_9 === "-"))) {
                                matchResult_1 = 17;
                                c_13 = head_2(chars_2);
                            }
                            else if (isLetter(head_2(chars_2))) {
                                matchResult_1 = 18;
                                c_14 = head_2(chars_2);
                            }
                            else {
                                matchResult_1 = 19;
                                c_15 = head_2(chars_2);
                            }
                    }
                }
            }
            else {
                matchResult_1 = 0;
            }
            switch (matchResult_1) {
                case 0:
                    return singleton(new Token(44, []));
                case 1: {
                    chars_2_mut = rest_1;
                    continue lex$0027;
                }
                case 2:
                    return cons(new Token(42, []), lex$0027(rest_2));
                case 3:
                    return cons(new Token(43, []), lex$0027(rest_3));
                case 4:
                    return cons(new Token(40, []), lex$0027(rest_4));
                case 5:
                    return cons(new Token(41, []), lex$0027(rest_5));
                case 6:
                    return cons(new Token(29, []), lex$0027(rest_6));
                case 7:
                    return cons(new Token(31, []), lex$0027(rest_7));
                case 8:
                    return cons(new Token(32, []), lex$0027(rest_8));
                case 9:
                    return cons(new Token(33, []), lex$0027(rest_9));
                case 10:
                    return cons(new Token(36, []), lex$0027(rest_10));
                case 11:
                    return cons(new Token(37, []), lex$0027(rest_11));
                case 12:
                    return cons(new Token(38, []), lex$0027(rest_12));
                case 13:
                    return cons(new Token(39, []), lex$0027(rest_13));
                case 14:
                    return cons(new Token(34, []), lex$0027(rest_14));
                case 15:
                    return cons(new Token(35, []), lex$0027(rest_15));
                case 16: {
                    const patternInput = readWhile((c_12) => (isDigit(c_12) ? true : (c_12 === ".")), rest_16);
                    const numStr_2 = patternInput[0];
                    if (isNullOrEmpty(numStr_2)) {
                        throw new LexerError("Expected digits after \'$\'");
                    }
                    else {
                        return cons(new Token(28, [parse(numStr_2)]), lex$0027(patternInput[1]));
                    }
                }
                case 17: {
                    let matchResult_2, nextChar_1;
                    if (!isEmpty(chars_2)) {
                        if (head_2(chars_2) === "-") {
                            if (!isEmpty(tail_2(chars_2))) {
                                if (!isDigit(head_2(tail_2(chars_2)))) {
                                    matchResult_2 = 0;
                                    nextChar_1 = head_2(tail_2(chars_2));
                                }
                                else {
                                    matchResult_2 = 1;
                                }
                            }
                            else {
                                matchResult_2 = 1;
                            }
                        }
                        else {
                            matchResult_2 = 1;
                        }
                    }
                    else {
                        matchResult_2 = 1;
                    }
                    switch (matchResult_2) {
                        case 0:
                            return cons(new Token(30, []), lex$0027(tail_2(chars_2)));
                        default: {
                            const patternInput_1 = readWhile((ch) => ((isDigit(ch) ? true : (ch === ".")) ? true : (ch === "-")), chars_2);
                            const rest_17 = patternInput_1[1];
                            const numStr_3 = patternInput_1[0];
                            let matchResult_3, rest$0027_1;
                            if (!isEmpty(rest_17)) {
                                if (head_2(rest_17) === "%") {
                                    matchResult_3 = 0;
                                    rest$0027_1 = tail_2(rest_17);
                                }
                                else {
                                    matchResult_3 = 1;
                                }
                            }
                            else {
                                matchResult_3 = 1;
                            }
                            switch (matchResult_3) {
                                case 0:
                                    return cons(new Token(27, [parse(numStr_3)]), lex$0027(rest$0027_1));
                                default:
                                    return cons(new Token(26, [parse(numStr_3)]), lex$0027(rest_17));
                            }
                        }
                    }
                }
                case 18: {
                    const readIdentifier = (acc_1_mut, remaining_1_mut) => {
                        readIdentifier:
                        while (true) {
                            const acc_1 = acc_1_mut, remaining_1 = remaining_1_mut;
                            if (!isEmpty(remaining_1)) {
                                const t = tail_2(remaining_1);
                                const h = head_2(remaining_1);
                                if (isLetterOrDigit(h) ? true : (h === "_")) {
                                    acc_1_mut = cons(h, acc_1);
                                    remaining_1_mut = t;
                                    continue readIdentifier;
                                }
                                else {
                                    switch (h) {
                                        case "-": {
                                            let matchResult_4, prev_1;
                                            if (!isEmpty(acc_1)) {
                                                if (head_2(acc_1) === "_") {
                                                    matchResult_4 = 0;
                                                    prev_1 = head_2(acc_1);
                                                }
                                                else {
                                                    matchResult_4 = 1;
                                                }
                                            }
                                            else {
                                                matchResult_4 = 1;
                                            }
                                            switch (matchResult_4) {
                                                case 0: {
                                                    acc_1_mut = cons(h, acc_1);
                                                    remaining_1_mut = t;
                                                    continue readIdentifier;
                                                }
                                                default:
                                                    return [charsToString(reverse(acc_1)), remaining_1];
                                            }
                                        }
                                        case ".": {
                                            let matchResult_5, prev_3;
                                            if (!isEmpty(acc_1)) {
                                                if (isDigit(head_2(acc_1))) {
                                                    matchResult_5 = 0;
                                                    prev_3 = head_2(acc_1);
                                                }
                                                else {
                                                    matchResult_5 = 1;
                                                }
                                            }
                                            else {
                                                matchResult_5 = 1;
                                            }
                                            switch (matchResult_5) {
                                                case 0: {
                                                    acc_1_mut = cons(h, acc_1);
                                                    remaining_1_mut = t;
                                                    continue readIdentifier;
                                                }
                                                default:
                                                    return [charsToString(reverse(acc_1)), remaining_1];
                                            }
                                        }
                                        default:
                                            return [charsToString(reverse(acc_1)), remaining_1];
                                    }
                                }
                            }
                            else {
                                return [charsToString(reverse(acc_1)), empty()];
                            }
                            break;
                        }
                    };
                    const patternInput_2 = readIdentifier(empty(), chars_2);
                    return lexIdentifierLike(patternInput_2[0])(patternInput_2[1]);
                }
                default:
                    throw new LexerError(`Unrecognized character: '${c_15}'`);
            }
            break;
        }
    };
    const lexIdentifierLike = (word_1) => ((rest_19) => {
        let matchValue_2;
        const optionMatch = match(/^(.+)_(\d+)dte_(minus|-)?([\d\.]+)(delta|gamma|theta|vega|rho)$/gui, word_1);
        if (optionMatch != null) {
            try {
                const assetRef = parseAssetReferenceFromString(optionMatch[1] || "");
                const dteVal = parse_1(optionMatch[2] || "", 511, false, 32) | 0;
                const isNegative = optionMatch[3] != null;
                const rawVal = parse(optionMatch[4] || "");
                const greekValue = (isNegative ? -rawVal : rawVal) / 100;
                return cons(new Token(23, [new OptionSpec(assetRef, dteVal, (matchValue_2 = (optionMatch[5] || "").toLocaleLowerCase(), (matchValue_2 === "delta") ? (new GreekType(0, [])) : ((matchValue_2 === "gamma") ? (new GreekType(1, [])) : ((matchValue_2 === "theta") ? (new GreekType(2, [])) : ((matchValue_2 === "vega") ? (new GreekType(3, [])) : ((matchValue_2 === "rho") ? (new GreekType(4, [])) : (() => {
                    throw new Error("Invalid greek");
                })()))))), greekValue)]), lex$0027(rest_19));
            }
            catch (matchValue_3) {
                return cons(new Token(25, [word_1]), lex$0027(rest_19));
            }
        }
        else {
            const indicatorMatch = match(/^([a-zA-Z0-9]+)_(sma|ema|rsi|vol|return|pastprice)(?:_(\d+))?$/gui, word_1);
            if (indicatorMatch != null) {
                return cons(new Token(24, [new IndicatorData(indicatorMatch[1] || "", (indicatorMatch[2] || "").toLocaleLowerCase(), (indicatorMatch[3] != null) ? parse_1(indicatorMatch[3] || "", 511, false, 32) : undefined)]), lex$0027(rest_19));
            }
            else {
                const assetRef_1 = parseAssetReferenceFromString(word_1);
                let matchResult_6, baseAsset_3, ticker_1;
                if (assetRef_1.tag === 0) {
                    if (FSharpSet__Contains(tickerSet, assetRef_1.fields[0])) {
                        matchResult_6 = 1;
                        ticker_1 = assetRef_1.fields[0];
                    }
                    else {
                        matchResult_6 = 2;
                    }
                }
                else if (FSharpSet__Contains(tickerSet, assetRef_1.fields[0].toLocaleLowerCase())) {
                    matchResult_6 = 0;
                    baseAsset_3 = assetRef_1.fields[0];
                }
                else {
                    matchResult_6 = 2;
                }
                switch (matchResult_6) {
                    case 0:
                        return cons(new Token(22, [assetRef_1]), lex$0027(rest_19));
                    case 1:
                        return cons(new Token(22, [assetRef_1]), lex$0027(rest_19));
                    default: {
                        const matchValue_4 = tryFind(word_1.toLocaleLowerCase(), keywords);
                        return (matchValue_4 == null) ? cons(new Token(25, [word_1]), lex$0027(rest_19)) : cons(matchValue_4, lex$0027(rest_19));
                    }
                }
            }
        }
    });
    return lex$0027(ofSeq(input.split("")));
}

