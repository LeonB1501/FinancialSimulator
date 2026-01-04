module FinancialMath

open System

// ============================================================================
// STATISTICAL FUNCTIONS
// ============================================================================

/// Standard Normal Cumulative Distribution Function (Abramowitz & Stegun approximation)
/// Error < 7.5e-8
let normalCdf (x: float) : float =
    let b1 = 0.319381530
    let b2 = -0.356563782
    let b3 = 1.781477937
    let b4 = -1.821255978
    let b5 = 1.330274429
    let p = 0.2316419
    let c = 0.39894228

    if x >= 0.0 then
        let t = 1.0 / (1.0 + p * x)
        1.0 - c * System.Math.Exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1)
    else
        let t = 1.0 / (1.0 + p * -x)
        c * System.Math.Exp(-x * x / 2.0) * t * (t * (t * (t * (t * b5 + b4) + b3) + b2) + b1)

/// Standard Normal Probability Density Function
let normalPdf (x: float) : float =
    (1.0 / System.Math.Sqrt(2.0 * System.Math.PI)) * System.Math.Exp(-0.5 * x * x)

/// Inverse Normal CDF (Acklam's Algorithm or Rational Approximation)
/// Needed for finding Strike from Delta
let inverseNormalCdf (p: float) : float =
    if p <= 0.0 || p >= 1.0 then failwith "Input p must be between 0 and 1"
    
    // Coefficients for rational approximation
    let a = [| -3.969683028665376e+01; 2.209460984245205e+02; -2.759285104469687e+02; 1.383577518672690e+02; -3.066479806614716e+01; 2.506628277459239e+00 |]
    let b = [| -5.447609879822406e+01; 1.615858368580409e+02; -1.556989798598866e+02; 6.680131188771972e+01; -1.328068155288572e+01 |]
    let c = [| -7.784894002430293e-03; -3.223964580411365e-01; -2.400758277161838e+00; -2.549732539343734e+00; 4.374664141464968e+00; 2.938163982698783e+00 |]
    let d = [| 7.784695709041462e-03; 3.224671290700398e-01; 2.445134137142996e+00; 3.754408661907416e+00 |]

    let low = 0.02425
    let high = 1.0 - low

    if p < low then
        let q = System.Math.Sqrt(-2.0 * System.Math.Log(p))
        (((((c.[0]*q + c.[1])*q + c.[2])*q + c.[3])*q + c.[4])*q + c.[5]) /
        ((((d.[0]*q + d.[1])*q + d.[2])*q + d.[3])*q + 1.0)
    elif p > high then
        let q = System.Math.Sqrt(-2.0 * System.Math.Log(1.0 - p))
        -(((((c.[0]*q + c.[1])*q + c.[2])*q + c.[3])*q + c.[4])*q + c.[5]) /
        ((((d.[0]*q + d.[1])*q + d.[2])*q + d.[3])*q + 1.0)
    else
        let q = p - 0.5
        let r = q * q
        (((((a.[0]*r + a.[1])*r + a.[2])*r + a.[3])*r + a.[4])*r + a.[5]) * q /
        (((((b.[0]*r + b.[1])*r + b.[2])*r + b.[3])*r + b.[4])*r + 1.0)

// ============================================================================
// NUMERICAL SOLVERS
// ============================================================================

/// Newton-Raphson solver to find root of f(x) = target
/// f: Function to evaluate
/// df: Derivative of f (optional, if known)
/// target: The value we want f(x) to equal
/// initialGuess: Starting point
let solveNewtonRaphson (f: float -> float) (df: float -> float) (target: float) (initialGuess: float) : float =
    let tolerance = 1e-5
    let maxIter = 50
    
    let rec loop x iter =
        if iter >= maxIter then x // Fail gracefully by returning best guess
        else
            let y = f x
            let diff = y - target
            if abs diff < tolerance then x
            else
                let slope = df x
                if abs slope < 1e-9 then x // Avoid division by zero
                else
                    let xNew = x - (diff / slope)
                    loop xNew (iter + 1)
    
    loop initialGuess 0
