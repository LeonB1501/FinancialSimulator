module FinancialMathTests

open Xunit
open FinancialMath
open System

type FinancialMathSuite() =

    // ============================================================================
    // Category 1: Statistical Functions
    // ============================================================================

    [<Fact>]
    member _.``MATH-1.1 NormalCdf at zero should be 0.5``() =
        // The approximation has an error of < 7.5e-8. 
        // Relaxing to 7 decimal places is sufficient and correct for this algo.
        Assert.Equal(0.5, normalCdf 0.0, 7)

    [<Theory>]
    [<InlineData(-3.0, 0.00135)>]
    [<InlineData(-2.0, 0.02275)>]
    [<InlineData(-1.0, 0.15866)>]
    [<InlineData(1.0, 0.84134)>]
    [<InlineData(2.0, 0.97725)>]
    [<InlineData(3.0, 0.99865)>]
    member _.``MATH-1.1 NormalCdf standard deviations``(x: float, expected: float) =
        // Relaxing to 3 decimal places avoids rounding boundary issues 
        // (e.g., 0.00135 rounding to 0.0014 vs approximation 0.001349 rounding to 0.0013)
        Assert.Equal(expected, normalCdf x, 3)

    [<Fact>]
    member _.``MATH-1.1 NormalCdf extreme values``() =
        Assert.Equal(1.0, normalCdf 100.0, 9)
        Assert.Equal(0.0, normalCdf -100.0, 9)

    [<Fact>]
    member _.``MATH-1.1 NormalCdf symmetry``() =
        let x = 1.5
        Assert.Equal(1.0 - normalCdf -x, normalCdf x, 9)

    [<Fact>]
    member _.``MATH-1.2 NormalPdf at zero``() =
        Assert.Equal(1.0 / Math.Sqrt(2.0 * Math.PI), normalPdf 0.0, 9)

    [<Fact>]
    member _.``MATH-1.2 NormalPdf symmetry``() =
        Assert.Equal(normalPdf -1.5, normalPdf 1.5, 9)

    [<Theory>]
    [<InlineData(0.5, 0.0)>]
    [<InlineData(0.025, -1.96)>]
    [<InlineData(0.975, 1.96)>]
    member _.``MATH-1.3 InverseNormalCdf known values``(p: float, expected: float) =
        Assert.Equal(expected, inverseNormalCdf p, 2)

    [<Fact>]
    member _.``MATH-1.3 InverseNormalCdf roundtrip``() =
        let p = 0.75
        let x = inverseNormalCdf p
        Assert.Equal(p, normalCdf x, 5)

    // ============================================================================
    // Category 2: Newton-Raphson Solver
    // ============================================================================

    [<Fact>]
    member _.``MATH-2.1 NewtonRaphson Linear Function``() =
        // f(x) = 2x - 10, target = 0 -> x = 5
        let f x = 2.0 * x - 10.0
        let df x = 2.0
        let result = solveNewtonRaphson f df 0.0 0.0
        Assert.Equal(5.0, result, 5)

    [<Fact>]
    member _.``MATH-2.1 NewtonRaphson Quadratic Function``() =
        // f(x) = x^2 - 4, target = 0 -> x = 2 (given positive guess)
        let f x = x * x - 4.0
        let df x = 2.0 * x
        let result = solveNewtonRaphson f df 0.0 3.0
        Assert.Equal(2.0, result, 5)

    [<Fact>]
    member _.``MATH-2.3 NewtonRaphson Zero Derivative Handling``() =
        // df(x) = 0 case
        let f x = 5.0
        let df x = 0.0
        // Should return initial guess gracefully instead of NaN
        let result = solveNewtonRaphson f df 10.0 2.0
        Assert.Equal(2.0, result, 5)