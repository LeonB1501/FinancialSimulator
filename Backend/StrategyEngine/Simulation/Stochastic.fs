module StrategyEngine.Simulation.Stochastic

open System

// ... (NormalRandom stays the same) ...
type NormalRandom(seed: int) =
    let rnd = System.Random(seed)
    let mutable hasSpare = false
    let mutable spare = 0.0
    member _.Next() =
        if hasSpare then
            hasSpare <- false
            spare
        else
            let mutable u = 0.0
            let mutable v = 0.0
            let mutable s = 0.0
            while s >= 1.0 || s = 0.0 do
                u <- rnd.NextDouble() * 2.0 - 1.0
                v <- rnd.NextDouble() * 2.0 - 1.0
                s <- u * u + v * v
            let mul = Math.Sqrt(-2.0 * Math.Log(s) / s)
            hasSpare <- true
            spare <- v * mul
            u * mul

module LinearAlgebra =
    
    // CHANGED: Input float[][] instead of float[,]
    let choleskyDecomposition (matrix: float[][]) : float[][] =
        let n = matrix.Length
        // Initialize jagged array
        let result = Array.init n (fun _ -> Array.zeroCreate n)
        
        for i in 0 .. n - 1 do
            for j in 0 .. i do
                let mutable sum = 0.0
                for k in 0 .. j - 1 do
                    sum <- sum + result.[i].[k] * result.[j].[k]
                
                if i = j then
                    let diff = matrix.[i].[i] - sum
                    if diff <= 0.0 then 
                        failwith "Matrix is not positive definite"
                    result.[i].[j] <- Math.Sqrt(diff)
                else
                    result.[i].[j] <- (1.0 / result.[j].[j]) * (matrix.[i].[j] - sum)
        result

    // CHANGED: Input float[][]
    let multiplyMatrixVector (matrix: float[][]) (vector: float[]) : float[] =
        let n = matrix.Length
        let result = Array.zeroCreate n
        
        for i in 0 .. n - 1 do
            let mutable sum = 0.0
            for j in 0 .. i do 
                sum <- sum + matrix.[i].[j] * vector.[j]
            result.[i] <- sum
        result