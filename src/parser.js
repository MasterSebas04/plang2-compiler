import * as ohm from "ohm-js"
import * as fs from "node:fs/promises"

const grammarSource = await fs.readFile("./src/salamis.ohm", "utf-8")
const grammar = ohm.grammar(grammarSource)

export default function parse(sourceCode) {
  const match = grammar.match(sourceCode)
  if (match.failed()) {
    throw new Error(match.message)
  }
  return match
}
