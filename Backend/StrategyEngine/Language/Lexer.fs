module Lexer

open System.Text.RegularExpressions
open Tokens
open AST

exception LexerError of string

let lex (tickerSet: Set<string>) (input: string) : Token list =

    // Regex handles:
    // 1. Ticker
    // 2. DTE
    // 3. Optional Sign (minus or -)
    // 4. Value (integer or decimal)
    // 5. Greek Type
    let optionRegex = Regex( @"^(.+)_(\d+)dte_(minus|-)?([\d\.]+)(delta|gamma|theta|vega|rho)$", RegexOptions.Compiled ||| RegexOptions.IgnoreCase)
    
    let indicatorRegex = Regex( @"^([a-zA-Z0-9]+)_(sma|ema|rsi|vol|return|pastprice)(?:_(\d+))?$", RegexOptions.Compiled ||| RegexOptions.IgnoreCase)
    
    let keywords =
        Map.ofList [
            "when", T_WHEN; "end", T_END; "for_any_position", T_FOR_ANY_POSITION
            "as", T_AS; "buy", T_BUY; "sell", T_SELL
            "buy_max", T_BUY_MAX; "sell_all", T_SELL_ALL; "rebalance_to", T_REBALANCE_TO
            "define", T_DEFINE; "set", T_SET; "to", T_TO
            "true", T_TRUE; "false", T_FALSE; "t_bills", T_T_BILLS
            "and", T_AND; "or", T_OR; "not", T_NOT
            "cash_available", T_CASH_AVAILABLE; "portfolio_value", T_PORTFOLIO_VALUE
            "position_quantity", T_POSITION_QUANTITY; "position_value", T_POSITION_VALUE
        ]

    // Helper to convert char list to string efficiently
    let charsToString (chars: char list) = 
        System.String(List.toArray chars)

    let readWhile (predicate: char -> bool) (chars: char list) : string * char list =
        let rec loop acc remaining =
            match remaining with
            | head :: tail when predicate head -> loop (head :: acc) tail
            | _ -> (charsToString (List.rev acc), remaining) // FIX: Use charsToString
        loop [] chars

    let parseAssetReferenceFromString (id: string) : AssetReference =
        let parts = id.Split('_')
        if parts.Length >= 2 && parts.[parts.Length - 1].EndsWith("x") then
            let lastPart = parts.[parts.Length - 1]
            if lastPart.StartsWith("minus") && lastPart.Length > 6 then
                let numStr = lastPart.Substring(5, lastPart.Length - 6)
                match System.Double.TryParse(numStr, System.Globalization.CultureInfo.InvariantCulture) with
                | (true, n) -> 
                    let baseAsset = System.String.Join("_", parts.[0 .. parts.Length - 2])
                    AssetReference.LeveragedAsset(baseAsset, -n)
                | _ -> AssetReference.SimpleAsset(id)
            else
                let numStr = lastPart.Substring(0, lastPart.Length - 1)
                match System.Double.TryParse(numStr, System.Globalization.CultureInfo.InvariantCulture) with
                | (true, n) -> 
                    let baseAsset = System.String.Join("_", parts.[0 .. parts.Length - 2])
                    AssetReference.LeveragedAsset(baseAsset, n)
                | _ -> AssetReference.SimpleAsset(id)
        else
            AssetReference.SimpleAsset(id)

    let rec lex' (chars: char list) : Token list =
        match chars with
        | [] -> [T_EOF]
        | c :: rest when System.Char.IsWhiteSpace(c) -> lex' rest
        | '(' :: rest -> T_LPAREN :: lex' rest | ')' :: rest -> T_RPAREN :: lex' rest
        | ':' :: rest -> T_COLON :: lex' rest | '.' :: rest -> T_DOT :: lex' rest
        | '+' :: rest -> T_PLUS :: lex' rest | '*' :: rest -> T_MULTIPLY :: lex' rest
        | '/' :: rest -> T_DIVIDE :: lex' rest | '%' :: rest -> T_MODULO :: lex' rest
        | '>' :: '=' :: rest -> T_GREATER_EQ :: lex' rest | '<' :: '=' :: rest -> T_LESS_EQ :: lex' rest
        | '=' :: '=' :: rest -> T_EQUAL :: lex' rest | '!' :: '=' :: rest -> T_NOT_EQUAL :: lex' rest
        | '>' :: rest -> T_GREATER :: lex' rest | '<' :: rest -> T_LESS :: lex' rest
        | '$' :: rest ->
            let (numStr, rest') = readWhile (fun c -> System.Char.IsDigit(c) || c = '.') rest
            if System.String.IsNullOrEmpty(numStr) then raise (LexerError "Expected digits after '$'")
            else T_DOLLAR(System.Double.Parse(numStr, System.Globalization.CultureInfo.InvariantCulture)) :: lex' rest'
        
        // Numeric Literals (start with digit or negative sign followed by digit)
        | c :: _ when System.Char.IsDigit(c) || c = '-' ->
            match chars with
            | '-' :: nextChar :: _ when not (System.Char.IsDigit(nextChar)) -> T_MINUS :: lex' (List.tail chars)
            | _ ->
                let numStr, rest = readWhile (fun ch -> System.Char.IsDigit(ch) || ch = '.' || ch = '-') chars
                match rest with
                | '%' :: rest' -> T_PERCENTAGE(System.Double.Parse(numStr, System.Globalization.CultureInfo.InvariantCulture)) :: lex' rest'
                | _ -> T_NUMBER(System.Double.Parse(numStr, System.Globalization.CultureInfo.InvariantCulture)) :: lex' rest
        
        // Identifiers / Keywords / Option Specs
        | c :: _ when System.Char.IsLetter(c) ->
            // Custom reader to handle special characters inside Option Specs (like '-' and '.')
            // without breaking standard operators like 'a-b' or 'obj.prop'.
            let rec readIdentifier acc remaining =
                match remaining with
                | [] -> (charsToString (List.rev acc), []) // FIX: Use charsToString
                | h :: t ->
                    if System.Char.IsLetterOrDigit(h) || h = '_' then
                        readIdentifier (h :: acc) t
                    // Allow '-' only if preceded by '_' (e.g. "dte_-50")
                    elif h = '-' then
                        match acc with
                        | prev :: _ when prev = '_' -> readIdentifier (h :: acc) t
                        | _ -> (charsToString (List.rev acc), remaining) // FIX: Use charsToString
                    // Allow '.' only if preceded by a digit (e.g. "0.5")
                    elif h = '.' then
                        match acc with
                        | prev :: _ when System.Char.IsDigit(prev) -> readIdentifier (h :: acc) t
                        | _ -> (charsToString (List.rev acc), remaining) // FIX: Use charsToString
                    else
                        (charsToString (List.rev acc), remaining) // FIX: Use charsToString

            let (word, rest) = readIdentifier [] chars
            lexIdentifierLike word rest
            
        | c :: _ -> raise (LexerError $"Unrecognized character: '{c}'")

    and lexIdentifierLike (word: string) (rest: char list) : Token list =
        // 1. Try to match as an Option Spec
        let optionMatch = optionRegex.Match(word)
        if optionMatch.Success then
            try
                let assetRef = parseAssetReferenceFromString(optionMatch.Groups.[1].Value)
                let dteVal = System.Int32.Parse(optionMatch.Groups.[2].Value)
                
                // Handle negative sign group
                let isNegative = optionMatch.Groups.[3].Success
                let rawVal = System.Double.Parse(optionMatch.Groups.[4].Value, System.Globalization.CultureInfo.InvariantCulture)
                let greekValue = (if isNegative then -rawVal else rawVal) / 100.0
                
                let greekType = match optionMatch.Groups.[5].Value.ToLower() with
                                | "delta" -> GreekType.Delta | "gamma" -> GreekType.Gamma | "theta" -> GreekType.Theta
                                | "vega" -> GreekType.Vega | "rho" -> GreekType.Rho | _ -> failwith "Invalid greek"
                
                let spec = { Underlying = assetRef; DTE = dteVal; GreekType = greekType; GreekValue = greekValue }
                T_OPTION_SPEC(spec) :: lex' rest
            with _ -> T_IDENTIFIER(word) :: lex' rest
        
        // 2. Try to match as an Indicator
        else 
            let indicatorMatch = indicatorRegex.Match(word)
            if indicatorMatch.Success then
                let asset = indicatorMatch.Groups.[1].Value
                let typeName = indicatorMatch.Groups.[2].Value.ToLower()
                let periodOpt = if indicatorMatch.Groups.[3].Success then Some(System.Int32.Parse(indicatorMatch.Groups.[3].Value)) else None
                T_INDICATOR({ Asset = asset; TypeName = typeName; Period = periodOpt }) :: lex' rest
            
            // 3. Try to match as an Asset Reference
            else
                let assetRef = parseAssetReferenceFromString word
                match assetRef with
                | AssetReference.LeveragedAsset(baseAsset, _) when tickerSet.Contains(baseAsset.ToLower()) -> 
                    T_ASSET_REFERENCE(assetRef) :: lex' rest
                | AssetReference.SimpleAsset(ticker) when tickerSet.Contains(ticker) -> 
                    T_ASSET_REFERENCE(assetRef) :: lex' rest
                | _ -> 
                    // 4. Try to match as a Keyword
                    match Map.tryFind (word.ToLower()) keywords with
                    | Some token -> token :: lex' rest
                    | None -> 
                        // 5. Fallback to Generic Identifier
                        T_IDENTIFIER(word) :: lex' rest

    // Start the process.
    lex' (input |> List.ofSeq)