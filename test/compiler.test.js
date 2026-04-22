import { describe, it } from "node:test"
import assert from "node:assert/strict"
import compile from "../src/compiler.js"

const sampleProgram = "print(1)\n"

describe("The compiler", () => {
  it("throws when the output type is missing", () => {
    assert.throws(() => compile(sampleProgram), /Unknown output type/)
  })
  it("throws when the output type is unknown", () => {
    assert.throws(() => compile(sampleProgram, "no such type"), /Unknown output type/)
  })
  it("accepts the parsed option", () => {
    assert(compile(sampleProgram, "parsed").startsWith("Syntax is ok"))
  })
  it("accepts the analyzed option", () => {
    assert(compile(sampleProgram, "analyzed").kind === "Program")
  })
  it("accepts the optimized option", () => {
    assert(compile(sampleProgram, "optimized").kind === "Program")
  })
  it("generates js when given the js option", () => {
    assert(compile(sampleProgram, "js").includes("console.log(1)"))
  })
  it("correctly compiles a let statement", () => {
    const js = compile("let x = 1\n", "js")
    assert(js.includes("let x_") && js.includes("= 1"))
  })
  it("correctly compiles arithmetic", () => {
    const js = compile("let x = 1 + 2\n", "js")
    assert(js.includes("(1 + 2)"))
  })
  it("correctly compiles a function declaration", () => {
    const js = compile("fn double(x: Int) ~> Int {\nreturn x\n}\n", "js")
    assert(js.includes("function double_"))
  })
  it("correctly compiles a for-condition loop", () => {
    const js = compile("for false {\n}\n", "js")
    assert(js.includes("while (false)"))
  })
  it("correctly compiles a for range loop", () => {
    const js = compile("for i in (0..10) {\n}\n", "js")
    assert(js.includes("for (let"))
  })
  it("correctly compiles a vec literal", () => {
    const js = compile("let v: Vec<Float> = [1.0, 2.0, 3.0]\n", "js")
    assert(js.includes("[1.0, 2.0, 3.0]"))
  })
  it("maps builtin math functions to Math.*", () => {
    const js = compile("let x = sqrt(4.0)\n", "js")
    assert(js.includes("Math.sqrt"))
  })
  it("maps builtin vec functions to preamble helpers", () => {
    const js = compile("let v: Vec<Float> = [1.0, 2.0]\nlet m = mean(v)\n", "js")
    assert(js.includes("__mean"))
  })
  it("correctly compiles distribution construction", () => {
    const js = compile("let d: Normal<Float, Float> = Normal(0.0, 1.0)\n", "js")
    assert(js.includes("__Normal"))
  })
  it("correctly compiles sample", () => {
    const js = compile("let d: Normal<Float, Float> = Normal(0.0, 1.0)\nlet x = sample(d)\n", "js")
    assert(js.includes("__sample"))
  })
  it("generates html when given the html option", () => {
    const html = compile("let v: Vec<Float> = [1.0, 2.0]\nplot(v)\n", "html")
    assert(html.includes("<!DOCTYPE html>"))
    assert(html.includes("chart.js"))
    assert(html.includes("<canvas"))
  })
  it("throws on syntax errors", () => {
    assert.throws(() => compile("let x 1\n", "js"), /Line/)
  })
  it("throws on type errors", () => {
    assert.throws(() => compile("let x: Int = true\n", "js"), /Type mismatch/)
  })
  it("throws on undefined variables", () => {
    assert.throws(() => compile("let x = y\n", "js"), /Undefined variable/)
  })
})
