module StochasticTests

open Xunit
open FsUnit.Xunit
open StrategyEngine.Simulation.Stochastic
open System

type StochasticSuite() =

    // ============================================================================
    // STATISTICAL HELPERS
    // ============================================================================

    let calculateMean (data: float[]) =
        data |> Array.average

    let calculateStdDev (data: float[]) =
        let mean = calculateMean data
        let sumSqDiff = data |> Array.sumBy (fun x -> Math.Pow(x - mean, 2.0))
        Math.Sqrt(sumSqDiff / float data.Length)

    let calculateSkewness (data: float[]) =
        let mean = calculateMean data
        let stdDev = calculateStdDev data
        let n = float data.Length
        let sumCubedDiff = data |> Array.sumBy (fun x -> Math.Pow((x - mean) / stdDev, 3.0))
        sumCubedDiff / n

    let calculateKurtosis (data: float[]) =
        let mean = calculateMean data
        let stdDev = calculateStdDev data
        let n = float data.Length
        let sumQuarticDiff = data |> Array.sumBy (fun x -> Math.Pow((x - mean) / stdDev, 4.0))
        sumQuarticDiff / n

    let calculateCorrelation (data1: float[]) (data2: float[]) =
        let n = float data1.Length
        let mean1 = calculateMean data1
        let mean2 = calculateMean data2
        
        let numerator = 
            Array.zip data1 data2 
            |> Array.sumBy (fun (x, y) -> (x - mean1) * (y - mean2))
        
        let stdDev1 = calculateStdDev data1
        let stdDev2 = calculateStdDev data2
        
        numerator / (n * stdDev1 * stdDev2)

    // ============================================================================
    // Category 1: Random Number Generation (Deep Dive)
    // ============================================================================

    [<Fact>]
    member _.``RNG-1.1 Determinism - Same seed produces same sequence``() =
        let rng1 = NormalRandom(12345)
        let rng2 = NormalRandom(12345)
        let seq1 = Array.init 100 (fun _ -> rng1.Next())
        let seq2 = Array.init 100 (fun _ -> rng2.Next())
        seq1 |> should equal seq2

    [<Fact>]
    member _.``RNG-1.3 Statistical Properties (Mean ~0, StdDev ~1)``() =
        let rng = NormalRandom(42)
        let n = 200_000
        let samples = Array.init n (fun _ -> rng.Next())
        
        let mean = calculateMean samples
        let stdDev = calculateStdDev samples
        
        Assert.InRange(mean, -0.01, 0.01)
        Assert.InRange(stdDev, 0.99, 1.01)

    [<Fact>]
    member _.``RNG-1.4 Normality Check (Skewness ~0, Kurtosis ~3)``() =
        let rng = NormalRandom(99)
        let n = 200_000
        let samples = Array.init n (fun _ -> rng.Next())

        let skew = calculateSkewness samples
        let kurt = calculateKurtosis samples

        // Skewness for Normal is 0
        Assert.InRange(skew, -0.05, 0.05)
        
        // Kurtosis for Normal is 3
        Assert.InRange(kurt, 2.90, 3.10)

    [<Fact>]
    member _.``RNG-1.5 Box-Muller Pair Independence``() =
        // Box-Muller generates numbers in pairs (u, v).
        // We need to ensure u is not correlated with v.
        let rng = NormalRandom(777)
        let n = 100_000
        let samples = Array.init n (fun _ -> rng.Next())
        
        // Split into Odds and Evens
        let evens = samples |> Array.mapi (fun i x -> if i % 2 = 0 then Some x else None) |> Array.choose id
        let odds  = samples |> Array.mapi (fun i x -> if i % 2 = 1 then Some x else None) |> Array.choose id
        
        let correlation = calculateCorrelation evens odds
        
        // Should be 0
        Assert.InRange(correlation, -0.02, 0.02)

    // ============================================================================
    // Category 2: Linear Algebra (Cholesky Robustness)
    // ============================================================================

    [<Fact>]
    member _.``LA-2.1 Cholesky of Identity Matrix``() =
        // FIXED: Jagged Array syntax
        let identity = [| [| 1.0; 0.0 |]; [| 0.0; 1.0 |] |]
        let result = LinearAlgebra.choleskyDecomposition identity
        
        // Deep equality check for arrays of arrays
        Assert.Equal(identity.Length, result.Length)
        for i in 0 .. identity.Length - 1 do
            Assert.Equal<float>(identity.[i], result.[i])

    [<Fact>]
    member _.``LA-2.4 Cholesky 3x3 Matrix``() =
        // A valid 3x3 correlation matrix
        // 1.0  0.6  0.3
        // 0.6  1.0  0.5
        // 0.3  0.5  1.0
        let matrix = [| 
            [| 1.0; 0.6; 0.3 |]; 
            [| 0.6; 1.0; 0.5 |]; 
            [| 0.3; 0.5; 1.0 |] 
        |]
        
        let L = LinearAlgebra.choleskyDecomposition matrix
        
        // Verify L is Lower Triangular
        Assert.Equal(0.0, L.[0].[1])
        Assert.Equal(0.0, L.[0].[2])
        Assert.Equal(0.0, L.[1].[2])

        // Verify Reconstruction: L * L^T = A
        // Check element [1,2] (Row 1, Col 2 of A -> 0.5)
        // (L[1,0]*L[2,0]) + (L[1,1]*L[2,1]) + (L[1,2]*L[2,2])
        let recon12 = (L.[1].[0] * L.[2].[0]) + (L.[1].[1] * L.[2].[1])
        Assert.Equal(0.5, recon12, 5)

    [<Fact>]
    member _.``LA-2.5 Negative Correlation Decomposition``() =
        // [ 1.0, -0.8 ]
        // [-0.8,  1.0 ]
        let matrix = [| [| 1.0; -0.8 |]; [| -0.8; 1.0 |] |]
        let L = LinearAlgebra.choleskyDecomposition matrix
        
        // L00 = 1
        // L10 = -0.8 / 1 = -0.8
        // L11 = sqrt(1 - (-0.8)^2) = sqrt(0.36) = 0.6
        Assert.Equal(1.0, L.[0].[0], 5)
        Assert.Equal(-0.8, L.[1].[0], 5)
        Assert.Equal(0.6, L.[1].[1], 5)

    [<Fact>]
    member _.``LA-2.6 High Correlation (Near Singular)``() =
        let rho = 0.999
        let matrix = [| [| 1.0; rho |]; [| rho; 1.0 |] |]
        let L = LinearAlgebra.choleskyDecomposition matrix
        
        // Should not crash
        Assert.Equal(1.0, L.[0].[0], 5)

    // ============================================================================
    // Category 3: Error Handling
    // ============================================================================

    [<Fact>]
    member _.``ERR-3.1 Non-Positive Definite Matrix throws Exception``() =
        // Impossible matrix: Correlation > 1 (or just mathematically broken)
        // [ 1.0, 2.0 ]
        // [ 2.0, 1.0 ]
        // Determinant = 1 - 4 = -3. Not positive definite.
        let matrix = [| [| 1.0; 2.0 |]; [| 2.0; 1.0 |] |]
        
        Assert.Throws<System.Exception>(fun () -> 
            LinearAlgebra.choleskyDecomposition matrix |> ignore
        ) |> ignore

    // ============================================================================
    // Category 4: Correlation Fidelity (Monte Carlo)
    // ============================================================================

    [<Fact>]
    member _.``CORR-4.1 Negative Correlation Simulation``() =
        let rng = NormalRandom(101)
        let n = 50_000
        let z1 = Array.init n (fun _ -> rng.Next())
        let z2 = Array.init n (fun _ -> rng.Next())
        
        let rho = -0.8
        let matrix = [| [| 1.0; rho |]; [| rho; 1.0 |] |]
        let L = LinearAlgebra.choleskyDecomposition matrix
        
        let x1 = Array.zeroCreate n
        let x2 = Array.zeroCreate n
        
        for i in 0 .. n - 1 do
            let zVec = [| z1.[i]; z2.[i] |]
            let xVec = LinearAlgebra.multiplyMatrixVector L zVec
            x1.[i] <- xVec.[0]
            x2.[i] <- xVec.[1]
            
        let finalCorr = calculateCorrelation x1 x2
        Assert.InRange(finalCorr, -0.82, -0.78)