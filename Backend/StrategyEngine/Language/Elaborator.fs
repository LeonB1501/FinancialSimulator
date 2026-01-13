module Elaborator

open AST
open Types

exception TypeError of string

// --- Core Data Structures & Helpers ---
type TypeContext = {
    ScopeStack: (Identifier * T_Type) list list
    GlobalScope: Map<Identifier, T_Type>
    PositionDefinitions: Map<Identifier, PositionExpression>
}

let emptyContext () = { ScopeStack = []; GlobalScope = Map.empty; PositionDefinitions = Map.empty }
let pushScope ctx = { ctx with ScopeStack = [] :: ctx.ScopeStack }
let popScope ctx = match ctx.ScopeStack with | _ :: rest -> { ctx with ScopeStack = rest } | [] -> failwith "FATAL: Pop from empty scope stack"

let lookup (id: Identifier) (ctx: TypeContext) : T_Type option =
    let rec searchLocal scopes =
        match scopes with
        | [] -> None
        | currentScope :: outerScopes ->
            match List.tryFind (fun (name, _) -> name = id) currentScope with
            | Some (_, t) -> Some t
            | None -> searchLocal outerScopes
    match searchLocal ctx.ScopeStack with
    | Some t -> Some t
    | None -> ctx.GlobalScope.TryFind(id)

let defineLocal (id: Identifier) (t: T_Type) (ctx: TypeContext) : Result<TypeContext, string> =
    match ctx.ScopeStack with
    | currentScope :: rest ->
        if List.exists (fun (name, _) -> name = id) currentScope then
            Error $"Identifier '{id}' is already defined in this scope."
        else
            let newScope = (id, t) :: currentScope
            Ok { ctx with ScopeStack = newScope :: rest }
    | [] -> failwith "FATAL: Cannot define local variable without a scope."

let defineGlobal (id: Identifier) (t: T_Type) (ctx: TypeContext) : Result<TypeContext, string> =
    if ctx.GlobalScope.ContainsKey(id) then Ok ctx
    else Ok { ctx with GlobalScope = ctx.GlobalScope.Add(id, t) }

let definePosition (name: Identifier) (posExpr: PositionExpression) (ctx: TypeContext) : Result<TypeContext, string> =
    // We allow overwriting position definitions (shadowing or redefinition) to be consistent with variable definitions
    Ok { ctx with PositionDefinitions = ctx.PositionDefinitions.Add(name, posExpr) }

// --- Refactored Helper Toolkit ---
type ElaborationResult<'a> = Result<'a, string>

type ResultBuilder() =
    member _.Bind(m, f) = Result.bind f m
    member _.Return(x) = Ok x
    member _.ReturnFrom(m: ElaborationResult<'a>) : ElaborationResult<'a> = m
    member _.Zero() : ElaborationResult<unit> = Ok ()
    member _.Combine(a: ElaborationResult<unit>, b: ElaborationResult<'a>) : ElaborationResult<'a> =
        match a with
        | Ok () -> b
        | Error e -> Error e
    member _.Delay(f: unit -> ElaborationResult<'a>) : ElaborationResult<'a> = f()
    member _.For(sequence: seq<'a>, body: 'a -> ElaborationResult<unit>) : ElaborationResult<unit> =
        let mutable currentResult: ElaborationResult<unit> = Ok ()
        use e = sequence.GetEnumerator()
        let mutable shouldContinue = true
        while shouldContinue && e.MoveNext() do
            match currentResult with
            | Ok () -> currentResult <- body e.Current
            | Error _ -> shouldContinue <- false
        currentResult
let result = ResultBuilder()

let lookupOrError id ctx =
    match lookup id ctx with
    | Some t -> Ok t
    | None -> 
        // IMPLICIT ASSET FIX: 
        // If an identifier is not found in variables, we assume it is an implicit Asset Reference.
        // This matches the behavior of the Interpreter which treats unbound IDs as Assets in some contexts.
        Ok T_Asset

let elaborateSeq elaborator ctx items =
    List.fold (fun ctxResult item ->
        result {
            let! currentCtx = ctxResult
            return! elaborator currentCtx item
        }
    ) (Ok ctx) items

let withScope (elaborationFunc: TypeContext -> ElaborationResult<TypeContext>) (ctx: TypeContext) =
    result {
        let blockCtx = pushScope ctx
        let! finalBlockCtx = elaborationFunc blockCtx
        return { finalBlockCtx with ScopeStack = ctx.ScopeStack }
    }

// --- Main Elaboration Functions ---

let rec private elaborateExpression (ctx: TypeContext) (expr: Expression) : ElaborationResult<T_Type> =
    result {
        match expr with
        | LiteralExpr(lit) ->
            match lit with
            | NumericLit(Number _) -> return T_Float
            | NumericLit(Percentage _) -> return T_Percent
            | NumericLit(Dollar _) -> return T_Dollar
            | BoolLit _ -> return T_Bool
        | IdentifierExpr(id) -> return! lookupOrError id ctx
        | AssetExpr _ -> return T_Asset
        | OptionExpr _ -> return! Error "Option specifications can only be used inside a 'buy' or 'sell' component."
        | ArithmeticExpr(op, e1, e2) ->
            let! t1 = elaborateExpression ctx e1
            let! t2 = elaborateExpression ctx e2
            
            // TYPE RESOLUTION FIX: Treat T_Asset as T_Dollar for arithmetic
            let resolveType t = if t = T_Asset then T_Dollar else t
            let rt1 = resolveType t1
            let rt2 = resolveType t2

            match (op, rt1, rt2) with
            | (Add | Subtract), T_Float, T_Float -> return T_Float
            | (Add | Subtract), T_Dollar, T_Dollar -> return T_Dollar
            | (Add | Subtract), T_Percent, T_Percent -> return T_Percent
            
            // LOOSENED RULES: Allow Float +/- Dollar (interpreted as Dollar result)
            | (Add | Subtract), T_Float, T_Dollar -> return T_Dollar
            | (Add | Subtract), T_Dollar, T_Float -> return T_Dollar

            | (Multiply | Modulo), T_Float, T_Float -> return T_Float
            | Multiply, T_Float, T_Percent -> return T_Percent
            | Multiply, T_Percent, T_Float -> return T_Percent
            | Multiply, T_Float, T_Dollar -> return T_Dollar
            | Multiply, T_Dollar, T_Float -> return T_Dollar
            | Multiply, T_Percent, T_Dollar -> return T_Dollar
            | Multiply, T_Dollar, T_Percent -> return T_Dollar
            
            | Divide, T_Float, T_Float -> return T_Float
            | Divide, T_Dollar, T_Float -> return T_Dollar
            | Divide, T_Dollar, T_Dollar -> return T_Float
            | Divide, T_Percent, T_Float -> return T_Percent
            
            | _ -> return! Error $"Operator '{op}' cannot be applied to operands of type '{t1}' and '{t2}'."
        | UnaryMinusExpr(e) ->
            let! t = elaborateExpression ctx e
            match t with
            | T_Float | T_Percent | T_Dollar -> return t
            | _ -> return! Error $"Unary minus requires a numeric operand, but got type '{t}'."
        | ParenExpr(e) -> return! elaborateExpression ctx e
        | IndicatorExpr _ -> return T_Float
        | PortfolioQueryExpr(query) ->
            match query with
            | CashAvailable -> 
                return T_Dollar
            | PortfolioValue -> 
                return T_Dollar
            | PositionQuantity id ->
                let! targetType = lookupOrError id ctx
                match targetType with
                | T_Asset | T_Position _ -> return T_Float
                | _ -> return! Error $"Cannot query info of '{id}' which is not an Asset or Position."
            | AST.PortfolioQuery.PositionValue id ->
                let! targetType = lookupOrError id ctx
                match targetType with
                | T_Asset | T_Position _ -> return T_Dollar
                | _ -> return! Error $"Cannot query info of '{id}' which is not an Asset or Position."
        | PropertyAccessExpr(pa) ->
            let! objectType = elaborateExpression ctx pa.Object
            match objectType with
            | T_Instance posInfo ->
                match pa.Property.ToLower() with
                | "dte" | "quantity" | "delta" | "gamma" | "theta" | "vega" | "rho" | "buy_date" -> return T_Float
                | "price" | "buy_price" | "value" -> return T_Dollar
                | nestedComponentName -> return! getTypeFromPositionDefinition ctx posInfo.Name [nestedComponentName]
            | t -> return! Error $"Property access via '.' can only be used on a position instance, but got type '{t}'."
    }
and private elaborateCondition (ctx: TypeContext) (cond: Condition) : ElaborationResult<unit> =
    result {
        let! condType = elaborateCondition' ctx cond
        if condType <> T_Bool then
            return! Error $"Expected a boolean condition, but got type '{condType}'."
    }
and private elaborateCondition' (ctx: TypeContext) (cond: Condition) : ElaborationResult<T_Type> =
    result {
        match cond with
        | ComparisonCond(_, e1, e2) ->
            let! t1 = elaborateExpression ctx e1
            let! t2 = elaborateExpression ctx e2
            
            // TYPE RESOLUTION FIX: Treat T_Asset as T_Dollar for comparison
            let resolveType t = if t = T_Asset then T_Dollar else t
            let rt1 = resolveType t1
            let rt2 = resolveType t2

            match (rt1, rt2) with
            | (T_Float, T_Float) | (T_Percent, T_Percent) | (T_Dollar, T_Dollar)
            | (T_Float, T_Percent) | (T_Percent, T_Float) 
            | (T_Dollar, T_Float) | (T_Float, T_Dollar) -> return T_Bool
            | (T_Bool, T_Bool) -> return T_Bool
            | _ -> return! Error $"Cannot compare types '{t1}' and '{t2}'."
        | LogicalCond(_, c1, c2) ->
            do! elaborateCondition ctx c1
            do! elaborateCondition ctx c2
            return T_Bool
        | NotCond(c) ->
            do! elaborateCondition ctx c
            return T_Bool
        | ParenCond(c) -> return! elaborateCondition' ctx c
        | BooleanExpr(e) ->
            let! t = elaborateExpression ctx e
            if t = T_Bool then return T_Bool
            else return! Error $"Expected a boolean condition, but expression has type '{t}'."
    }
and private elaborateStatement (ctx: TypeContext) (stmt: Statement) : ElaborationResult<TypeContext> =
    result {
        match stmt with
        | DefineStatement def ->
            let isGlobal = List.isEmpty ctx.ScopeStack
            let! valueType =
                match def.Value with
                | ExpressionValue e -> elaborateExpression ctx e
                | PositionValue p ->
                    result {
                        if not isGlobal then
                            return! Error "Position definitions are only allowed at the top level."
                        do! elaboratePositionExpression ctx p
                        return T_Position { Name = def.Name }
                    }

            let! ctx' = if isGlobal then defineGlobal def.Name valueType ctx else defineLocal def.Name valueType ctx
            
            // ALIAS REGISTRATION FIX: 
            // If we defined a variable using an expression (e.g., "define x as y") and 'y' was a position,
            // 'x' now has type T_Position. We must register 'x' as an alias to 'y' in PositionDefinitions
            // so that property access (x.quantity) and loops work correctly on the alias.
            match (def.Value, valueType) with
            | (PositionValue p, _) -> 
                return! definePosition def.Name p ctx'
            | (ExpressionValue(IdentifierExpr id), T_Position _) ->
                // 'def.Name' is now an alias for position 'id'
                return! definePosition def.Name (PositionReference id) ctx'
            | _ -> 
                return ctx'

        | SetStatement setStmt ->
            let! varType = lookupOrError setStmt.Name ctx
            let! exprType = elaborateExpression ctx setStmt.Value
            
            // Allow setting numeric vars with compatible types (e.g. Dollar to Float loose checking if needed, but strict for now)
            // If varType is Asset, we can't set it (Assets are immutable references typically), but let's assume check passes if types match
            if varType <> exprType then
                return! Error $"Type mismatch: Cannot set variable '{setStmt.Name}' of type '{varType}' to an expression of type '{exprType}'."
            return ctx
        | ActionStatement action ->
            do! elaborateAction ctx action
            return ctx
        | ConditionalStatement condStmt ->
            do! elaborateCondition ctx condStmt.Condition
            let! finalBlockCtx = withScope (fun blockCtx -> elaborateBlock blockCtx condStmt.ThenBlock) ctx
            return { ctx with GlobalScope = finalBlockCtx.GlobalScope }
        | ForAnyPositionStatement loopStmt ->
            let! posType = lookupOrError loopStmt.PositionType ctx
            match posType with
            | T_Position posInfo ->
                let! finalBlockCtx =
                    withScope (fun blockCtx ->
                        result {
                            let! blockCtxWithVar = defineLocal loopStmt.InstanceVariable (T_Instance posInfo) blockCtx
                            return! elaborateBlock blockCtxWithVar loopStmt.Block
                        }
                    ) ctx
                return { ctx with GlobalScope = finalBlockCtx.GlobalScope }
            | t -> return! Error $"Cannot loop over '{loopStmt.PositionType}', which is not a position but a '{t}'."
    }
and private elaborateAction (ctx: TypeContext) (action: Action) : ElaborationResult<unit> =
    // Helper function to get the type of a quantity.
    let getQtyType (q: Quantity) =
        match q with
        | LiteralQuantity(Number _) -> Ok T_Float
        | LiteralQuantity _ -> Error "Only plain numbers can be used as a trade quantity."
        | ExpressionQuantity e -> elaborateExpression ctx e
        | IdentifierQuantity id -> lookupOrError id ctx

    result {
        // Step 1: Determine the quantity type (if applicable).
        let! qtyType =
            match action with
            | Buy (q, _) 
            | Sell (q, _) -> 
                getQtyType q
            | _ -> 
                Ok T_Float // Actions without a quantity don't need this check.

        // Step 2: Validate the quantity type.
        if qtyType <> T_Float then
            return! Error $"Expected a plain number (T_Float) for the quantity, but got an expression of type '{qtyType}'."

        // Step 3: Determine the target type.
        let target = 
            match action with 
            | Buy(_,t) 
            | Sell(_,t) 
            | BuyMax t 
            | SellAll t 
            | RebalanceTo(_,t) -> t
        
        let! targetType =
            match target with
            | AssetTarget _ -> Ok T_Asset
            | IdentifierTarget id -> lookupOrError id ctx
        
        // Step 4: Validate the target type.
        match targetType with
        | T_Asset 
        | T_Position _ 
        | T_Instance _ -> 
            return () // Success
        | t -> 
            return! Error $"Invalid target for a trade action. Expected a tradable type, but got '{t}'."
    }
and private elaboratePositionExpression (ctx: TypeContext) (posExpr: PositionExpression) : ElaborationResult<unit> =
    result {
        match posExpr with
        | ComponentExpr comp ->
            let (qty, instrument) = match comp with | BuyComponent(q, i) -> (q, i) | SellComponent(q, i) -> (q, i)
            
            let! qtyType = 
                match qty with
                | LiteralQuantity(Number _) -> Ok T_Float
                | IdentifierQuantity id -> lookupOrError id ctx
                | ExpressionQuantity e -> elaborateExpression ctx e
                | _ -> Error "Invalid quantity in position definition"
            
            if qtyType <> T_Float then return! Error "Quantity in position definition must be a plain number."

            match instrument with
            | Option optSpec ->
                if optSpec.DTE <= 0 then return! Error $"Option DTE must be positive, but got {optSpec.DTE}."
                
                // FIX: Allow negative range (-1.0 to 1.0), excluding exactly 0
                if optSpec.GreekValue = 0.0 || abs(optSpec.GreekValue) >= 1.0 then
                    return! Error $"Option delta '{optSpec.GreekValue}' is out of the valid range (-1.0, 1.0)."
            | Asset _ -> ()
        | CompoundExpr(left, right) ->
            do! elaboratePositionExpression ctx left
            do! elaboratePositionExpression ctx right
        | PositionReference id ->
            let! refType = lookupOrError id ctx
            match refType with
            | T_Position _ -> return ()
            | t -> return! Error $"Identifier '{id}' is not a position definition, it has type '{t}'."
    }
and private getTypeFromPositionDefinition (ctx: TypeContext) (posName: Identifier) (componentPath: Identifier list) : ElaborationResult<T_Type> =
    result {
        match ctx.PositionDefinitions.TryFind(posName) with
        | None -> return! Error $"Internal Error: Could not find definition for position '{posName}'."
        | Some posExpr ->
            match componentPath with
            | [] -> return T_Instance { Name = posName }
            | componentName :: restOfPath ->
                let rec findComponent (expr: PositionExpression) =
                    match expr with
                    | PositionReference(refName) ->
                        if refName = componentName then Some (getTypeFromPositionDefinition ctx refName restOfPath)
                        else None
                    | CompoundExpr(left, right) ->
                        match left with
                        | PositionReference(refName) when refName = componentName -> Some (getTypeFromPositionDefinition ctx refName restOfPath)
                        | _ -> findComponent right
                    | ComponentExpr _ -> None
                match findComponent posExpr with
                | Some t -> return! t
                | None -> return! Error $"Position '{posName}' does not have a named component '{componentName}'."
    }
and private elaborateBlock (ctx: TypeContext) (statements: Statement list) : ElaborationResult<TypeContext> =
    elaborateSeq elaborateStatement ctx statements

// --- Top-Level Program Elaboration ---
let private checkAcyclicPositions (ctx: TypeContext) =
    result {
        let dependencyGraph =
            ctx.PositionDefinitions
            |> Map.map (fun _ posExpr ->
                let rec getDependencies (expr: PositionExpression) =
                    match expr with
                    | ComponentExpr _ -> Set.empty
                    | PositionReference id -> Set.singleton id
                    | CompoundExpr(l, r) -> Set.union (getDependencies l) (getDependencies r)
                getDependencies posExpr)

        let rec visit (path: Identifier list) (node: Identifier) =
            result {
                if List.contains node path then
                    let cyclePath = (node :: path) |> List.rev |> String.concat " -> "
                    return! Error $"Cyclic position definition detected: {cyclePath}"
                
                match dependencyGraph.TryFind(node) with
                | Some dependencies ->
                    for dep in dependencies do
                        do! visit (node :: path) dep
                | None -> ()
            }
        for key in ctx.PositionDefinitions.Keys do
            do! visit [] key
    }

let rec private getExpressionLookback (expr: Expression) : int =
    match expr with
    | IndicatorExpr ind -> 
        // If period is specified, use it. Defaults: SMA/EMA/Vol=20, RSI=14, Return=1
        match ind.Period with
        | Some p -> p
        | None -> 
            match ind.IndicatorType with
            | SMA | EMA | Vol -> 20
            | RSI -> 14
            | Return | PastPrice -> 1
    | ArithmeticExpr(_, e1, e2) -> max (getExpressionLookback e1) (getExpressionLookback e2)
    | UnaryMinusExpr e -> getExpressionLookback e
    | ParenExpr e -> getExpressionLookback e
    | PropertyAccessExpr pa -> getExpressionLookback pa.Object
    | _ -> 0

let rec private getConditionLookback (cond: Condition) : int =
    match cond with
    | ComparisonCond(_, e1, e2) -> max (getExpressionLookback e1) (getExpressionLookback e2)
    | LogicalCond(_, c1, c2) -> max (getConditionLookback c1) (getConditionLookback c2)
    | NotCond c -> getConditionLookback c
    | ParenCond c -> getConditionLookback c
    | BooleanExpr e -> getExpressionLookback e

let rec private getStatementLookback (stmt: Statement) : int =
    match stmt with
    | DefineStatement def ->
        match def.Value with
        | ExpressionValue e -> getExpressionLookback e
        | PositionValue _ -> 0
    | SetStatement set -> getExpressionLookback set.Value
    | ConditionalStatement cond ->
        let cLook = getConditionLookback cond.Condition
        let bLook = cond.ThenBlock |> List.map getStatementLookback |> List.fold max 0
        max cLook bLook
    | ForAnyPositionStatement loop ->
        loop.Block |> List.map getStatementLookback |> List.fold max 0
    | ActionStatement action ->
        match action with
        | Buy(q, _) | Sell(q, _) -> 
            match q with
            | ExpressionQuantity e -> getExpressionLookback e
            | _ -> 0
        | _ -> 0

let calculateMaxLookback (program: Program) : int =
    program.Statements 
    |> List.map getStatementLookback 
    |> List.fold max 0


let elaborateProgram (program: Program) : Result<Program, string> =
    result {
        let! finalContext = elaborateBlock (emptyContext()) program.Statements
        do! checkAcyclicPositions finalContext
        return program
    }