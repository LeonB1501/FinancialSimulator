// PATH: StrategyEngine.Tests/LexerTests.fs
module LexerTests

open Xunit
open FsUnit.Xunit
open Tokens
open AST
open Lexer

// Define a standard set of tickers to provide context to the lexer for all tests.
let private testTickerSet = Set.ofList ["spy"; "qqq"; "iwm"; "brk_b"]

type LexerSuite() =

    // --- Category: Whitespace and Basic Tokens ---

    [<Fact>]
    member _.``LEX-001 Empty Input should return only EOF``() =
        let input = ""
        let expected = [ T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-002 Whitespace Only should be ignored``() =
        let input = "   \t \n \r  "
        let expected = [ T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-003 Single-Character Tokens should be recognized``() =
        let input = "( : . + * / %"
        let expected = [ T_LPAREN; T_COLON; T_DOT; T_PLUS; T_MULTIPLY; T_DIVIDE; T_MODULO; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-004 Multi-Character Operators should be recognized``() =
        let input = ">= <= == !="
        let expected = [ T_GREATER_EQ; T_LESS_EQ; T_EQUAL; T_NOT_EQUAL; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-005 Invalid Character should throw LexerError``() =
        let input = "define x as ?"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    // --- Category: Numeric Literals ---

    [<Fact>]
    member _.``LEX-008 Negative Number should be a single token``() =
        let input = "-50"
        let expected = [ T_NUMBER(-50.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-009 Minus Operator should be distinct from negative number``() =
        let input = "10 - 5"
        let expected = [ T_NUMBER(10.0); T_MINUS; T_NUMBER(5.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-010 Percentage should be a single token``() =
        let input = "50.5%"
        let expected = [ T_PERCENTAGE(50.5); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-011 Dollar Amount should be a single token``() =
        let input = "$1000.50"
        let expected = [ T_DOLLAR(1000.50); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    // --- Category: Identifier-like Tokens ---

    [<Fact>]
    member _.``LEX-013 Case-Insensitive Keyword should be recognized``() =
        let input = "DeFiNe"
        let expected = [ T_DEFINE; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-014 Generic Identifier should be the fallback``() =
        let input = "my_variable"
        let expected = [ T_IDENTIFIER("my_variable"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-015 Simple Asset should be recognized from context``() =
        let input = "spy"
        let expected = [ T_ASSET_REFERENCE(SimpleAsset("spy")); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-016 Leveraged Asset should be recognized``() =
        let input = "qqq_3x"
        let expected = [ T_ASSET_REFERENCE(LeveragedAsset("qqq", 3.0)); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-017 Inverse Leveraged Asset should be recognized``() =
        let input = "spy_minus1x"
        let expected = [ T_ASSET_REFERENCE(LeveragedAsset("spy", -1.0)); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-018 Simple Indicator should be a structured token``() =
        let input = "spy_vol"
        let expected = [ T_INDICATOR({ Asset = "spy"; TypeName = "vol"; Period = None }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-019 Complex Indicator should be a structured token``() =
        let input = "qqq_ema_50"
        let expected = [ T_INDICATOR({ Asset = "qqq"; TypeName = "ema"; Period = Some 50 }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-020 Option Specification should be a structured token``() =
        let input = "spy_365dte_70delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 365
            GreekType = Delta
            GreekValue = 0.70
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-021 Keyword-like Identifier should be an identifier``() =
        let input = "define_new_strategy"
        let expected = [ T_IDENTIFIER("define_new_strategy"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected
        
    
    [<Fact>]
    member _.``LEX-101 Negative zero should be parsed``() =
        let input = "-0"
        let expected = [ T_NUMBER(-0.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-103 Trailing decimal point should parse as number``() =
        let input = "5."
        let expected = [ T_NUMBER(5.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-105 Very large number should be parsed``() =
        let input = "999999999999.99"
        let expected = [ T_NUMBER(999999999999.99); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-106 Very small number should be parsed``() =
        let input = "0.00000001"
        let expected = [ T_NUMBER(0.00000001); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-107 Negative percentage should be parsed``() =
        let input = "-25.5%"
        let expected = [ T_PERCENTAGE(-25.5); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-108 Zero percentage should be parsed``() =
        let input = "0%"
        let expected = [ T_PERCENTAGE(0.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-109 Percentage over 100 should be parsed``() =
        let input = "150%"
        let expected = [ T_PERCENTAGE(150.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-110 Dollar with no cents should be parsed``() =
        let input = "$1000"
        let expected = [ T_DOLLAR(1000.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-111 Dollar with leading zero should be parsed``() =
        let input = "$0.50"
        let expected = [ T_DOLLAR(0.50); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-112 Empty dollar should throw LexerError``() =
        let input = "$"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    // --- Category: Complex Asset References ---

    [<Fact>]
    member _.``LEX-200 Asset with underscore in base name should be recognized``() =
        let input = "brk_b"
        let expected = [ T_ASSET_REFERENCE(SimpleAsset("brk_b")); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-202 High leverage multiplier should be recognized``() =
        let input = "qqq_10x"
        let expected = [ T_ASSET_REFERENCE(LeveragedAsset("qqq", 10.0)); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-204 Asset-like string not in ticker set should be identifier``() =
        let input = "unknown_ticker"
        let expected = [ T_IDENTIFIER("unknown_ticker"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-205 Leveraged asset with underscored base should be recognized``() =
        let input = "brk_b_3x"
        let expected = [ T_ASSET_REFERENCE(LeveragedAsset("brk_b", 3.0)); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-206 Ambiguous minus pattern should be identifier``() =
        let input = "minus_2x"
        let expected = [ T_IDENTIFIER("minus_2x"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected
        
    // --- Category: Indicator Variations ---

    [<Fact>]
    member _.``LEX-300 Indicator without period should be structured token``() =
        let input = "spy_vol"
        let expected = [ T_INDICATOR({ Asset = "spy"; TypeName = "vol"; Period = None }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-301 Indicator with large period should be structured token``() =
        let input = "spy_sma_500"
        let expected = [ T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 500 }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-302 All indicator types should be recognized``() =
        let input = "spy_sma_50 spy_ema_20 spy_rsi_14 spy_vol spy_return spy_pastprice"
        let expected = [
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 50 })
            T_INDICATOR({ Asset = "spy"; TypeName = "ema"; Period = Some 20 })
            T_INDICATOR({ Asset = "spy"; TypeName = "rsi"; Period = Some 14 })
            T_INDICATOR({ Asset = "spy"; TypeName = "vol"; Period = None })
            T_INDICATOR({ Asset = "spy"; TypeName = "return"; Period = None })
            T_INDICATOR({ Asset = "spy"; TypeName = "pastprice"; Period = None })
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-303 Case insensitive indicator should be recognized``() =
        let input = "SPY_SMA_200"
        let expected = [ T_INDICATOR({ Asset = "SPY"; TypeName = "sma"; Period = Some 200 }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-304 Indicator on leveraged asset name should be identifier``() =
        let input = "qqq_3x_sma_50"
        let expected = [ T_IDENTIFIER("qqq_3x_sma_50"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-305 Numeric asset name in indicator should be recognized``() =
        let input = "spy500_ema_30"
        let expected = [ T_INDICATOR({ Asset = "spy500"; TypeName = "ema"; Period = Some 30 }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-306 Indicator that looks like option should be indicator``() =
        let input = "spy_return_30"
        let expected = [ T_INDICATOR({ Asset = "spy"; TypeName = "return"; Period = Some 30 }); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    // --- Category: Option Specifications ---

    [<Fact>]
    member _.``LEX-400 Option with gamma greek should be structured token``() =
        let input = "spy_30dte_50gamma"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 30
            GreekType = Gamma
            GreekValue = 0.50
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-401 Option with theta greek should be structured token``() =
        let input = "qqq_60dte_5theta"
        let expectedSpec = {
            Underlying = SimpleAsset("qqq")
            DTE = 60
            GreekType = Theta
            GreekValue = 0.05
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-402 Option with vega greek should be structured token``() =
        let input = "iwm_90dte_15vega"
        let expectedSpec = {
            Underlying = SimpleAsset("iwm")
            DTE = 90
            GreekType = Vega
            GreekValue = 0.15
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-403 Option with rho greek should be structured token``() =
        let input = "spy_180dte_10rho"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 180
            GreekType = Rho
            GreekValue = 0.10
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-405 Option with very high DTE should be structured token``() =
        let input = "spy_730dte_50delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 730
            GreekType = Delta
            GreekValue = 0.50
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-406 Option with low DTE should be structured token``() =
        let input = "spy_1dte_50delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 1
            GreekType = Delta
            GreekValue = 0.50
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-407 Option on leveraged underlying should be structured token``() =
        let input = "qqq_3x_45dte_60delta"
        let expectedSpec = {
            Underlying = LeveragedAsset("qqq", 3.0)
            DTE = 45
            GreekType = Delta
            GreekValue = 0.60
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-408 Option case insensitivity should work``() =
        let input = "SPY_30DTE_50DELTA"
        let expectedSpec = {
            Underlying = SimpleAsset("SPY")
            DTE = 30
            GreekType = Delta
            GreekValue = 0.50
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-409 Malformed option missing greek should be identifier``() =
        let input = "spy_30dte_50"
        let expected = [ T_IDENTIFIER("spy_30dte_50"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-410 Malformed option invalid greek should be identifier``() =
        let input = "spy_30dte_50invalid"
        let expected = [ T_IDENTIFIER("spy_30dte_50invalid"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected
        
    // --- Category: Keywords and Identifiers ---
    
    [<Fact>]
    member _.``LEX-411 Option with 'minus' keyword for negative delta``() =
        let input = "spy_30dte_minus50delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 30
            GreekType = Delta
            GreekValue = -0.50 // -50 / 100
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-412 Option with hyphen symbol for negative delta``() =
        let input = "spy_30dte_-50delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 30
            GreekType = Delta
            GreekValue = -0.50
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-413 Option with negative theta using decimal``() =
        // Theta is often small, e.g., -0.5
        let input = "iwm_7dte_minus0.5theta"
        let expectedSpec = {
            Underlying = SimpleAsset("iwm")
            DTE = 7
            GreekType = Theta
            GreekValue = -0.005 // -0.5 / 100
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-414 Option with mixed case 'MiNuS'``() =
        let input = "qqq_45dte_MiNuS30delta"
        let expectedSpec = {
            Underlying = SimpleAsset("qqq")
            DTE = 45
            GreekType = Delta
            GreekValue = -0.30
        }
        let expected = [ T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-500 All action keywords should be recognized``() =
        let input = "buy sell buy_max sell_all rebalance_to"
        let expected = [ T_BUY; T_SELL; T_BUY_MAX; T_SELL_ALL; T_REBALANCE_TO; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-501 All boolean operators should be recognized``() =
        let input = "and or not"
        let expected = [ T_AND; T_OR; T_NOT; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-502 All comparison operators should be recognized``() =
        let input = "> < >= <= == !="
        let expected = [ T_GREATER; T_LESS; T_GREATER_EQ; T_LESS_EQ; T_EQUAL; T_NOT_EQUAL; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-503 Mixed case keyword should be recognized``() =
        let input = "BuY_MaX"
        let expected = [ T_BUY_MAX; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-504 Keyword as prefix of identifier should be identifier``() =
        let input = "buy_my_asset"
        let expected = [ T_IDENTIFIER("buy_my_asset"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-505 Identifier with numbers should be recognized``() =
        let input = "strategy_v2"
        let expected = [ T_IDENTIFIER("strategy_v2"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-506 Identifier with multiple underscores should be recognized``() =
        let input = "my_complex_var_name"
        let expected = [ T_IDENTIFIER("my_complex_var_name"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-507 Single letter identifier should be recognized``() =
        let input = "x"
        let expected = [ T_IDENTIFIER("x"); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-508 Reserved word variations should be recognized``() =
        let input = "cash_available portfolio_value position_quantity position_value"
        let expected = [ T_CASH_AVAILABLE; T_PORTFOLIO_VALUE; T_POSITION_QUANTITY; T_POSITION_VALUE; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-509 Boolean literals should be recognized``() =
        let input = "true false"
        let expected = [ T_TRUE; T_FALSE; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-510 T_bills keyword should be recognized``() =
        let input = "t_bills"
        let expected = [ T_T_BILLS; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    // --- Category: Operator Sequences ---

    [<Fact>]
    member _.``LEX-600 All arithmetic operators should be recognized``() =
        let input = "+ - * / %"
        let expected = [ T_PLUS; T_MINUS; T_MULTIPLY; T_DIVIDE; T_MODULO; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-601 Minus vs negative disambiguation in expression should work``() =
        let input = "10 - -5"
        let expected = [ T_NUMBER(10.0); T_MINUS; T_NUMBER(-5.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-602 Multiple minuses should be parsed``() =
        let input = "---5"
        let expected = [ T_MINUS; T_MINUS; T_NUMBER(-5.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-603 Operators without spaces should be recognized``() =
        let input = "5+3*2"
        let expected = [ T_NUMBER(5.0); T_PLUS; T_NUMBER(3.0); T_MULTIPLY; T_NUMBER(2.0); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-604 Comparison operators clustered should use greedy matching``() =
        let input = ">=>"
        let expected = [ T_GREATER_EQ; T_GREATER; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-605 Single equal should throw error or parse unusually``() =
        let input = "="
        // Your lexer doesn't have T_ASSIGN, so this should throw an error
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore
        
    // --- Category: Complex Real-World Scenarios ---

    [<Fact>]
    member _.``LEX-700 Simple strategy line should be tokenized``() =
        let input = "buy 50% spy"
        let expected = [ T_BUY; T_PERCENTAGE(50.0); T_ASSET_REFERENCE(SimpleAsset("spy")); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-701 Condition with comparison should be tokenized``() =
        let input = "spy > spy_sma_200"
        let expected = [
            T_ASSET_REFERENCE(SimpleAsset("spy"))
            T_GREATER
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 200 })
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-702 Option position definition should be tokenized``() =
        let input = "buy 1 spy_365dte_70delta"
        let expectedSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 365
            GreekType = Delta
            GreekValue = 0.70
        }
        let expected = [ T_BUY; T_NUMBER(1.0); T_OPTION_SPEC(expectedSpec); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-703 Property access chain should be tokenized``() =
        let input = "position.price.value"
        let expected = [
            T_IDENTIFIER("position")
            T_DOT
            T_IDENTIFIER("price")
            T_DOT
            T_IDENTIFIER("value")
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-704 Function-like call should be tokenized``() =
        let input = "position_quantity(my_spread)"
        let expected = [
            T_POSITION_QUANTITY
            T_LPAREN
            T_IDENTIFIER("my_spread")
            T_RPAREN
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-705 Complex expression should be tokenized``() =
        let input = "(spy_sma_50 - spy_sma_200) / spy_sma_200 > 0.01"
        let expected = [
            T_LPAREN
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 50 })
            T_MINUS
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 200 })
            T_RPAREN
            T_DIVIDE
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 200 })
            T_GREATER
            T_NUMBER(0.01)
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-706 Multiple statements on one line should be tokenized``() =
        let input = "buy 50% spy sell 30% qqq"
        let expected = [
            T_BUY
            T_PERCENTAGE(50.0)
            T_ASSET_REFERENCE(SimpleAsset("spy"))
            T_SELL
            T_PERCENTAGE(30.0)
            T_ASSET_REFERENCE(SimpleAsset("qqq"))
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-707 Nested parentheses should be tokenized``() =
        let input = "((spy + qqq) * 0.5)"
        let expected = [
            T_LPAREN
            T_LPAREN
            T_ASSET_REFERENCE(SimpleAsset("spy"))
            T_PLUS
            T_ASSET_REFERENCE(SimpleAsset("qqq"))
            T_RPAREN
            T_MULTIPLY
            T_NUMBER(0.5)
            T_RPAREN
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-708 Mixed asset types in sequence should be tokenized``() =
        let input = "spy qqq_3x spy_30dte_50delta spy_sma_200"
        let expectedOptionSpec = {
            Underlying = SimpleAsset("spy")
            DTE = 30
            GreekType = Delta
            GreekValue = 0.50
        }
        let expected = [
            T_ASSET_REFERENCE(SimpleAsset("spy"))
            T_ASSET_REFERENCE(LeveragedAsset("qqq", 3.0))
            T_OPTION_SPEC(expectedOptionSpec)
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 200 })
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-709 Define statement should be tokenized``() =
        let input = "define allocation_pct as 60%"
        let expected = [
            T_DEFINE
            T_IDENTIFIER("allocation_pct")
            T_AS
            T_PERCENTAGE(60.0)
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-710 When block header should be tokenized``() =
        let input = "when spy > spy_sma_200:"
        let expected = [
            T_WHEN
            T_ASSET_REFERENCE(SimpleAsset("spy"))
            T_GREATER
            T_INDICATOR({ Asset = "spy"; TypeName = "sma"; Period = Some 200 })
            T_COLON
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-711 For loop header should be tokenized``() =
        let input = "for_any_position my_spread as s:"
        let expected = [
            T_FOR_ANY_POSITION
            T_IDENTIFIER("my_spread")
            T_AS
            T_IDENTIFIER("s")
            T_COLON
            T_EOF
        ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-712 Multi-line with whitespace varieties should normalize``() =
        let input = "buy\t50%\n\rspy"
        let expected = [ T_BUY; T_PERCENTAGE(50.0); T_ASSET_REFERENCE(SimpleAsset("spy")); T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    // --- Category: Error Handling ---

    [<Fact>]
    member _.``LEX-800 Invalid character in middle should throw LexerError``() =
        let input = "buy @ spy"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    [<Fact>]
    member _.``LEX-801 Unclosed dollar should throw LexerError``() =
        let input = "$abc"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    [<Fact>]
    member _.``LEX-802 Special characters should throw LexerError``() =
        let input = "#hashtag"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    [<Fact>]
    member _.``LEX-803 Unicode characters should throw LexerError``() =
        let input = "spy €100"
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

    [<Fact>]
    member _.``LEX-804 Empty parentheses should be tokenized``() =
        let input = "()"
        let expected = [ T_LPAREN; T_RPAREN; T_EOF ]
        let actual = lex testTickerSet input
        actual |> should equal expected

    [<Fact>]
    member _.``LEX-805 Mismatched operators should be tokenized separately``() =
        let input = "=!"
        // Since there's no single '=' token, this should throw an error on '='
        Assert.Throws<LexerError>(fun () -> lex testTickerSet input |> ignore) |> ignore

