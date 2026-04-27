import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import generate from "../src/generator.js"

// Strip the preamble (builtins + matmul) so we only compare user code
const PREAMBLE_END = ".reduce((s, v) => s + v, 0)));\n}"
function userCode(source) {
  const js = generate(optimize(analyze(parse(source))))
  return js.slice(js.indexOf(PREAMBLE_END) + PREAMBLE_END.length).trim()
}

const fixtures = [
  {
    name: "print",
    source: "print(1)\n",
    expected: "console.log(1);",
  },
  {
    name: "let with inferred type",
    source: "let x = 1\n",
    expected: "let x_1 = 1;",
  },
  {
    name: "let with float",
    source: "let x = 3.14\n",
    expected: "let x_1 = 3.14;",
  },
  {
    name: "let with string",
    source: 'let s = "hello"\n',
    expected: 'let s_1 = "hello";',
  },
  {
    name: "let with bool",
    source: "let x = true\n",
    expected: "let x_1 = true;",
  },
  {
    // 1 + 2 constant-folds to 3; x * 3 stays (x is a variable)
    name: "arithmetic",
    source: "let x = 1 + 2\nlet y = x * 3\n",
    expected: "let x_1 = 3;\nlet y_2 = (x_1 * 3);",
  },
  {
    // neg(5) constant-folds to -5
    name: "negation",
    source: "let x = neg(5)\n",
    expected: "let x_1 = -5;",
  },
  {
    // 1 < 2 constant-folds to true
    name: "comparison",
    source: "let x = 1 < 2\n",
    expected: "let x_1 = true;",
  },
  {
    // 1 == 1 constant-folds to true
    name: "equality maps to ===",
    source: "let x = 1 == 1\n",
    expected: "let x_1 = true;",
  },
  {
    // 1 != 2 constant-folds to true
    name: "inequality maps to !==",
    source: "let x = 1 != 2\n",
    expected: "let x_1 = true;",
  },
  {
    name: "assignment",
    source: "let x = 1\nx = 2\n",
    expected: "let x_1 = 1;\nx_1 = 2;",
  },
  {
    name: "vec literal",
    source: "let v: Vec<Float> = [1.0, 2.0, 3.0]\n",
    expected: "let v_1 = [1.0, 2.0, 3.0];",
  },
  {
    // if(true) dead-code-eliminates to just the consequent
    name: "if short",
    source: "if true {\nprint(1)\n}\n",
    expected: "console.log(1);",
  },
  {
    // if(true) dead-code-eliminates; alternate is dropped
    name: "if-else",
    source: "if true {\nprint(1)\n} else {\nprint(2)\n}\n",
    expected: "console.log(1);",
  },
  {
    name: "if-else-if",
    source: "let x = 1\nif x < 0 {\nprint(1)\n} else if x == 0 {\nprint(2)\n}\n",
    expected: "let x_1 = 1;\nif ((x_1 < 0)) {\nconsole.log(1);\n} else\nif ((x_1 === 0)) {\nconsole.log(2);\n}",
  },
  {
    // condition is a variable so it can't fold; the while survives
    name: "for-condition loop (Go-style while)",
    source: "let done = false\nfor done {\n}\n",
    expected: "let done_1 = false;\nwhile (done_1) {\n}",
  },
  {
    name: "for range loop",
    source: "for i in (0..5) {\nprint(i)\n}\n",
    expected: "for (let i_1 = 0; i_1 < 5; i_1++) {\nconsole.log(i_1);\n}",
  },
  {
    name: "for collection loop",
    source: "let v: Vec<Float> = [1.0, 2.0]\nfor x in (v) {\nprint(x)\n}\n",
    expected: "let v_1 = [1.0, 2.0];\nfor (const x_2 of v_1) {\nconsole.log(x_2);\n}",
  },
  {
    name: "function declaration and call",
    source: "fn add(a: Int, b: Int) ~> Int {\nreturn a\n}\nlet x = add(1, 2)\n",
    expected: "function add_1(a_2, b_3) {\nreturn a_2;\n}\nlet x_4 = add_1(1, 2);",
  },
  {
    name: "return statement",
    source: "fn f(x: Int) ~> Int {\nreturn x\n}\n",
    expected: "function f_1(x_2) {\nreturn x_2;\n}",
  },
  {
    name: "pipe expression",
    source: "fn double(x: Int) ~> Int {\nreturn x\n}\nlet y = 1 |> double\n",
    expected: "function double_1(x_2) {\nreturn x_2;\n}\nlet y_3 = double_1(1);",
  },
  {
    // neg(1.0) folds to -1.0 before abs() sees it
    name: "math builtins map to Math.*",
    source: "let x = sqrt(4.0)\nlet y = log(2.0)\nlet z = abs(neg(1.0))\n",
    expected: "let x_1 = Math.sqrt(4.0);\nlet y_2 = Math.log(2.0);\nlet z_3 = Math.abs(-1.0);",
  },
  {
    name: "vec builtins map to preamble helpers",
    source: "let v: Vec<Float> = [1.0, 2.0]\nlet m = mean(v)\nlet s = sum(v)\n",
    expected: "let v_1 = [1.0, 2.0];\nlet m_2 = __mean(v_1);\nlet s_3 = __sum(v_1);",
  },
  {
    name: "distribution construction",
    source: "let d: Normal<Float, Float> = Normal(0.0, 1.0)\n",
    expected: "let d_1 = __Normal(0.0, 1.0);",
  },
  {
    name: "sample from distribution",
    source: "let d: Normal<Float, Float> = Normal(0.0, 1.0)\nlet x = sample(d)\n",
    expected: "let d_1 = __Normal(0.0, 1.0);\nlet x_2 = __sample(d_1);",
  },
  {
    name: "Vec + Vec element-wise",
    source: "let v: Vec<Float> = [1.0, 2.0]\nlet w: Vec<Float> = [3.0, 4.0]\nlet r = v + w\n",
    expected: "let v_1 = [1.0, 2.0];\nlet w_2 = [3.0, 4.0];\nlet r_3 = v_1.map((__v, __i) => __v + w_2[__i]);",
  },
  {
    name: "Vec * scalar broadcast",
    source: "let v: Vec<Float> = [1.0, 2.0]\nlet r = v * 2.0\n",
    expected: "let v_1 = [1.0, 2.0];\nlet r_2 = v_1.map(__v => __v * 2.0);",
  },
  {
    name: "scalar * Vec broadcast",
    source: "let v: Vec<Float> = [1.0, 2.0]\nlet r = 2.0 * v\n",
    expected: "let v_1 = [1.0, 2.0];\nlet r_2 = v_1.map(__v => 2.0 * __v);",
  },
  {
    name: "neg on Vec",
    source: "let v: Vec<Float> = [1.0, 2.0]\nlet r = neg(v)\n",
    expected: "let v_1 = [1.0, 2.0];\nlet r_2 = v_1.map(__v => -__v);",
  },
  {
    name: "plot statement emits nothing in js mode",
    source: "let v: Vec<Float> = [1.0, 2.0, 3.0]\nplot(v)\n",
    expected: "let v_1 = [1.0, 2.0, 3.0];",
  },
]

describe("The code generator", () => {
  for (const fixture of fixtures) {
    it(`produces expected js for the ${fixture.name} program`, () => {
      assert.equal(userCode(fixture.source), fixture.expected)
    })
  }
})
