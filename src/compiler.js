import parse from "./parser.js"
import analyze from "./analyzer.js"
import optimize from "./optimizer.js"
import generate, { generateHtml } from "./generator.js"

export default function compile(source, outputType) {
  if (!["parsed", "analyzed", "optimized", "js", "html"].includes(outputType)) {
    throw new Error("Unknown output type")
  }
  const match = parse(source)
  if (outputType === "parsed") return "Syntax is ok"
  const analyzed = analyze(match)
  if (outputType === "analyzed") return analyzed
  const optimized = optimize(analyzed)
  if (outputType === "optimized") return optimized
  if (outputType === "html") return generateHtml(optimized)
  return generate(optimized)
}
