import { describe, it } from "node:test"
import assert from "node:assert/strict"
import parse from "../src/parser.js"
import analyze from "../src/analyzer.js"
import optimize from "../src/optimizer.js"
import * as core from "../src/core.js"

// Run source through parse → analyze → optimize and return the optimized AST
function opt(source) {
  return optimize(analyze(parse(source)))
}

// Initializer of the Nth let statement (0-indexed) in the program body
function init(source, n = 0) {
  return opt(source).body[n].initializer
}

describe("optimizer", () => {

  // -------------------------------------------------------------------------
  // Constant folding — arithmetic
  // -------------------------------------------------------------------------
  describe("constant folding", () => {
    it("folds integer addition", () => {
      assert.deepEqual(init("let x = 1 + 2\n"), core.intLiteral(3))
    })

    it("folds integer subtraction", () => {
      assert.deepEqual(init("let x = 10 - 4\n"), core.intLiteral(6))
    })

    it("folds integer multiplication", () => {
      assert.deepEqual(init("let x = 3 * 4\n"), core.intLiteral(12))
    })

    it("folds integer division", () => {
      assert.deepEqual(init("let x = 8 / 2\n"), core.intLiteral(4))
    })

    it("folds float addition", () => {
      assert.deepEqual(init("let x = 1.5 + 2.5\n"), core.floatLiteral(4))
    })

    it("folds float multiplication", () => {
      assert.deepEqual(init("let x = 2.0 * 3.0\n"), core.floatLiteral(6))
    })

    it("folds chained arithmetic bottom-up: (1 + 2) * 3 → 9", () => {
      // Inner fold: 1+2 → 3. Outer fold: 3*3 → 9.
      assert.deepEqual(init("let x = (1 + 2) * 3\n"), core.intLiteral(9))
    })

    it("folds negation of an int literal", () => {
      assert.deepEqual(init("let x = neg(5)\n"), core.intLiteral(-5))
    })

    it("folds negation of a float literal", () => {
      assert.deepEqual(init("let x = neg(3.0)\n"), core.floatLiteral(-3))
    })

    // Comparisons — both sides are literals, so they fold to a BoolLiteral
    it("folds < to true when left < right", () => {
      assert.deepEqual(init("let x = 1 < 2\n"), core.boolLiteral(true))
    })

    it("folds < to false when left > right", () => {
      assert.deepEqual(init("let x = 2 < 1\n"), core.boolLiteral(false))
    })

    it("folds > correctly", () => {
      assert.deepEqual(init("let x = 5 > 3\n"), core.boolLiteral(true))
    })

    it("folds == on equal ints to true", () => {
      assert.deepEqual(init("let x = 2 == 2\n"), core.boolLiteral(true))
    })

    it("folds == on unequal ints to false", () => {
      assert.deepEqual(init("let x = 1 == 2\n"), core.boolLiteral(false))
    })

    it("folds != correctly", () => {
      assert.deepEqual(init("let x = 1 != 2\n"), core.boolLiteral(true))
    })

    it("folds <= on equal values to true", () => {
      assert.deepEqual(init("let x = 3 <= 3\n"), core.boolLiteral(true))
    })
  })

  // -------------------------------------------------------------------------
  // Algebraic simplification
  //
  // All tests declare `let x` first so the variable exists in scope, then
  // declare `let y = <expression involving x>`. We check body[1] (the y stmt).
  // -------------------------------------------------------------------------
  describe("algebraic simplification", () => {
    it("simplifies x + 0 to x", () => {
      assert.equal(init("let x = 1\nlet y = x + 0\n", 1).kind, "Variable")
    })

    it("simplifies 0 + x to x", () => {
      assert.equal(init("let x = 1\nlet y = 0 + x\n", 1).kind, "Variable")
    })

    it("simplifies x - 0 to x", () => {
      assert.equal(init("let x = 1\nlet y = x - 0\n", 1).kind, "Variable")
    })

    it("simplifies x * 1 to x", () => {
      assert.equal(init("let x = 1\nlet y = x * 1\n", 1).kind, "Variable")
    })

    it("simplifies 1 * x to x", () => {
      assert.equal(init("let x = 1\nlet y = 1 * x\n", 1).kind, "Variable")
    })

    it("simplifies x * 0 to 0 (Int)", () => {
      assert.deepEqual(init("let x = 1\nlet y = x * 0\n", 1), core.intLiteral(0))
    })

    it("simplifies 0 * x to 0 (Int)", () => {
      assert.deepEqual(init("let x = 1\nlet y = 0 * x\n", 1), core.intLiteral(0))
    })

    it("simplifies x / 1 to x", () => {
      assert.equal(init("let x = 1\nlet y = x / 1\n", 1).kind, "Variable")
    })

    it("simplifies x - x to 0 (Int)", () => {
      // The analyzer returns the same Variable object for every reference,
      // so reference equality lets us detect x - x at compile time.
      assert.deepEqual(init("let x = 1\nlet y = x - x\n", 1), core.intLiteral(0))
    })

    it("simplifies x - x to 0.0 (Float)", () => {
      assert.deepEqual(init("let x = 1.0\nlet y = x - x\n", 1), core.floatLiteral(0))
    })

    it("chains simplification and folding: (x + 0) * 1 → x", () => {
      // x+0 → x, then x*1 → x. Two rules fire in sequence.
      assert.equal(init("let x = 1\nlet y = (x + 0) * 1\n", 1).kind, "Variable")
    })
  })

  // -------------------------------------------------------------------------
  // Dead code elimination — constant if conditions
  // -------------------------------------------------------------------------
  describe("dead code elimination", () => {
    it("replaces if(true) with just the consequent", () => {
      // The IfStatement node disappears; print(1) is spliced into the body flat.
      const program = opt("if true {\nprint(1)\n}\n")
      assert.equal(program.body.length, 1)
      assert.equal(program.body[0].kind, "PrintStatement")
    })

    it("replaces if(false) with nothing when alternate is empty", () => {
      const program = opt("if false {\nprint(1)\n}\n")
      assert.equal(program.body.length, 0)
    })

    it("replaces if(false) with the alternate branch", () => {
      const program = opt("if false {\nprint(1)\n} else {\nprint(2)\n}\n")
      assert.equal(program.body.length, 1)
      assert.equal(program.body[0].kind, "PrintStatement")
    })

    it("constant-folded condition enables dead code elimination", () => {
      // 1 < 2 folds to true, so the if is eliminated and only the let remains.
      const program = opt("let x = 1\nif 1 < 2 {\nx = 2\n}\n")
      assert.ok(program.body.every(s => s.kind !== "IfStatement"))
    })

    it("eliminates a for-condition loop whose condition folds to false", () => {
      // 2 < 1 folds to false → the WhileStatement is dropped entirely.
      const program = opt("for 2 < 1 {\nprint(1)\n}\n")
      assert.equal(program.body.length, 0)
    })

    it("keeps a for-condition loop whose condition folds to true", () => {
      const program = opt("for 1 < 2 {\n}\n")
      assert.equal(program.body.length, 1)
      assert.equal(program.body[0].kind, "WhileStatement")
    })

    it("removes dead code after return in a function", () => {
      // print(1) after the return is unreachable and gets cut.
      const source = "fn f(x: Int) ~> Int {\nreturn x\nprint(1)\n}\n"
      const decl = opt(source).body[0]
      assert.equal(decl.body.length, 1)
      assert.equal(decl.body[0].kind, "ReturnStatement")
    })

    it("removes multiple dead statements after return", () => {
      const source = "fn f(x: Int) ~> Int {\nreturn x\nprint(1)\nprint(2)\n}\n"
      assert.equal(opt(source).body[0].body.length, 1)
    })
  })

  // -------------------------------------------------------------------------
  // Optimization interactions
  // -------------------------------------------------------------------------
  describe("optimization interactions", () => {
    it("folding enables dead code elimination via bool condition", () => {
      // 2 == 2 folds to true → IfStatement is eliminated → PrintStatement surfaces
      const program = opt("if 2 == 2 {\nprint(1)\n}\n")
      assert.equal(program.body[0].kind, "PrintStatement")
    })

    it("simplification enables further folding: (3*1) + (2*0) → 3", () => {
      // 3*1 → 3, 2*0 → 0, then 3+0 → 3
      assert.deepEqual(init("let x = (3 * 1) + (2 * 0)\n"), core.intLiteral(3))
    })

    it("negation folding feeds arithmetic folding: neg(3) + 5 → 2", () => {
      // neg(3) → -3, then -3 + 5 → 2
      assert.deepEqual(init("let x = neg(3) + 5\n"), core.intLiteral(2))
    })
  })

})
