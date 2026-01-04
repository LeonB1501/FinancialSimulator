module Interpreter

open AST
open EngineTypes
open PortfolioQueries
open PricingModels
open Indicators
open RiskManager
open TradeExecutor

exception InterpreterError of string

// --- Foundation: State & Environment Helpers ---
let emptyState (initialCash: float) (riskFreeRate: float) : EvaluationState =
    { 
        CurrentDay = 0
        Portfolio = { 
            Cash = initialCash; 
            Positions = []; 
            CompositeRegistry = Map.empty 
            // Initialize Tax Fields
            TaxLots = []
            TaxLiabilityYTD = 0.0
            RealizedGainsYTD = 0.0
        }
        ScopeStack = []
        GlobalScope = Map.empty 
        RiskFreeRate = riskFreeRate
        TransactionHistory = []
    }

let pushScope (state: EvaluationState) : EvaluationState = 
    { state with ScopeStack = [] :: state.ScopeStack }

let popScope (state: EvaluationState) : EvaluationState =
    match state.ScopeStack with
    | _ :: rest -> { state with ScopeStack = rest }
    | [] -> failwith "FATAL: Pop from empty scope stack"

let lookup (id: Identifier) (state: EvaluationState) : Value option =
    let rec searchLocal scopes =
        match scopes with
        | [] -> None
        | currentScope :: outerScopes ->
            match List.tryFind (fun (name, _) -> name = id) currentScope with
            | Some (_, v) -> Some v
            | None -> searchLocal outerScopes
    
    match searchLocal state.ScopeStack with
    | Some v -> Some v
    | None -> state.GlobalScope.TryFind(id)

let defineLocal (id: Identifier) (v: Value) (state: EvaluationState) : EvaluationState =
    match state.ScopeStack with
    | currentScope :: rest ->
        let newScope = (id, v) :: currentScope
        { state with ScopeStack = newScope :: rest }
    | [] -> failwith "FATAL: Cannot define local variable without a scope."

let defineGlobal (id: Identifier) (v: Value) (state: EvaluationState) : EvaluationState =
    if state.GlobalScope.ContainsKey(id) then 
        state
    else 
        { state with GlobalScope = state.GlobalScope.Add(id, v) }

let setVar (id: Identifier) (v: Value) (state: EvaluationState) : EvaluationState =
    let rec updateInStack scopes =
        match scopes with
        | [] -> (false, [])
        | currentScope :: rest ->
            match List.tryFindIndex (fun (name, _) -> name = id) currentScope with
            | Some index ->
                let newScope = List.updateAt index (id, v) currentScope
                (true, newScope :: rest)
            | None ->
                let (found, updatedRest) = updateInStack rest
                (found, currentScope :: updatedRest)
    
    let (foundInLocal, updatedStack) = updateInStack state.ScopeStack
    
    if foundInLocal then
        { state with ScopeStack = updatedStack }
    else if state.GlobalScope.ContainsKey(id) then
        { state with GlobalScope = state.GlobalScope.Add(id, v) }
    else
        raise (InterpreterError $"Cannot 'set' an unbound variable '{id}'.")

let private valueToFloat (v: Value) : float =
    match v with
    | V_Float f -> f
    | V_Percent p -> p
    | V_Dollar d -> d
    | V_Bool b -> if b then 1.0 else 0.0
    | _ -> raise (InterpreterError $"Cannot convert value '{v}' to a float for comparison.")

// --- Helper to build Market Data Snapshot ---
let private getMarketSnapshot (history: FullPriceHistory) (currentDay: int) : Map<Identifier, MarketDataPoint> =
    history
    |> List.map (fun path -> 
        let data = path.DailyData.[currentDay]
        (path.Ticker, { Price = data.Price; Vol = data.Vol })
    )
    |> Map.ofList
    
let private calculateInstanceValue (instance: PositionInstance) (history: FullPriceHistory) (currentDay: int) (riskFreeRate: float) : float =
    match instance.Instrument with
    | ResolvedAsset assetRef ->
        let ticker = 
            match assetRef with
            | SimpleAsset t -> t
            | LeveragedAsset(t, f) -> $"{f}x_{t}"
        
        match List.tryFind (fun p -> p.Ticker = ticker) history with
        | Some path -> path.DailyData.[currentDay].Price * instance.Quantity
        | None -> 0.0

    | ResolvedOption opt ->
        let price = PricingModels.price opt history currentDay riskFreeRate
        price * instance.Quantity * 100.0

    | Compound -> 0.0

// --- Main Interpreter Functions ---
let rec private interpretExpression (state: EvaluationState) (history: FullPriceHistory) (expr: Expression) : Value =
    match expr with
    | LiteralExpr lit ->
        match lit with
        | NumericLit(Number n) -> V_Float n
        | NumericLit(Percentage p) -> V_Percent p
        | NumericLit(Dollar d) -> V_Dollar d
        | BoolLit b -> V_Bool (b = True)
    
    | IdentifierExpr id ->
        match lookup id state with
        | Some v -> v
        | None -> raise (InterpreterError $"Unbound variable '{id}'.")
    
    | AssetExpr assetRef ->
        let ticker = 
            match assetRef with
            | SimpleAsset t -> t
            | LeveragedAsset(t, f) -> $"{f}x_{t}"
        
        match List.tryFind (fun p -> p.Ticker = ticker) history with
        | None -> raise (InterpreterError $"Market data not found for ticker '{ticker}'.")
        | Some path -> V_Dollar path.DailyData.[state.CurrentDay].Price
    
    | ArithmeticExpr(op, e1, e2) ->
        let v1 = interpretExpression state history e1
        let v2 = interpretExpression state history e2
        
        match (op, v1, v2) with
        | (Add, V_Float f1, V_Float f2) -> V_Float(f1 + f2)
        | (Add, V_Dollar d1, V_Dollar d2) -> V_Dollar(d1 + d2)
        | (Add, V_Percent p1, V_Percent p2) -> V_Percent(p1 + p2)
        | (Subtract, V_Float f1, V_Float f2) -> V_Float(f1 - f2)
        | (Subtract, V_Dollar d1, V_Dollar d2) -> V_Dollar(d1 - d2)
        | (Subtract, V_Percent p1, V_Percent p2) -> V_Percent(p1 - p2)
        | (Multiply, V_Float f1, V_Float f2) -> V_Float(f1 * f2)
        | (Multiply, V_Float f, V_Percent p) -> V_Percent(f * p)
        | (Multiply, V_Percent p, V_Float f) -> V_Percent(p * f)
        | (Multiply, V_Float f, V_Dollar d) -> V_Dollar(f * d)
        | (Multiply, V_Dollar d, V_Float f) -> V_Dollar(d * f)
        | (Multiply, V_Percent p, V_Dollar d) -> V_Dollar(p * d)
        | (Multiply, V_Dollar d, V_Percent p) -> V_Dollar(d * p)
        | (Divide, V_Float f1, V_Float f2) -> 
            if f2 = 0.0 then raise (InterpreterError "Division by zero.")
            else V_Float(f1 / f2)
        | (Divide, V_Dollar d, V_Float f) -> 
            if f = 0.0 then raise (InterpreterError "Division by zero.")
            else V_Dollar(d / f)
        | (Divide, V_Dollar d1, V_Dollar d2) -> 
            if d2 = 0.0 then raise (InterpreterError "Division by zero.")
            else V_Float(d1 / d2)
        | (Divide, V_Percent p, V_Float f) -> 
            if f = 0.0 then raise (InterpreterError "Division by zero.")
            else V_Percent(p / f)
        | (Modulo, V_Float f1, V_Float f2) -> 
            if f2 = 0.0 then raise (InterpreterError "Modulo by zero.")
            else V_Float(f1 % f2)
        | _ -> raise (InterpreterError "Invalid arithmetic operation.")
    
    | UnaryMinusExpr e ->
        match interpretExpression state history e with
        | V_Float f -> V_Float(-f)
        | V_Percent p -> V_Percent(-p)
        | V_Dollar d -> V_Dollar(-d)
        | v -> raise (InterpreterError $"Cannot apply unary minus to non-numeric value '{v}'.")
    
    | ParenExpr e -> 
        interpretExpression state history e
    
    | IndicatorExpr indicator -> 
        V_Float (Indicators.calculate indicator history state.CurrentDay)
    
    | PortfolioQueryExpr query ->
            match query with
            | CashAvailable -> 
                V_Dollar state.Portfolio.Cash
            | PortfolioValue -> 
                V_Dollar (PortfolioQueries.calculatePortfolioValue state.Portfolio history state.CurrentDay state.RiskFreeRate)
            | AST.PortfolioQuery.PositionQuantity id -> 
                V_Float (PortfolioQueries.calculatePositionQuantity state.Portfolio id)
            | AST.PortfolioQuery.PositionValue id -> 
                V_Dollar (PortfolioQueries.calculatePositionValue state.Portfolio id history state.CurrentDay state.RiskFreeRate)
    
    | PropertyAccessExpr pa ->
        let objectValue = interpretExpression state history pa.Object
        match objectValue with
        | V_Instance instance ->
            let propertyName = pa.Property.ToLower()
            match propertyName with
            | "quantity" -> V_Float instance.Quantity
            | "buy_price" -> V_Dollar instance.BuyPrice
            | "buy_date" -> V_Float (float instance.BuyDate)
            
            | "price" -> 
                let valTotal = calculateInstanceValue instance history state.CurrentDay state.RiskFreeRate
                if instance.Quantity = 0.0 then V_Dollar 0.0
                else V_Dollar (valTotal / instance.Quantity)
            | "value" -> 
                V_Dollar (calculateInstanceValue instance history state.CurrentDay state.RiskFreeRate)
            
            | "delta" | "gamma" | "theta" | "vega" | "rho" ->
                match instance.Instrument with
                | ResolvedOption opt ->
                    let valGreek = 
                        match propertyName with
                        | "delta" -> PricingModels.delta opt history state.CurrentDay state.RiskFreeRate
                        | "gamma" -> PricingModels.gamma opt history state.CurrentDay state.RiskFreeRate
                        | "theta" -> PricingModels.theta opt history state.CurrentDay state.RiskFreeRate
                        | "vega" -> PricingModels.vega opt history state.CurrentDay state.RiskFreeRate
                        | "rho" -> PricingModels.rho opt history state.CurrentDay state.RiskFreeRate
                        | _ -> 0.0
                    V_Float valGreek
                | _ -> V_Float 0.0

            | nestedComponentName ->
                let sibling = 
                    state.Portfolio.Positions 
                    |> List.tryFind (fun p -> 
                        p.GroupId.IsSome && 
                        p.GroupId = instance.GroupId && 
                        p.ComponentName = Some nestedComponentName)
                
                match sibling with
                | Some s -> V_Instance s
                | None -> 
                    match List.tryFind (fun p -> p.ParentId = Some instance.Id && p.ComponentName = Some nestedComponentName) state.Portfolio.Positions with
                    | Some child -> V_Instance child
                    | None -> raise (InterpreterError $"Component '{nestedComponentName}' not found in position '{instance.DefinitionName}'.")
        
        | v -> raise (InterpreterError $"Cannot access property on non-instance value '{v}'.")

    | OptionExpr _ -> 
        raise (InterpreterError "Interpreter Error: Encountered a standalone OptionExpr.")

and private interpretCondition (state: EvaluationState) (history: FullPriceHistory) (cond: Condition) : bool =
    match cond with
    | ComparisonCond(op, e1, e2) ->
        let v1 = interpretExpression state history e1
        let v2 = interpretExpression state history e2
        let f1 = valueToFloat v1
        let f2 = valueToFloat v2
        
        match op with
        | Greater -> f1 > f2
        | Less -> f1 < f2
        | GreaterEq -> f1 >= f2
        | LessEq -> f1 <= f2
        | Equal -> f1 = f2
        | NotEqual -> f1 <> f2
    
    | LogicalCond(And, c1, c2) ->
        interpretCondition state history c1 && interpretCondition state history c2
    
    | LogicalCond(Or, c1, c2) ->
        interpretCondition state history c1 || interpretCondition state history c2
    
    | NotCond c ->
        not (interpretCondition state history c)
    
    | ParenCond c ->
        interpretCondition state history c
    
    | BooleanExpr e ->
        match interpretExpression state history e with
        | V_Bool b -> b
        | _ -> raise (InterpreterError "Expression in a boolean context did not evaluate to a boolean.")

and private interpretStatement (state: EvaluationState) (history: FullPriceHistory) (stmt: Statement) (costs: ExecutionCosts) (tax: TaxConfig) : EvaluationState =
    match stmt with
    | DefineStatement def ->
        let isGlobal = List.isEmpty state.ScopeStack
        let valueToDefine =
            match def.Value with
            | ExpressionValue e -> interpretExpression state history e
            | PositionValue p -> V_Position p
        
        if isGlobal then
            defineGlobal def.Name valueToDefine state
        else
            defineLocal def.Name valueToDefine state
    
    | SetStatement setStmt ->
        let valueToSet = interpretExpression state history setStmt.Value
        setVar setStmt.Name valueToSet state
    
    | ConditionalStatement condStmt ->
        if interpretCondition state history condStmt.Condition then
            let stateWithNewScope = pushScope state
            let finalStateOfBlock = interpretBlock stateWithNewScope history condStmt.ThenBlock costs tax
            let stateAfterPop = popScope finalStateOfBlock
            stateAfterPop
        else
            state
    
    | ForAnyPositionStatement loopStmt ->
        let instancesToLoop = 
            state.Portfolio.Positions 
            |> List.filter (fun p -> 
                p.DefinitionName = loopStmt.PositionType && 
                p.ParentId = None)
        
        List.fold (fun currentState instance ->
            let stateWithLoopScope = pushScope currentState
            let stateWithLoopVar = defineLocal loopStmt.InstanceVariable (V_Instance instance) stateWithLoopScope
            let finalStateOfBlock = interpretBlock stateWithLoopVar history loopStmt.Block costs tax
            let stateAfterIteration = popScope finalStateOfBlock
            stateAfterIteration 
        ) state instancesToLoop
    
    | ActionStatement action ->
        interpretAction state history action costs tax

and private interpretBlock (state: EvaluationState) (history: FullPriceHistory) (statements: Statement list) (costs: ExecutionCosts) (tax: TaxConfig) : EvaluationState =
    List.fold (fun currentState stmt -> 
        interpretStatement currentState history stmt costs tax
    ) state statements

and private interpretAction (state: EvaluationState) (history: FullPriceHistory) (action: Action) (costs: ExecutionCosts) (tax: TaxConfig) : EvaluationState =
    let trades = expandTrade action state history
    
    let marketData = getMarketSnapshot history state.CurrentDay
    // Note: RiskManager currently doesn't account for costs in validation, but TradeExecutor does.
    // Ideally RiskManager should also take costs, but for A3 we focus on Execution.
    let validationResult = RiskManager.validateTrades trades state.Portfolio marketData state.CurrentDay state.RiskFreeRate
    
    match validationResult with
    | Ok () ->
        // PASS COSTS & TAX HERE
        let (newPortfolio, transactions) = TradeExecutor.executeTrades trades state.Portfolio history state.CurrentDay state.RiskFreeRate costs tax
        { state with 
            Portfolio = newPortfolio
            TransactionHistory = state.TransactionHistory @ transactions
        }
    | Error msg ->
        state

and private expandTrade (action: Action) (state: EvaluationState) (history: FullPriceHistory) : PrimitiveTrade list =
    let evaluateQuantity (qty: Quantity) : float =
        match qty with
        | LiteralQuantity(Number n) -> n
        | LiteralQuantity _ -> 
            raise (InterpreterError "Only plain numbers can be used as a trade quantity.")
        | IdentifierQuantity id ->
            match lookup id state with
            | Some (V_Float f) -> f
            | Some v -> raise (InterpreterError $"Quantity variable '{id}' is not a float, got '{v}'.")
            | None -> raise (InterpreterError $"Unbound quantity variable '{id}'.")
        | ExpressionQuantity e ->
            match interpretExpression state history e with
            | V_Float f -> f
            | v -> raise (InterpreterError $"Quantity expression did not evaluate to a float, got '{v}'.")
    
    let evaluateTarget (target: ActionTarget) : Value =
        match target with
        | AssetTarget assetRef -> V_Asset assetRef
        | IdentifierTarget id ->
            match lookup id state with
            | Some v -> v
            | None -> raise (InterpreterError $"Unbound identifier '{id}' in action target.")

    let getDefinitionName (target: ActionTarget) =
        match target with
        | IdentifierTarget id -> Some id
        | _ -> None
    
    match action with
    | Buy (qty, target) ->
        let quantityValue = evaluateQuantity qty
        let targetValue = evaluateTarget target
        let defName = getDefinitionName target
        expandTargetToTrades targetValue quantityValue true defName state history
    
    | Sell (qty, target) ->
        let quantityValue = evaluateQuantity qty
        let targetValue = evaluateTarget target
        let defName = getDefinitionName target
        expandTargetToTrades targetValue quantityValue false defName state history
    
    | BuyMax target ->
        let targetValue = evaluateTarget target
        let defName = getDefinitionName target
        let tradesForOne = expandTargetToTrades targetValue 1.0 true defName state history
        
        let marketData = getMarketSnapshot history state.CurrentDay
        let maxQty = RiskManager.calculateMaxQuantity tradesForOne state.Portfolio marketData state.CurrentDay state.RiskFreeRate
        
        expandTargetToTrades targetValue (float maxQty) true defName state history
    
    | SellAll target ->
        let lookupKey = 
            match target with
            | IdentifierTarget id -> id
            | AssetTarget assetRef ->
                match assetRef with
                | SimpleAsset t -> t
                | LeveragedAsset(t, l) -> $"{t}_{l}x"

        let currentQty = PortfolioQueries.calculatePositionQuantity state.Portfolio lookupKey
        
        if currentQty <= 0.0 then
            []
        else
            let targetValue = evaluateTarget target
            let defName = getDefinitionName target
            expandTargetToTrades targetValue currentQty false defName state history
    
    | RebalanceTo (pct, target) ->
        let targetValue = evaluateTarget target
        match targetValue with
        | V_Asset assetRef -> 
            [PrimitiveRebalance { Instrument = ResolvedAsset assetRef; TargetPercent = pct }]
        | _ -> 
            raise (InterpreterError "Rebalancing is only supported for simple assets.")

and private expandTargetToTrades 
    (targetValue: Value) 
    (quantity: float) 
    (isBuy: bool) 
    (definitionName: Identifier option) 
    (state: EvaluationState) 
    (history: FullPriceHistory) : PrimitiveTrade list =
    
    match targetValue with
    | V_Asset assetRef ->
        let resolved = ResolvedAsset assetRef
        if isBuy then
            [PrimitiveBuy { 
                Instrument = resolved
                Quantity = quantity
                ComponentName = None
                DefinitionName = definitionName 
            }]
        else
            [PrimitiveSell { 
                Instrument = resolved
                Quantity = quantity
                ComponentName = None
                DefinitionName = definitionName
            }]
    
    | V_Position posExpr ->
        expandPositionExpression posExpr quantity isBuy definitionName state history
    
    | V_Instance instance ->
        if isBuy then
            raise (InterpreterError "Cannot 'buy' a specific position instance. Use the position type instead.")
        else
            [PrimitiveSell { 
                Instrument = instance.Instrument
                Quantity = quantity
                ComponentName = instance.ComponentName
                DefinitionName = Some instance.DefinitionName
            }]
    
    | v ->
        raise (InterpreterError $"Invalid target for a trade action: '{v}'.")

and private expandPositionExpression 
    (posExpr: PositionExpression) 
    (multiplier: float) 
    (isBuy: bool) 
    (positionName: Identifier option) 
    (state: EvaluationState) 
    (history: FullPriceHistory) : PrimitiveTrade list =
    
    let rec expand (expr: PositionExpression) (componentName: Identifier option) : PrimitiveTrade list =
        match expr with
        | ComponentExpr comp ->
            let (qty, instrument) = 
                match comp with
                | BuyComponent(q, i) -> (q, i)
                | SellComponent(q, i) -> (q, i)
            
            let baseQty =
                match qty with
                | LiteralQuantity(Number n) -> n
                | IdentifierQuantity id ->
                    match lookup id state with
                    | Some (V_Float f) -> f
                    | Some v -> raise (InterpreterError $"Quantity '{id}' is not a float, got '{v}'.")
                    | None -> raise (InterpreterError $"Unbound quantity identifier '{id}'.")
                | ExpressionQuantity e ->
                    match interpretExpression state history e with
                    | V_Float f -> f
                    | v -> raise (InterpreterError $"Quantity expression must evaluate to float, got '{v}'.")
                | _ -> raise (InterpreterError "Invalid quantity type in position component.")
            
            let finalQty = baseQty * multiplier
            let resolvedInstrument = resolveInstrument instrument state history
            let componentIsBuy = 
                match comp with
                | BuyComponent _ -> isBuy
                | SellComponent _ -> not isBuy
            
            if componentIsBuy then
                [PrimitiveBuy { 
                    Instrument = resolvedInstrument
                    Quantity = finalQty
                    ComponentName = componentName
                    DefinitionName = positionName 
                }]
            else
                [PrimitiveSell { 
                    Instrument = resolvedInstrument
                    Quantity = finalQty
                    ComponentName = componentName
                    DefinitionName = positionName 
                }]
        
        | CompoundExpr(left, right) ->
            let leftTrades = expand left None
            let rightTrades = expand right None
            leftTrades @ rightTrades
        
        | PositionReference id ->
            match lookup id state with
            | Some (V_Position p) -> expand p (Some id)
            | Some v -> raise (InterpreterError $"Identifier '{id}' is not a position definition, got '{v}'.")
            | None -> raise (InterpreterError $"Unbound position reference '{id}'.")
    
    expand posExpr None

and private resolveInstrument 
    (instrument: Instrument) 
    (state: EvaluationState) 
    (history: FullPriceHistory) : ResolvedInstrument =
    
    match instrument with
    | Asset assetRef -> 
        ResolvedAsset assetRef
    
    | Option optSpec ->
        let strike = PricingModels.findStrikeForDelta optSpec history state.CurrentDay state.RiskFreeRate
        let expiry = state.CurrentDay + optSpec.DTE
        let isCall = optSpec.GreekValue > 0.0
        
        ResolvedOption {
            Underlying = optSpec.Underlying
            Strike = strike
            ExpiryDay = expiry
            IsCall = isCall
        }

let interpretStep (program: Program) (currentState: EvaluationState) (priceHistory: FullPriceHistory) (costs: ExecutionCosts) (tax: TaxConfig) : EvaluationState =
    interpretBlock currentState priceHistory program.Statements costs tax