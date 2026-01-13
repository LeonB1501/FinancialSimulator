import { seeded } from "../fable_modules/fable-library-js.4.27.0/Random.js";
import { class_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";
import { setItem, item, initialize } from "../fable_modules/fable-library-js.4.27.0/Array.js";

export class NormalRandom {
    constructor(seed) {
        this.rnd = seeded(seed);
        this.hasSpare = false;
        this.spare = 0;
    }
}

export function NormalRandom_$reflection() {
    return class_type("StrategyEngine.Simulation.Stochastic.NormalRandom", undefined, NormalRandom);
}

export function NormalRandom_$ctor_Z524259A4(seed) {
    return new NormalRandom(seed);
}

export function NormalRandom__Next(_) {
    if (_.hasSpare) {
        _.hasSpare = false;
        return _.spare;
    }
    else {
        let u = 0;
        let v = 0;
        let s = 0;
        while ((s >= 1) ? true : (s === 0)) {
            u = ((_.rnd.NextDouble() * 2) - 1);
            v = ((_.rnd.NextDouble() * 2) - 1);
            s = ((u * u) + (v * v));
        }
        const mul = Math.sqrt((-2 * Math.log(s)) / s);
        _.hasSpare = true;
        _.spare = (v * mul);
        return u * mul;
    }
}

export function LinearAlgebra_choleskyDecomposition(matrix) {
    const n = matrix.length | 0;
    const result = initialize(n, (_arg) => (new Float64Array(n)));
    for (let i = 0; i <= (n - 1); i++) {
        for (let j = 0; j <= i; j++) {
            let sum = 0;
            for (let k = 0; k <= (j - 1); k++) {
                sum = (sum + (item(k, item(i, result)) * item(k, item(j, result))));
            }
            if (i === j) {
                const diff = item(i, item(i, matrix)) - sum;
                if (diff <= 0) {
                    throw new Error("Matrix is not positive definite");
                }
                item(i, result)[j] = Math.sqrt(diff);
            }
            else {
                item(i, result)[j] = ((1 / item(j, item(j, result))) * (item(j, item(i, matrix)) - sum));
            }
        }
    }
    return result;
}

export function LinearAlgebra_multiplyMatrixVector(matrix, vector) {
    const n = matrix.length | 0;
    const result = new Float64Array(n);
    for (let i = 0; i <= (n - 1); i++) {
        let sum = 0;
        for (let j = 0; j <= i; j++) {
            sum = (sum + (item(j, item(i, matrix)) * item(j, vector)));
        }
        setItem(result, i, sum);
    }
    return result;
}

