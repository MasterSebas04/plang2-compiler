# SALAMIS

### Stands for: "Sammy and Laith and Marcus, including Sebastian". However the last S may be silent so SALAMI is acceptable.

## Logo
![Logo](docs/salami-logo.jpg)

Image by [Likozor](https://www.vectorstock.com/royalty-free-vector/funny-cartoon-cat-craves-sausages-salami-vector-19839610) via VectorStock.com

Link to our [website](https://mastersebas04.github.io/salamis/)!

## Getting Started

**Prerequisites:** Node.js 18 or higher.

**Install:**
```
git clone https://github.com/MasterSebas04/salamis.git
cd salamis
npm install
```

**Run a program:**
```
node src/salamis.js yourfile.sal
```

If your program uses `plot()` or `histogram()`, an HTML file is automatically generated and opened in your browser.

**Debug flags** — inspect the compiler pipeline at any stage:
```
node src/salamis.js yourfile.sal --parsed      # raw parse tree
node src/salamis.js yourfile.sal --analyzed    # annotated AST
node src/salamis.js yourfile.sal --optimized   # after constant folding
node src/salamis.js yourfile.sal --js          # generated JavaScript
```

**REPL:**
```
node src/salamis.js --repl
```

**Run tests:**
```
npm test
```

## Introduction
SALAMIS combines R's statistical power and Python's clean syntax. No longer will you need to import countless libraries for every little thing. SALAMIS is named after its four founders: Sammy, Laith, Marcus, and Sebastian. It's a statically typed language designed to make data, statistics, and probability-centered programming as easy as slicing salami. It combines familiar tools like variables, functions, loops, and conditionals with support for vectors, matrices, probability distributions, simulation, plotting, and histograms; all with compile-time safety that catches type errors before they ruin your analysis. It is more structured than R, and more math-native than Python, with minimal compromises on either end.

## Language Features
 
- **Static types** — `Int`, `Float`, `Bool`, `Str`, `Vec<T>`, `Matrix<T>`, and distribution types (`Normal`, `Bernoulli`, `Poisson`, `Uniform`)
- **Type inference** — declare with `let x = ...` and the type is inferred; optionally annotate with `let x: Float = ...`
- **Functions** — defined with `fn`, typed parameters, optional return type annotation using `~>`
- **Conditionals** — `if`, `if/else`, and `if/else if/else` chains
- **Loops** — range-based `for i in (0..n)`, collection-based `for x in (vec)`, and while-style `for condition { }`
- **Vectors** — first-class `Vec<Float>` literals, element-wise arithmetic with scalars and other vectors
- **Matrices** — `Matrix<Float>` literals with compile-time row-length consistency checks
- **Matrix multiplication** — the `@` operator for `Vec @ Matrix`, `Matrix @ Vec`, and `Matrix @ Matrix`
- **Slicing** — `slice v(i)` for index access, `slice v(i..j)` for range slices
- **Pipe operator** — `|>` to chain single-argument functions cleanly (e.g. `data |> mean`)
- **Negation** — `neg(x)` for numeric and Vec negation
- **Floor division** — `//` operator for integer division, always returns `Int` (e.g. `10 // 3` gives `3`)
- **Distributions** — `Normal(μ, σ)`, `Bernoulli(p)`, `Poisson(λ)`, `Uniform(a, b)`
- **Sampling** — `sample(dist)` draws one value from any distribution
- **Simulation** — `simulate(n) { expr }` runs an expression n times and returns a `Vec<Float>`
- **Built-in math** — `sqrt`, `log`, `log2`, `log10`, `abs`, `exp`, `floor`, `ceil`, `round`, `sin`, `cos`, `pow`
- **Built-in stats** — `mean`, `std`, `sum`, `min`, `max`, `len`
- **String utilities** — `str(x)` converts a numeric or Bool value to string; `format(x, n)` formats a float to n decimal places
- **CSV I/O** — `readCsv("file.csv")` loads a file as `Matrix<Float>`; `col(m, n)` extracts a column as `Vec<Float>`. Header rows are detected and skipped automatically.
- **Printing** — `print(expr)` outputs any value
- **Plotting** — `plot(vec1, vec2, ...)` renders a line chart; `histogram(vec)` renders a frequency histogram
- **Greek letter identifiers** — variable names can use `μ`, `σ`, `λ`, `α`, `β`, `π`, and more
- **Comments** — lines beginning with `--`
- **Constant folding optimizer** — arithmetic on literals is evaluated at compile time

## Static, Safety, and Security Checks

The SALAMIS compiler performs the following checks before your program ever runs:
 
**Scope & Declaration** — Variables must be declared with `let` before use. Redeclaring a variable in the same scope is an error.
 
**Type Soundness** — The type of an assigned value must match the declared type of the variable. Reassignment is also type-checked — you cannot assign a value of a different type to an existing variable. Conditions in `if` statements and `for` (while-style) loops must be strictly `Bool`.
 
**Structural Integrity** — Matrix literals are validated at compile time: all rows must have the same length, and all elements must be `Float`.
 
**Operator Safety** — The `@` operator requires `Vec` or `Matrix` operands on both sides. Arithmetic operators validate that operand types are compatible (numeric, or matching Vec types).
 
**Function Verification** — Every function call is checked for the correct number of arguments, and each argument's type is matched against the declared parameter type.
 
**Viz Validation** — `plot()` and `histogram()` are statically checked to ensure every argument is a `Vec`. Passing a scalar or matrix is a compile-time error.
 
**Pipe Type Checking** — The `|>` operator verifies that the left-hand value's type matches the single parameter type of the right-hand function.
 
**Return Type Checking** — `return` statements are verified against the function's declared return type. Using `return` outside a function is a compile-time error.
 
**Simulate Body Check** — The body expression of `simulate(n) { ... }` must evaluate to a numeric type.

## Example Programs
 
### 1 — Descriptive Statistics and Distributions
 
Compute statistics on a dataset, sample from distributions, and visualize.
 
| SALAMIS | JavaScript |
|---|---|
| `let data: Vec<Float> = [2.0, 4.0, 4.0, 5.0, 7.0, 9.0]` | `const data = [2.0, 4.0, 4.0, 5.0, 7.0, 9.0];` |
| `let avg = mean(data)` | `const avg = data.reduce((a,b)=>a+b,0)/data.length;` |
| `let stddev = sqrt(mean((data - avg) * (data - avg)))` | `const std = Math.sqrt(data.reduce((a,x)=>a+(x-avg)**2,0)/data.length);` |
| `let normal = Normal(0.0, 1.0)` | *No built-in — requires a library* |
| `print(format(sample(normal), 4))` | `// jStat or mathjs required` |
 
```
-- stats.sal

let data: Vec<Float> = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]

-- Basic descriptive statistics
let avg = mean(data)
let lo  = min(data)
let hi  = max(data)
let total = sum(data)
let n     = len(data)

print("=== Descriptive Statistics ===")
print("Mean:  " + format(avg, 2))
print("Min:   " + format(lo, 2))
print("Max:   " + format(hi, 2))
print("Sum:   " + format(total, 2))
print("Count: " + str(n))

-- Variance and standard deviation using element-wise ops
let diffs   = data - avg
let sq      = diffs * diffs
let variance = mean(sq)
let stddev   = sqrt(variance)

print("=== Spread ===")
print("Variance: " + format(variance, 4))
print("Std dev:  " + format(stddev, 4))

-- Min-max normalization
let range      = hi - lo
let normalized = (data - lo) / range

-- Z-score normalization
let zscores = diffs / stddev

-- Sample from all four distribution types
let normal:    Normal<Float, Float>  = Normal(0.0, 1.0)
let bernoulli: Bernoulli<Float>      = Bernoulli(0.5)
let poisson:   Poisson<Float>        = Poisson(3.0)
let uniform:   Uniform<Float, Float> = Uniform(0.0, 10.0)

print("=== Samples from Distributions ===")
print("Normal(0,1):    " + format(sample(normal), 4))
print("Bernoulli(0.5): " + str(sample(bernoulli)))
print("Poisson(3):     " + str(sample(poisson)))
print("Uniform(0,10):  " + format(sample(uniform), 4))

-- Visualize raw data, normalized, and z-scores
plot(data)
plot(normalized)
plot(zscores)
```
 
---
 
### 2 — Monte Carlo Simulation
 
Run 2000-sample simulations of Normal and Uniform distributions and visualize results.
 
| SALAMIS | JavaScript |
|---|---|
| `simulate(2000) { sample(Normal(0.0, 1.0)) }` | `Array.from({length:2000}, () => jStat.normal.sample(0,1))` |
| `histogram(results)` | *Requires Chart.js setup + binning logic* |
 
```
-- simulate_demo.sal
 
let results = simulate(2000) {
  sample(Normal(0.0, 1.0))
}
 
print("=== Normal(0, 1) — 2000 samples ===")
print("Mean:    " + format(mean(results), 4))
print("Std dev: " + format(sqrt(mean((results - mean(results)) * (results - mean(results)))), 4))
print("Min:     " + format(min(results), 4))
print("Max:     " + format(max(results), 4))
 
histogram(results)
 
-- Compare with Uniform
let uniform = simulate(2000) {
  sample(Uniform(0.0, 1.0))
}
 
print("=== Uniform(0, 1) — 2000 samples ===")
print("Mean: " + format(mean(uniform), 4))
print("Min:  " + format(min(uniform), 4))
print("Max:  " + format(max(uniform), 4))
 
histogram(uniform)
```
 
---
 
### 3 — Functions and the Pipe Operator
 
Define reusable normalization functions and compose them with `|>`.
 
| SALAMIS | JavaScript |
|---|---|
| `fn normalize(v: Vec<Float>) ~> Vec<Float> { ... }` | `function normalize(v) { const lo=Math.min(...v), hi=Math.max(...v); return v.map(x=>(x-lo)/(hi-lo)); }` |
| `returns \|> normalize \|> mean` | `mean(normalize(returns))` |
 
```
-- pipeline.sal

fn normalize(v: Vec<Float>) ~> Vec<Float> {
    return (v - min(v)) / (max(v) - min(v))
}

fn zscore(v: Vec<Float>) ~> Vec<Float> {
    return (v - mean(v)) / std(v)
}

-- Simulate 500 stock-like daily returns: Normal(mean=2%, std=15%)
let returns = simulate(500) {
    sample(Normal(0.02, 0.15))
}

print("=== Raw Returns ===")
print("Mean: " + format(returns |> mean, 4))
print("Std:  " + format(returns |> std,  4))
print("Min:  " + format(returns |> min,  4))
print("Max:  " + format(returns |> max,  4))

let normed  = returns |> normalize
let zscored = returns |> zscore

print("=== After Normalization ===")
print("Mean: " + format(normed |> mean, 4))
print("Min:  " + format(normed |> min,  4))
print("Max:  " + format(normed |> max,  4))

print("=== After Z-Scoring ===")
print("Mean: " + format(zscored |> mean, 4))
print("Std:  " + format(zscored |> std,  4))

histogram(returns)
```
 
---
 
### 4 — Matrix Multiplication and Slicing
 
Multiply matrices and vectors with `@`, then extract rows and elements with `slice`.
 
| SALAMIS | JavaScript |
|---|---|
| `let C = A @ B` | `// Nested triple loop or math.js required` |
| `let row = slice C(0)` | `const row = C[0];` |
| `let val = slice row(1)` | `const val = C[0][1];` |
 
```
-- matmul_demo.sal

let A: Matrix<Float> = [[6.0, 6.0, 7.0], [8.0, 8.0, 9.0], [3.0, 4.0, 5.0]]
let B: Matrix<Float> = [[5.0, 6.0, 7.0], [7.0, 8.0, 9.0], [3.0, 4.0, 5.0]]
let vec_1: Vec<Float> = [8.0, 3.0, 6.0]

let C = A @ B          -- Matrix @ Matrix
let D = vec_1 @ B      -- Vec @ Matrix

let slice1  = slice C(0)      -- extract first row as Vec<Float>
let index1  = slice slice1(1) -- extract element at index 1

print(C)
print(D)
print(index1)
```
 
---
 
### 5 — CSV Analysis and Multi-Series Plotting
 
Load real data from a CSV, compute statistics on columns, and overlay series in one chart. The header row is detected and skipped automatically.
 
| SALAMIS | JavaScript |
|---|---|
| `let m = readCsv("prices.csv")` | `// fs.readFileSync + manual CSV parsing` |
| `let prices = col(m, 1)` | `const prices = rows.map(r => parseFloat(r[1]));` |
| `plot(prices, norm_prices)` | `// Chart.js with manual dataset config` |
 
```
-- csv_analysis.sal

let m       = readCsv("prices.csv")
let prices  = col(m, 1)
let volumes = col(m, 2)

let avg_price = mean(prices)
let lo_price  = min(prices)
let hi_price  = max(prices)

print("=== Price Statistics ===")
print("Mean:  " + format(avg_price, 2))
print("Min:   " + format(lo_price,  2))
print("Max:   " + format(hi_price,  2))

-- Normalize price to [0, 1] for comparison with volume
let price_range = hi_price - lo_price
let norm_prices = (prices - lo_price) / price_range

-- Z-score volumes to center and scale them
let avg_vol    = mean(volumes)
let diffs_vol  = volumes - avg_vol
let sq_vol     = diffs_vol * diffs_vol
let stddev_vol = sqrt(mean(sq_vol))
let z_volumes  = diffs_vol / stddev_vol

print("=== Volume Statistics ===")
print("Mean volume: " + format(avg_vol,    0))
print("Std dev:     " + format(stddev_vol, 0))

-- Prices and normalized prices together on one chart
plot(prices, norm_prices)

-- Z-scored volumes separately (different scale)
plot(z_volumes)
```
 
---
 
### 6 — Plotting: Line Chart vs Histogram
 
Use `plot()` for time-series data and `histogram()` for distribution shape — on the same dataset.
 
```
-- histogram_demo.sal
 
let prices = [142.5, 145.0, 141.2, 148.7, 150.3, 149.1, 153.4, 151.8, 155.2, 157.6]
 
print("=== Price Distribution ===")
print("Mean: " + format(mean(prices), 2))
print("Min:  " + format(min(prices),  2))
print("Max:  " + format(max(prices),  2))
 
-- Line chart: prices over time (index = time step)
plot(prices)
 
-- Histogram: how prices are distributed across value ranges
histogram(prices)
```

---

## REPL

SALAMIS includes an interactive REPL for evaluating expressions and statements line by line.

**Start the REPL:**
```
node src/salamis.js --repl
```

**Usage:**

Each line is evaluated immediately. Declarations persist across lines within the session.

```
> let x = 5
> let y = x * 2
> print(y)
10
> let data: Vec<Float> = [1.0, 2.0, 3.0]
> print(mean(data))
2
```

Type `exit` or press `Ctrl+C` to quit.