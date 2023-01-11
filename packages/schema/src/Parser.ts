/**
 * @since 1.0.0
 */

import { isBoolean } from "@fp-ts/data/Boolean"
import { pipe } from "@fp-ts/data/Function"
import { isNumber } from "@fp-ts/data/Number"
import * as O from "@fp-ts/data/Option"
import type { NonEmptyReadonlyArray } from "@fp-ts/data/ReadonlyArray"
import * as RA from "@fp-ts/data/ReadonlyArray"
import { isString } from "@fp-ts/data/String"
import type { Both } from "@fp-ts/data/These"
import * as H from "@fp-ts/schema/annotation/HookAnnotation"
import * as AST from "@fp-ts/schema/AST"
import { formatErrors } from "@fp-ts/schema/formatter/Tree"
import * as I from "@fp-ts/schema/internal/common"
import * as PE from "@fp-ts/schema/ParseError"
import type { Schema } from "@fp-ts/schema/Schema"

/**
 * @category model
 * @since 1.0.0
 */
export interface ParseOptions {
  readonly isUnexpectedAllowed?: boolean
  readonly allErrors?: boolean
}

/**
 * @category model
 * @since 1.0.0
 */
export interface Parser<I, A> extends Schema<A> {
  readonly I: (i: I) => void
  readonly parse: (i: I, options?: ParseOptions) => PE.ParseResult<A>
}

/**
 * @since 1.0.0
 */
export type InferInput<D extends Parser<any, any>> = Parameters<D["I"]>[0]

/**
 * @category constructors
 * @since 1.0.0
 */
export const make: <I, A>(schema: Schema<A>, parse: Parser<I, A>["parse"]) => Parser<I, A> =
  I.makeParser

/**
 * @category decoding
 * @since 1.0.0
 */
export const decode = <A>(
  schema: Schema<A>
): (i: unknown, options?: ParseOptions) => PE.ParseResult<A> => parserFor(schema).parse

/**
 * @category decoding
 * @since 1.0.0
 */
export const decodeOrThrow = <A>(schema: Schema<A>) =>
  (u: unknown, options?: ParseOptions): A => {
    const t = parserFor(schema).parse(u, options)
    if (PE.isFailure(t)) {
      throw new Error(formatErrors(t.left))
    }
    return t.right
  }

/**
 * @category assertions
 * @since 1.0.0
 */
export const is = <A>(schema: Schema<A>) =>
  (input: unknown, options?: ParseOptions): input is A =>
    !PE.isFailure(parserFor(schema, "guard").parse(input, options))

/**
 * @category assertions
 * @since 1.0.0
 */
export const asserts = <A>(schema: Schema<A>) =>
  (input: unknown, options?: ParseOptions): asserts input is A => {
    const t = parserFor(schema, "guard").parse(input, options)
    if (PE.isFailure(t)) {
      throw new Error(formatErrors(t.left))
    }
  }

/**
 * @category encoding
 * @since 1.0.0
 */
export const encode = <A>(
  schema: Schema<A>
): (a: A, options?: ParseOptions) => PE.ParseResult<unknown> => parserFor(schema, "encoder").parse

/**
 * @category encoding
 * @since 1.0.0
 */
export const encodeOrThrow = <A>(schema: Schema<A>) =>
  (a: A, options?: ParseOptions): unknown => {
    const t = parserFor(schema, "encoder").parse(a, options)
    if (PE.isFailure(t)) {
      throw new Error(formatErrors(t.left))
    }
    return t.right
  }

const getHook = H.getHook<H.Hook<Parser<unknown, any>>>(
  H.ParserHookId
)

const parserFor = <A>(
  schema: Schema<A>,
  as: "decoder" | "guard" | "encoder" = "decoder"
): Parser<unknown, A> => {
  const go = (ast: AST.AST): Parser<any, any> => {
    switch (ast._tag) {
      case "TypeAlias":
        return pipe(
          getHook(ast),
          O.match(
            () => go(ast.type),
            ({ handler }) => handler(...ast.typeParameters.map(go))
          )
        )
      case "Literal":
        return I.fromRefinement(
          I.makeSchema(ast),
          (u): u is typeof ast.literal => u === ast.literal,
          (u) => PE.equal(ast.literal, u)
        )
      case "UniqueSymbol":
        return I.fromRefinement(
          I.makeSchema(ast),
          (u): u is typeof ast.symbol => u === ast.symbol,
          (u) => PE.equal(ast.symbol, u)
        )
      case "UndefinedKeyword":
        return I.fromRefinement(I.makeSchema(ast), I.isUndefined, (u) => PE.type(ast, u))
      case "VoidKeyword":
        return I.fromRefinement(I.makeSchema(ast), I.isUndefined, (u) => PE.type(ast, u))
      case "NeverKeyword":
        return make(I.makeSchema(ast), (u) => PE.failure(PE.type(ast, u))) as any
      case "UnknownKeyword":
        return make(I.makeSchema(ast), PE.success)
      case "AnyKeyword":
        return make(I.makeSchema(ast), PE.success)
      case "StringKeyword":
        return I.fromRefinement(I.makeSchema(ast), isString, (u) => PE.type(ast, u))
      case "NumberKeyword":
        return make(
          I.makeSchema(ast),
          (u) => isNumber(u) ? PE.success(u) : PE.failure(PE.type(ast, u))
        )
      case "BooleanKeyword":
        return I.fromRefinement(I.makeSchema(ast), isBoolean, (u) => PE.type(ast, u))
      case "BigIntKeyword":
        return make(
          I.makeSchema(ast),
          (u) => {
            if (I.isBigInt(u)) {
              return PE.success(u)
            }
            if (isString(u) || isNumber(u) || isBoolean(u)) {
              try {
                return PE.success(BigInt(u))
              } catch (_e) {
                return PE.failure(PE.transform(primitive, ast, u))
              }
            }
            return PE.failure(PE.type(primitive, u))
          }
        )
      case "SymbolKeyword":
        return I.fromRefinement(I.makeSchema(ast), I.isSymbol, (u) => PE.type(ast, u))
      case "ObjectKeyword":
        return I.fromRefinement(I.makeSchema(ast), I.isObject, (u) => PE.type(ast, u))
      case "Tuple": {
        const elements = ast.elements.map((e) => go(e.type))
        const rest = pipe(ast.rest, O.map(RA.mapNonEmpty(go)))
        return make(
          I.makeSchema(ast),
          (input: unknown, options) => {
            if (!Array.isArray(input)) {
              return PE.failure(PE.type(unknownArray, input))
            }
            const output: Array<any> = []
            const es: Array<PE.ParseError> = []
            const allErrors = options?.allErrors
            let isLeft = false
            let i = 0
            // ---------------------------------------------
            // handle elements
            // ---------------------------------------------
            for (; i < elements.length; i++) {
              if (input.length < i + 1) {
                // the input element is missing...
                if (ast.elements[i].isOptional) {
                  // ...but the element is optional, go on
                  continue
                } else {
                  // ...but the element is required
                  const e = PE.index(i, [PE.missing])
                  if (allErrors) {
                    es.push(e)
                    isLeft = true
                    continue
                  } else {
                    return PE.failure(e)
                  }
                }
              } else {
                const parser = elements[i]
                const t = parser.parse(input[i], options)
                if (PE.isFailure(t)) {
                  // the input element is present but is not valid
                  const e = PE.index(i, t.left)
                  if (allErrors) {
                    es.push(e)
                    isLeft = true
                    continue
                  } else {
                    return PE.failures(I.mutableAppend(es, e))
                  }
                } else if (PE.hasWarnings(t)) {
                  es.push(PE.index(i, t.left))
                }
                output.push(t.right)
              }
            }
            // ---------------------------------------------
            // handle rest element
            // ---------------------------------------------
            if (O.isSome(rest)) {
              const head = RA.headNonEmpty(rest.value)
              const tail = RA.tailNonEmpty(rest.value)
              for (; i < input.length - tail.length; i++) {
                const t = head.parse(input[i], options)
                if (PE.isFailure(t)) {
                  const e = PE.index(i, t.left)
                  if (allErrors) {
                    es.push(e)
                    isLeft = true
                    continue
                  } else {
                    return PE.failures(I.mutableAppend(es, e))
                  }
                } else {
                  if (PE.hasWarnings(t)) {
                    es.push(PE.index(i, t.left))
                  }
                  output.push(t.right)
                }
              }
              // ---------------------------------------------
              // handle post rest elements
              // ---------------------------------------------
              for (let j = 0; j < tail.length; j++) {
                i += j
                if (input.length < i + 1) {
                  // the input element is missing and the element is required, bail out
                  return PE.failures(I.mutableAppend(es, PE.index(i, [PE.missing])))
                } else {
                  const t = tail[j].parse(input[i], options)
                  if (PE.isFailure(t)) {
                    // the input element is present but is not valid
                    const e = PE.index(i, t.left)
                    if (allErrors) {
                      es.push(e)
                      isLeft = true
                      continue
                    } else {
                      return PE.failures(I.mutableAppend(es, e))
                    }
                  } else if (PE.hasWarnings(t)) {
                    es.push(PE.index(i, t.left))
                  }
                  output.push(t.right)
                }
              }
            } else {
              // ---------------------------------------------
              // handle unexpected indexes
              // ---------------------------------------------
              const isUnexpectedAllowed = options?.isUnexpectedAllowed
              for (; i < input.length; i++) {
                const e = PE.index(i, [PE.unexpected(input[i])])
                if (isUnexpectedAllowed) {
                  es.push(e)
                } else {
                  if (allErrors) {
                    es.push(e)
                    isLeft = true
                    continue
                  } else {
                    return PE.failures(I.mutableAppend(es, e))
                  }
                }
              }
            }

            // ---------------------------------------------
            // compute output
            // ---------------------------------------------
            return I.isNonEmpty(es) ?
              isLeft ? PE.failures(es) : PE.warnings(es, output) :
              PE.success(output)
          }
        )
      }
      case "TypeLiteral": {
        const propertySignaturesTypes = ast.propertySignatures.map((f) => go(f.type))
        const indexSignatures = ast.indexSignatures.map((is) =>
          [go(is.parameter), go(is.type)] as const
        )
        if (propertySignaturesTypes.length === 0 && indexSignatures.length === 0) {
          return I.fromRefinement(I.makeSchema(ast), I.isNotNull, (u) => PE.type(ast, u))
        }
        return make(
          I.makeSchema(ast),
          (input: unknown, options) => {
            if (!I.isUnknownObject(input)) {
              return PE.failure(PE.type(unknownRecord, input))
            }
            const output: any = {}
            const expectedKeys: any = {}
            const es: Array<PE.ParseError> = []
            const allErrors = options?.allErrors
            let isLeft = false
            // ---------------------------------------------
            // handle property signatures
            // ---------------------------------------------
            for (let i = 0; i < propertySignaturesTypes.length; i++) {
              const ps = ast.propertySignatures[i]
              const parser = propertySignaturesTypes[i]
              const name = ps.name
              expectedKeys[name] = null
              if (!Object.prototype.hasOwnProperty.call(input, name)) {
                if (ps.isOptional) {
                  continue
                }
                const e = PE.key(name, [PE.missing])
                if (allErrors) {
                  es.push(e)
                  isLeft = true
                  continue
                } else {
                  return PE.failure(e)
                }
              }
              const t = parser.parse(input[name], options)
              if (PE.isFailure(t)) {
                // the input key is present but is not valid
                const e = PE.key(name, t.left)
                if (allErrors) {
                  es.push(e)
                  isLeft = true
                  continue
                } else {
                  return PE.failures(I.mutableAppend(es, e))
                }
              } else if (PE.hasWarnings(t)) {
                es.push(PE.key(name, t.left))
              }
              output[name] = t.right
            }
            // ---------------------------------------------
            // handle index signatures
            // ---------------------------------------------
            if (indexSignatures.length > 0) {
              for (let i = 0; i < indexSignatures.length; i++) {
                const parameter = indexSignatures[i][0]
                const type = indexSignatures[i][1]
                const keys = I.getKeysForIndexSignature(input, ast.indexSignatures[i].parameter)
                for (const key of keys) {
                  // ---------------------------------------------
                  // handle keys
                  // ---------------------------------------------
                  let t = parameter.parse(key, options)
                  if (PE.isFailure(t)) {
                    const e = PE.key(key, t.left)
                    if (allErrors) {
                      es.push(e)
                      isLeft = true
                      continue
                    } else {
                      return PE.failures(I.mutableAppend(es, e))
                    }
                  } else if (PE.hasWarnings(t)) {
                    es.push(PE.key(key, t.left))
                  }
                  // ---------------------------------------------
                  // handle values
                  // ---------------------------------------------
                  t = type.parse(input[key], options)
                  if (PE.isFailure(t)) {
                    const e = PE.key(key, t.left)
                    if (allErrors) {
                      es.push(e)
                      isLeft = true
                      continue
                    } else {
                      return PE.failures(I.mutableAppend(es, e))
                    }
                  } else {
                    if (PE.hasWarnings(t)) {
                      es.push(PE.key(key, t.left))
                    }
                    output[key] = t.right
                  }
                }
              }
            } else {
              // ---------------------------------------------
              // handle unexpected keys
              // ---------------------------------------------
              const isUnexpectedAllowed = options?.isUnexpectedAllowed
              for (const key of I.ownKeys(input)) {
                if (!(Object.prototype.hasOwnProperty.call(expectedKeys, key))) {
                  const e = PE.key(key, [PE.unexpected(input[key])])
                  if (isUnexpectedAllowed) {
                    es.push(e)
                  } else {
                    if (allErrors) {
                      es.push(e)
                      isLeft = true
                      continue
                    } else {
                      return PE.failures(I.mutableAppend(es, e))
                    }
                  }
                }
              }
            }

            // ---------------------------------------------
            // compute output
            // ---------------------------------------------
            return I.isNonEmpty(es) ?
              isLeft ? PE.failures(es) : PE.warnings(es, output) :
              PE.success(output)
          }
        )
      }
      case "Union": {
        const types = ast.types.map(go)
        return make(I.makeSchema(ast), (u, options) => {
          const es: Array<PE.ParseError> = []
          let output: Both<NonEmptyReadonlyArray<PE.ParseError>, any> | null = null

          // ---------------------------------------------
          // compute best output
          // ---------------------------------------------
          for (let i = 0; i < types.length; i++) {
            const t = types[i].parse(u, options)
            if (PE.isSuccess(t)) {
              // if there are no warnings this is the best output
              return t
            } else if (PE.hasWarnings(t)) {
              // choose the output with less warnings related to unexpected keys / indexes
              if (
                !output ||
                output.left.filter(hasUnexpectedError).length >
                  t.left.filter(hasUnexpectedError).length
              ) {
                output = t
              }
            } else {
              es.push(PE.member(t.left))
            }
          }

          // ---------------------------------------------
          // compute output
          // ---------------------------------------------
          return output ?
            output :
            I.isNonEmpty(es) ?
            PE.failures(es) :
            PE.failure(PE.type(AST.neverKeyword, u))
        })
      }
      case "Lazy": {
        const f = () => go(ast.f())
        const get = I.memoize<void, Parser<any, any>>(f)
        const schema = I.lazy(ast.identifier, f)
        return make(schema, (a, options) => get().parse(a, options))
      }
      case "Enums":
        return make(
          I.makeSchema(ast),
          (u) =>
            ast.enums.some(([_, value]) => value === u) ?
              PE.success(u) :
              PE.failure(PE.type(ast, u))
        )
      case "Refinement": {
        const type = go(ast.from)
        return make(
          I.makeSchema(ast),
          (u, options) => pipe(type.parse(u, options), I.flatMap(ast.decode))
        )
      }
      case "TemplateLiteral": {
        const regex = I.getTemplateLiteralRegex(ast)
        return make(
          I.makeSchema(ast),
          (u) =>
            isString(u) ?
              regex.test(u) ? PE.success(u) : PE.failure(PE.type(ast, u)) :
              PE.failure(PE.type(AST.stringKeyword, u))
        )
      }
      case "Transform": {
        switch (as) {
          case "decoder": {
            const from = go(ast.from)
            return make(
              I.makeSchema(ast),
              (u, options) => pipe(from.parse(u, options), I.flatMap((a) => ast.decode(a, options)))
            )
          }
          case "guard":
            return go(ast.to)
          case "encoder": {
            const from = go(ast.from)
            return make(
              I.makeSchema(AST.transform(ast.to, ast.from, ast.encode, ast.decode)),
              (a, options) => pipe(ast.encode(a, options), I.flatMap((a) => from.parse(a, options)))
            )
          }
        }
      }
    }
  }

  return go(schema.ast)
}

const unknownArray = AST.tuple([], O.some([AST.unknownKeyword]), true)

const unknownRecord = AST.typeLiteral([], [
  AST.indexSignature(AST.stringKeyword, AST.unknownKeyword, true),
  AST.indexSignature(AST.symbolKeyword, AST.unknownKeyword, true)
])

const primitive = AST.union([AST.stringKeyword, AST.numberKeyword, AST.booleanKeyword])

const hasUnexpectedError = (e: PE.ParseError): boolean =>
  (PE.isKey(e) && e.errors.some(PE.isUnexpected)) ||
  (PE.isIndex(e) && e.errors.some(PE.isUnexpected))