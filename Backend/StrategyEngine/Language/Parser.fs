module Parser

open Tokens
open AST

exception ParseError of string

type Parser<'a> = Token list -> 'a * Token list

// --- Parser Combinator Library ---
let pToken (tokenToMatch: Token) : Parser<Token> =
    fun tokens ->
        match tokens with
        | head :: tail when head = tokenToMatch -> (head, tail)
        | head :: _ -> raise (ParseError $"Expected token '{tokenToMatch}' but found '{head}'")
        | [] -> raise (ParseError $"Expected token '{tokenToMatch}' but found EOF")

let (|>>) (parser: Parser<'a>) (func: 'a -> 'b) : Parser<'b> =
    fun tokens ->
        let (resultA, rest) = parser tokens
        let resultB = func resultA
        (resultB, rest)

let (>>=) (parserA: Parser<'a>) (func: 'a -> Parser<'b>) : Parser<'b> =
    fun tokens ->
        let (resultA, rest) = parserA tokens
        let parserB = func resultA
        parserB rest

let (<|>) (parserA: Parser<'a>) (parserB: Parser<'a>) : Parser<'a> =
    fun tokens ->
        try parserA tokens
        with | ParseError _ -> parserB tokens

let many (parser: Parser<'a>) : Parser<'a list> =
    fun tokens ->
        let mutable results = []
        let mutable remainingTokens = tokens
        let mutable continueLoop = true
        while continueLoop do
            try
                let (result, rest) = parser remainingTokens
                results <- result :: results
                remainingTokens <- rest
            with | ParseError _ -> continueLoop <- false
        (List.rev results, remainingTokens)

// Version of many that requires at least one match (for statement blocks)
let manyUntilEnd (parser: Parser<'a>) : Parser<'a list> =
    fun tokens ->
        let mutable results = []
        let mutable remainingTokens = tokens
        let mutable continueLoop = true
        while continueLoop do
            match remainingTokens with
            | T_END :: _ -> continueLoop <- false  // Stop when we hit 'end'
            | T_EOF :: _ -> raise (ParseError "Block not closed with 'end' - found EOF")
            | [] -> raise (ParseError "Block not closed with 'end' - unexpected end of input")
            | _ ->
                try
                    let (result, rest) = parser remainingTokens
                    results <- result :: results
                    remainingTokens <- rest
                with 
                | ParseError msg -> raise (ParseError $"Error in statement block: {msg}")
        (List.rev results, remainingTokens)

let optional (parser: Parser<'a>) : Parser<'a option> =
    fun tokens ->
        try
            let (result, rest) = parser tokens
            (Some result, rest)
        with | ParseError _ -> (None, tokens)

type ParserBuilder() =
    member _.Bind(p: Parser<'a>, f: 'a -> Parser<'b>) : Parser<'b> = p >>= f
    member _.Return(x: 'a) : Parser<'a> = fun tokens -> (x, tokens)
let parser = ParserBuilder()

// --- Parser Implementation ---

// Batch 1 Primitives
let pNumberValue : Parser<float> = fun ts -> match ts with | T_NUMBER n :: r -> (n, r) | _ -> raise (ParseError "Expected number")
let pPercentageValue : Parser<float> = fun ts -> match ts with | T_PERCENTAGE p :: r -> (p, r) | _ -> raise (ParseError "Expected percentage")
let pDollarValue : Parser<float> = fun ts -> match ts with | T_DOLLAR d :: r -> (d, r) | _ -> raise (ParseError "Expected dollar amount")
let pIdentifierValue : Parser<string> = fun ts -> match ts with | T_IDENTIFIER id :: r -> (id, r) | _ -> raise (ParseError "Expected identifier")

let parseNumber : Parser<NumericLiteral> = pNumberValue |>> NumericLiteral.Number
let parsePercentage : Parser<NumericLiteral> = pPercentageValue |>> NumericLiteral.Percentage
let parseDollar : Parser<NumericLiteral> = pDollarValue |>> NumericLiteral.Dollar
let parseBoolean : Parser<BoolLiteral> =
    (pToken T_TRUE |>> (fun _ -> BoolLiteral.True))
    <|> (pToken T_FALSE |>> (fun _ -> BoolLiteral.False))

let parseLiteral : Parser<Literal> =
    (parseNumber |>> Literal.NumericLit)
    <|> (parsePercentage |>> Literal.NumericLit)
    <|> (parseDollar |>> Literal.NumericLit)
    <|> (parseBoolean |>> Literal.BoolLit)

let parseIdentifier : Parser<Identifier> = pIdentifierValue

// Batch 2 Primitives
let parseAssetReference : Parser<AssetReference> =
    fun tokens -> match tokens with
                  | T_ASSET_REFERENCE ar :: rest -> (ar, rest)
                  | t :: _ -> raise (ParseError $"Expected asset reference, found {t}")
                  | [] -> raise (ParseError "Expected asset reference")

let parseOptionSpec : Parser<OptionSpec> =
    fun tokens -> match tokens with
                  | T_OPTION_SPEC os :: rest -> (os, rest)
                  | t :: _ -> raise (ParseError $"Expected option spec, found {t}")
                  | [] -> raise (ParseError "Expected option spec")

let parseInstrument : Parser<Instrument> =
    (parseAssetReference |>> Instrument.Asset)
    <|> (parseOptionSpec |>> Instrument.Option)

// Batch 3 & 4: Expressions and Conditions
let pIdentifierOrAsset : Parser<string> = 
    pIdentifierValue <|> (parseAssetReference |>> fun ar -> 
        match ar with 
        | SimpleAsset s -> s 
        | LeveragedAsset(s,_) -> s)
    
let rec parseExpression : Parser<Expression> = fun tokens -> (parseAdditiveExpr tokens)
and parseQuantity : Parser<Quantity> =
    fun tokens ->
        match tokens with
        | T_LPAREN :: _ ->
            // If it starts with (, parse as full expression
            let (expr, rest) = parseExpression tokens
            (Quantity.ExpressionQuantity(expr), rest)
        | T_NUMBER _ :: _ ->
            let (num, rest) = parseNumber tokens
            (Quantity.LiteralQuantity(num), rest)
        | T_PERCENTAGE _ :: _ ->
            let (pct, rest) = parsePercentage tokens
            (Quantity.LiteralQuantity(pct), rest)
        | T_DOLLAR _ :: _ ->
            let (dol, rest) = parseDollar tokens
            (Quantity.LiteralQuantity(dol), rest)
        | T_IDENTIFIER _ :: _ ->
            let (id, rest) = parseIdentifier tokens
            (Quantity.IdentifierQuantity(id), rest)
        | t :: _ -> raise (ParseError $"Expected quantity, found {t}")
        | [] -> raise (ParseError "Expected quantity, found EOF")
and parsePrimaryExpr : Parser<Expression> =
    let pParen = parser {
            let! _ = pToken T_LPAREN
            let! expr = parseExpression
            let! _ = pToken T_RPAREN
            return Expression.ParenExpr(expr)
        }
    let pLiteral = parseLiteral |>> Expression.LiteralExpr
    let pIndicator =
        (fun ts -> match ts with | T_INDICATOR d :: r -> (d, r) | _ -> raise (ParseError "Expected indicator"))
        |>> (fun indicatorData ->
            let indicatorType =
                match indicatorData.TypeName.ToLower() with
                | "sma" -> IndicatorType.SMA | "ema" -> IndicatorType.EMA | "rsi" -> IndicatorType.RSI
                | "vol" -> IndicatorType.Vol | "return" -> IndicatorType.Return | "pastprice" -> IndicatorType.PastPrice
                | s -> raise (ParseError $"Invalid indicator type '{s}'")
            Expression.IndicatorExpr({ Asset = indicatorData.Asset; IndicatorType = indicatorType; Period = indicatorData.Period }))
    let pAsset = parseAssetReference |>> Expression.AssetExpr
    let pOption = parseOptionSpec |>> Expression.OptionExpr
    let pQuery =
        let pPosQty = parser {
            let! _ = pToken T_POSITION_QUANTITY
            let! _ = pToken T_LPAREN
            let! target = pIdentifierOrAsset // <--- USE HELPER HERE
            let! _ = pToken T_RPAREN
            return PortfolioQuery.PositionQuantity(target)
        }
        let pPosVal = parser {
                let! _ = pToken T_POSITION_VALUE
                let! _ = pToken T_LPAREN
                let! id = pIdentifierOrAsset // <--- USE HELPER HERE
                let! _ = pToken T_RPAREN
                return PortfolioQuery.PositionValue(id)
            }
        (pToken T_CASH_AVAILABLE |>> (fun _ -> PortfolioQuery.CashAvailable))
        <|> (pToken T_PORTFOLIO_VALUE |>> (fun _ -> PortfolioQuery.PortfolioValue))
        <|> pPosQty <|> pPosVal
        |>> Expression.PortfolioQueryExpr
    let pIdentifierExpr = pIdentifierValue |>> Expression.IdentifierExpr
    
    // Parse base expression first
    let baseExprParser = pParen <|> pLiteral <|> pIndicator <|> pAsset <|> pOption <|> pQuery <|> pIdentifierExpr
    
    // Then check for property access chain
    baseExprParser >>= (fun baseExpr ->
        fun tokens ->
            let rec loop acc remainingTokens =
                match remainingTokens with
                | T_DOT :: T_IDENTIFIER(prop) :: rest' ->
                    let newAccess = Expression.PropertyAccessExpr({ Object = acc; Property = prop })
                    loop newAccess rest'
                | _ -> (acc, remainingTokens)
            loop baseExpr tokens
    )
and parseUnaryExpr : Parser<Expression> =
    (pToken T_MINUS >>= (fun _ -> parsePrimaryExpr |>> Expression.UnaryMinusExpr))
    <|> parsePrimaryExpr
and parseMultiplicativeExpr : Parser<Expression> =
    let opParser = (pToken T_MULTIPLY |>> (fun _ -> ArithmeticOp.Multiply))
                   <|> (pToken T_DIVIDE |>> (fun _ -> ArithmeticOp.Divide))
                   <|> (pToken T_MODULO |>> (fun _ -> ArithmeticOp.Modulo))
    parseUnaryExpr >>= (fun left ->
        let rec loop currentLeft tokens =
            match (optional (opParser >>= (fun op -> parseUnaryExpr |>> (fun right -> (op, right))))) tokens with
            | (Some(op, right), rest) -> loop (Expression.ArithmeticExpr(op, currentLeft, right)) rest
            | (None, _) -> (currentLeft, tokens)
        loop left
    )
and parseAdditiveExpr : Parser<Expression> =
    let opParser = (pToken T_PLUS |>> (fun _ -> ArithmeticOp.Add))
                   <|> (pToken T_MINUS |>> (fun _ -> ArithmeticOp.Subtract))
    parseMultiplicativeExpr >>= (fun left ->
        let rec loop currentLeft tokens =
            match (optional (opParser >>= (fun op -> parseMultiplicativeExpr |>> (fun right -> (op, right))))) tokens with
            | (Some(op, right), rest) -> loop (Expression.ArithmeticExpr(op, currentLeft, right)) rest
            | (None, _) -> (currentLeft, tokens)
        loop left
    )
and parseComparison : Parser<Condition> =
    parseExpression >>= (fun left ->
        let opParser =
            (pToken T_GREATER |>> (fun _ -> ComparisonOp.Greater)) <|> (pToken T_LESS |>> (fun _ -> ComparisonOp.Less))
            <|> (pToken T_GREATER_EQ |>> (fun _ -> ComparisonOp.GreaterEq)) <|> (pToken T_LESS_EQ |>> (fun _ -> ComparisonOp.LessEq))
            <|> (pToken T_EQUAL |>> (fun _ -> ComparisonOp.Equal)) <|> (pToken T_NOT_EQUAL |>> (fun _ -> ComparisonOp.NotEqual))
        optional opParser >>= (fun opOpt ->
            match opOpt with
            | Some op -> parseExpression |>> (fun right -> Condition.ComparisonCond(op, left, right))
            | None -> 
                match left with
                | LiteralExpr(BoolLit _) -> fun ts -> (Condition.BooleanExpr(left), ts)
                | IdentifierExpr _ -> fun ts -> (Condition.BooleanExpr(left), ts)
                | _ -> fun _ -> raise (ParseError $"Expected comparison operator after expression in condition")
        )
    )
and parsePrimaryCond : Parser<Condition> =
    let pParen = parser {
            let! _ = pToken T_LPAREN
            let! cond = parseCondition
            let! _ = pToken T_RPAREN
            return Condition.ParenCond(cond)
        }
    (pToken T_NOT >>= (fun _ -> parsePrimaryCond |>> Condition.NotCond))
    <|> pParen <|> parseComparison
and parseLogicalAndCond : Parser<Condition> =
    parsePrimaryCond >>= (fun left ->
        let rec loop currentLeft tokens =
            match (optional (pToken T_AND >>= (fun _ -> parsePrimaryCond))) tokens with
            | (Some right, rest) -> loop (Condition.LogicalCond(LogicalOp.And, currentLeft, right)) rest
            | (None, _) -> (currentLeft, tokens)
        loop left
    )
and parseCondition : Parser<Condition> = fun tokens -> (parseLogicalOrCond tokens)
and parseLogicalOrCond : Parser<Condition> =
    parseLogicalAndCond >>= (fun left ->
        let rec loop currentLeft tokens =
            match (optional (pToken T_OR >>= (fun _ -> parseLogicalAndCond))) tokens with
            | (Some right, rest) -> loop (Condition.LogicalCond(LogicalOp.Or, currentLeft, right)) rest
            | (None, _) -> (currentLeft, tokens)
        loop left
    )

// Batch 5-8 Parsers
let rec parseStatement : Parser<Statement> =
    (parseDefineStatement |>> Statement.DefineStatement)
    <|> (parseSetStatement |>> Statement.SetStatement)
    <|> (parseConditionalStatement |>> Statement.ConditionalStatement)
    <|> (parseForAnyPositionStatement |>> Statement.ForAnyPositionStatement)
    <|> (parseActionStatement |>> Statement.ActionStatement)
and parseDefinitionValue : Parser<DefinitionValue> =
    // AMBIGUITY FIX: Robustly distinguish Position from Expression
    fun tokens ->
        match tokens with
        // 1. Explicit Position start keywords
        | T_BUY :: _ | T_SELL :: _ ->
            let (posExpr, rest) = parsePositionExpression tokens
            (DefinitionValue.PositionValue(posExpr), rest)
        | _ ->
            // 2. Try to parse as Expression first (covers arithmetic, assets, simple identifiers)
            try
                let (expr, rest) = parseExpression tokens
                match rest with
                // 3. If followed by 'AND', it must be a Compound Position
                // e.g. "define x as left and right" -> 'left' parsed as expr, 'and' remains.
                | T_AND :: _ ->
                    // Backtrack and re-parse as PositionExpression to consume the 'and' chain
                    let (posExpr, rest') = parsePositionExpression tokens
                    (DefinitionValue.PositionValue(posExpr), rest')
                | _ ->
                    (DefinitionValue.ExpressionValue(expr), rest)
            with
            | ParseError _ ->
                // 4. Fallback: If expression parse fails, try position (might be obscure reference case)
                let (posExpr, rest) = parsePositionExpression tokens
                (DefinitionValue.PositionValue(posExpr), rest)

and parseDefineStatement : Parser<DefineStmt> =
    parser {
        let! _ = pToken T_DEFINE
        let! id = parseIdentifier
        let! _ = pToken T_AS
        let! value = parseDefinitionValue
        return { Name = id; Value = value }
    }
and parseSetStatement : Parser<SetStmt> =
    parser {
        let! _ = pToken T_SET
        let! id = parseIdentifier
        let! _ = pToken T_TO
        let! value = parseExpression
        return { Name = id; Value = value }
    }
and parseStatementBlock : Parser<Statement list> = manyUntilEnd parseStatement
and parseConditionalStatement : Parser<ConditionalStmt> =
    parser {
        let! _ = pToken T_WHEN
        let! cond = parseCondition
        let! _ = pToken T_COLON
        let! block = parseStatementBlock
        let! _ = pToken T_END
        return { Condition = cond; ThenBlock = block }
    }
and parseForAnyPositionStatement : Parser<ForAnyPositionStmt> =
    parser {
        let! _ = pToken T_FOR_ANY_POSITION
        let! posType = pIdentifierOrAsset 
        let! _ = pToken T_AS
        let! instanceVar = parseIdentifier
        let! _ = pToken T_COLON
        let! block = parseStatementBlock
        let! _ = pToken T_END
        return { PositionType = posType; InstanceVariable = instanceVar; Block = block }
    }
and parsePositionComponent : Parser<PositionComponent> =
    let pBuy = pToken T_BUY |>> (fun _ q i -> PositionComponent.BuyComponent(q, i))
    let pSell = pToken T_SELL |>> (fun _ q i -> PositionComponent.SellComponent(q, i))
    parser {
        let! ctor = pBuy <|> pSell
        let! quantity = parseQuantity
        let! instrument = parseInstrument
        return ctor quantity instrument
    }
and parsePositionExpression : Parser<PositionExpression> =
    // Try parsing as position component first (buy/sell), then try identifier (position reference)
    let pComponentExpr = parsePositionComponent |>> PositionExpression.ComponentExpr
    let pReferenceExpr = parseIdentifier |>> PositionExpression.PositionReference
    
    (pComponentExpr <|> pReferenceExpr) >>= (fun left ->
        let rec loop currentLeft tokens =
            match (optional (pToken T_AND >>= (fun _ -> (pComponentExpr <|> pReferenceExpr)))) tokens with
            | (Some right, rest) -> loop (PositionExpression.CompoundExpr(currentLeft, right)) rest
            | (None, _) -> (currentLeft, tokens)
        loop left
    )
and parseActionTarget : Parser<ActionTarget> =
    (parseAssetReference |>> ActionTarget.AssetTarget)
    <|> (parseIdentifier |>> ActionTarget.IdentifierTarget)
and parseActionStatement : Parser<Action> =
    let pBuy = parser {
            let! _ = pToken T_BUY
            let! q = parseQuantity
            let! t = parseActionTarget
            return Action.Buy(q, t)
        }
    let pSell = parser {
            let! _ = pToken T_SELL
            let! q = parseQuantity
            let! t = parseActionTarget
            return Action.Sell(q, t)
        }
    let pBuyMax = parser {
            let! _ = pToken T_BUY_MAX
            let! t = parseActionTarget
            return Action.BuyMax(t)
        }
    let pSellAll = parser {
            let! _ = pToken T_SELL_ALL
            let! t = parseActionTarget
            return Action.SellAll(t)
        }
    let pRebalance = parser {
            let! _ = pToken T_REBALANCE_TO
            let! p = pPercentageValue
            let! t = parseActionTarget
            return Action.RebalanceTo(p, t)
        }
    pBuy <|> pSell <|> pBuyMax <|> pSellAll <|> pRebalance

let parseProgram : Parser<Program> =
    many parseStatement |>> (fun stmts -> { Statements = stmts })

let run (tokens: Token list) : Program =
    let (program, rest) = parseProgram tokens
    match rest with
    | [T_EOF] | [] -> program
    | t :: _ -> raise (ParseError $"Unexpected token '{t}' after end of program.")