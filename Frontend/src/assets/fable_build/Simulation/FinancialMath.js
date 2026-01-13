import { item } from "../fable_modules/fable-library-js.4.27.0/Array.js";

/**
 * Standard Normal Cumulative Distribution Function (Abramowitz & Stegun approximation)
 * Error < 7.5e-8
 */
export function normalCdf(x) {
    if (x >= 0) {
        const t = 1 / (1 + (0.2316419 * x));
        return 1 - (((0.39894228 * Math.exp((-x * x) / 2)) * t) * ((t * ((t * ((t * ((t * 1.330274429) + -1.821255978)) + 1.781477937)) + -0.356563782)) + 0.31938153));
    }
    else {
        const t_1 = 1 / (1 + (0.2316419 * -x));
        return ((0.39894228 * Math.exp((-x * x) / 2)) * t_1) * ((t_1 * ((t_1 * ((t_1 * ((t_1 * 1.330274429) + -1.821255978)) + 1.781477937)) + -0.356563782)) + 0.31938153);
    }
}

/**
 * Standard Normal Probability Density Function
 */
export function normalPdf(x) {
    return (1 / Math.sqrt(2 * 3.141592653589793)) * Math.exp((-0.5 * x) * x);
}

/**
 * Inverse Normal CDF (Acklam's Algorithm or Rational Approximation)
 * Needed for finding Strike from Delta
 */
export function inverseNormalCdf(p) {
    if ((p <= 0) ? true : (p >= 1)) {
        throw new Error("Input p must be between 0 and 1");
    }
    const a = new Float64Array([-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]);
    const b = new Float64Array([-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]);
    const c = new Float64Array([-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]);
    const d = new Float64Array([0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]);
    const high = 1 - 0.02425;
    if (p < 0.02425) {
        const q = Math.sqrt(-2 * Math.log(p));
        return ((((((((((item(0, c) * q) + item(1, c)) * q) + item(2, c)) * q) + item(3, c)) * q) + item(4, c)) * q) + item(5, c)) / ((((((((item(0, d) * q) + item(1, d)) * q) + item(2, d)) * q) + item(3, d)) * q) + 1);
    }
    else if (p > high) {
        const q_1 = Math.sqrt(-2 * Math.log(1 - p));
        return -((((((((((item(0, c) * q_1) + item(1, c)) * q_1) + item(2, c)) * q_1) + item(3, c)) * q_1) + item(4, c)) * q_1) + item(5, c)) / ((((((((item(0, d) * q_1) + item(1, d)) * q_1) + item(2, d)) * q_1) + item(3, d)) * q_1) + 1);
    }
    else {
        const q_2 = p - 0.5;
        const r = q_2 * q_2;
        return (((((((((((item(0, a) * r) + item(1, a)) * r) + item(2, a)) * r) + item(3, a)) * r) + item(4, a)) * r) + item(5, a)) * q_2) / ((((((((((item(0, b) * r) + item(1, b)) * r) + item(2, b)) * r) + item(3, b)) * r) + item(4, b)) * r) + 1);
    }
}

/**
 * Newton-Raphson solver to find root of f(x) = target
 * f: Function to evaluate
 * df: Derivative of f (optional, if known)
 * target: The value we want f(x) to equal
 * initialGuess: Starting point
 */
export function solveNewtonRaphson(f, df, target, initialGuess) {
    const loop = (x_mut, iter_mut) => {
        loop:
        while (true) {
            const x = x_mut, iter = iter_mut;
            if (iter >= 50) {
                return x;
            }
            else {
                const diff = f(x) - target;
                if (Math.abs(diff) < 1E-05) {
                    return x;
                }
                else {
                    const slope = df(x);
                    if (Math.abs(slope) < 1E-09) {
                        return x;
                    }
                    else {
                        x_mut = (x - (diff / slope));
                        iter_mut = (iter + 1);
                        continue loop;
                    }
                }
            }
            break;
        }
    };
    return loop(initialGuess, 0);
}

