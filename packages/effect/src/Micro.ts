/**
 * A lightweight alternative to the `Effect` data type, with a subset of the functionality.
 *
 * @since 3.3.0
 */
import type * as Channel from "./Channel.js"
import * as Context from "./Context.js"
import type { Effect, EffectTypeId } from "./Effect.js"
import * as Effectable from "./Effectable.js"
import * as Either from "./Either.js"
import { constVoid, dual, identity, type LazyArg } from "./Function.js"
import { globalValue } from "./GlobalValue.js"
import type { Inspectable } from "./Inspectable.js"
import { NodeInspectSymbol } from "./Inspectable.js"
import { StructuralPrototype } from "./internal/effectable.js"
import { SingleShotGen } from "./internal/singleShotGen.js"
import * as Option from "./Option.js"
import { type Pipeable, pipeArguments } from "./Pipeable.js"
import { hasProperty, isIterable, isTagged, type Predicate, type Refinement } from "./Predicate.js"
import type { ReadonlyRecord } from "./Record.js"
import type * as Sink from "./Sink.js"
import type * as Stream from "./Stream.js"
import type { Concurrency, Covariant, Equals, NoInfer, NotFunction } from "./Types.js"
import { YieldWrap, yieldWrapGet } from "./Utils.js"

/**
 * @since 3.3.0
 * @category type ids
 */
export const TypeId: unique symbol = Symbol.for("effect/Micro")

/**
 * @since 3.3.0
 * @category type ids
 */
export type TypeId = typeof TypeId

/**
 * @since 3.3.0
 * @category symbols
 */
export const runSymbol: unique symbol = Symbol.for("effect/Micro/runSymbol")

/**
 * @since 3.3.0
 * @category symbols
 */
export type runSymbol = typeof runSymbol

/**
 * A lightweight alternative to the `Effect` data type, with a subset of the functionality.
 *
 * @since 3.3.0
 * @category models
 */
export interface Micro<out A, out E = never, out R = never> extends Effect<A, E, R> {
  readonly [TypeId]: Micro.Variance<A, E, R>
  readonly [runSymbol]: (env: Env<any>, onResult: (result: Result<A, E>) => void) => void
  [Symbol.iterator](): MicroIterator<Micro<A, E, R>>
}

/**
 * @since 3.3.0
 */
export declare namespace Micro {
  /**
   * @since 3.3.0
   */
  export interface Variance<A, E, R> {
    _A: Covariant<A>
    _E: Covariant<E>
    _R: Covariant<R>
  }

  /**
   * @since 3.3.0
   */
  export type Success<T> = T extends Micro<infer _A, infer _E, infer _R> ? _A : never

  /**
   * @since 3.3.0
   */
  export type Error<T> = T extends Micro<infer _A, infer _E, infer _R> ? _E : never

  /**
   * @since 3.3.0
   */
  export type Context<T> = T extends Micro<infer _A, infer _E, infer _R> ? _R : never
}

/**
 * @since 3.3.0
 * @category guards
 */
export const isMicro = (u: unknown): u is Micro<any, any, any> => typeof u === "object" && u !== null && TypeId in u

/**
 * @since 3.3.0
 * @category models
 */
export interface MicroIterator<T extends Micro<any, any, any>> {
  next(...args: ReadonlyArray<any>): IteratorResult<YieldWrap<T>, Micro.Success<T>>
}

// ----------------------------------------------------------------------------
// Failures
// ----------------------------------------------------------------------------

/**
 * @since 3.3.0
 * @category failure
 */
export const FailureTypeId = Symbol.for("effect/Micro/Failure")

/**
 * @since 3.3.0
 * @category failure
 */
export type FailureTypeId = typeof FailureTypeId

/**
 * A Micro Failure is a data type that represents the different ways a Micro can fail.
 *
 * @since 3.3.0
 * @category failure
 */
export type Failure<E> = Failure.Unexpected | Failure.Expected<E> | Failure.Aborted

/**
 * @since 3.3.0
 * @category failure
 */
export declare namespace Failure {
  /**
   * @since 3.3.0
   */
  export interface Proto<Tag extends string, E> extends Pipeable, globalThis.Error {
    readonly [FailureTypeId]: {
      _E: Covariant<E>
    }
    readonly _tag: Tag
    readonly traces: ReadonlyArray<string>
  }

  /**
   * @since 3.3.0
   * @category failure
   */
  export interface Unexpected extends Proto<"Unexpected", never> {
    readonly defect: unknown
  }

  /**
   * @since 3.3.0
   * @category failure
   */
  export interface Expected<E> extends Proto<"Expected", E> {
    readonly error: E
  }

  /**
   * @since 3.3.0
   * @category failure
   */
  export interface Aborted extends Proto<"Aborted", never> {}
}

const failureVariance = {
  _E: identity
}

abstract class FailureImpl<Tag extends string, E> extends globalThis.Error implements Failure.Proto<Tag, E> {
  readonly [FailureTypeId]: {
    _E: Covariant<E>
  }
  constructor(
    readonly _tag: Tag,
    readonly originalError: unknown,
    readonly traces: ReadonlyArray<string>
  ) {
    let message: string
    let stack: string
    if (hasProperty(originalError, "message")) {
      message = `(Failure${_tag}) ${originalError.message}`
      stack = hasProperty(originalError, "stack") ? `(Failure${_tag}) ${originalError.stack}` : message
    } else {
      message = `Failure${_tag}: ${originalError}`
      stack = message
    }
    if (traces.length > 0) {
      stack += `\n    ${traces.join("\n    ")}`
    }
    super(message)
    this[FailureTypeId] = failureVariance
    this.stack = stack
  }
  pipe() {
    return pipeArguments(this, arguments)
  }
}

class FailureExpectedImpl<E> extends FailureImpl<"Expected", E> implements Failure.Expected<E> {
  constructor(readonly error: E, traces: ReadonlyArray<string> = []) {
    super("Expected", error, traces)
  }
}

/**
 * @since 3.3.0
 * @category failure
 */
export const FailureExpected = <E>(error: E, traces: ReadonlyArray<string> = []): Failure<E> =>
  new FailureExpectedImpl(error, traces)

class FailureUnexpectedImpl extends FailureImpl<"Unexpected", never> implements Failure.Unexpected {
  constructor(readonly defect: unknown, traces: ReadonlyArray<string> = []) {
    super("Unexpected", defect, traces)
  }
}

/**
 * @since 3.3.0
 * @category failure
 */
export const FailureUnexpected = (defect: unknown, traces: ReadonlyArray<string> = []): Failure<never> =>
  new FailureUnexpectedImpl(defect, traces)

class FailureAbortedImpl extends FailureImpl<"Aborted", never> implements Failure.Aborted {
  constructor(traces: ReadonlyArray<string> = []) {
    super("Aborted", "interrupted", traces)
  }
}

/**
 * @since 3.3.0
 * @category failure
 */
export const FailureAborted = (traces: ReadonlyArray<string> = []): Failure<never> => new FailureAbortedImpl(traces)

/**
 * @since 3.3.0
 * @category failure
 */
export const failureSquash = <E>(self: Failure<E>): unknown =>
  self._tag === "Expected" ? self.error : self._tag === "Unexpected" ? self.defect : self

/**
 * @since 3.3.0
 * @category failure
 */
export const failureWithTrace: {
  (trace: string): <E>(self: Failure<E>) => Failure<E>
  <E>(self: Failure<E>, trace: string): Failure<E>
} = dual(2, <E>(self: Failure<E>, trace: string): Failure<E> => {
  if (self._tag === "Expected") {
    return FailureExpected(self.error, [...self.traces, trace])
  } else if (self._tag === "Unexpected") {
    return FailureUnexpected(self.defect, [...self.traces, trace])
  }
  return FailureAborted([...self.traces, trace])
})

// ----------------------------------------------------------------------------
// Result
// ----------------------------------------------------------------------------

/**
 * The Micro Result type is a data type that represents the result of a Micro
 * computation.
 *
 * It uses the `Either` data type to represent the success and failure cases.
 *
 * @since 3.3.0
 * @category result
 */
export type Result<A, E = never> = Either.Either<A, Failure<E>>

/**
 * @since 3.3.0
 * @category result
 */
export const ResultAborted: Result<never> = Either.left(FailureAborted())

/**
 * @since 3.3.0
 * @category result
 */
export const ResultSucceed = <A>(a: A): Result<A> => Either.right(a)

/**
 * @since 3.3.0
 * @category result
 */
export const ResultFail = <E>(e: E): Result<never, E> => Either.left(FailureExpected(e))

/**
 * @since 3.3.0
 * @category result
 */
export const ResultFailUnexpected = (defect: unknown): Result<never> => Either.left(FailureUnexpected(defect))

/**
 * @since 3.3.0
 * @category result
 */
export const ResultFailWith = <E>(failure: Failure<E>): Result<never, E> => Either.left(failure)

// ----------------------------------------------------------------------------
// env
// ----------------------------------------------------------------------------

/**
 * @since 3.3.0
 * @category environment
 */
export const EnvTypeId = Symbol.for("effect/Micro/Env")

/**
 * @since 3.3.0
 * @category environment
 */
export type EnvTypeId = typeof EnvTypeId

/**
 * @since 3.3.0
 * @category environment
 */
export interface Env<R> {
  readonly [EnvTypeId]: {
    _R: Covariant<R>
  }
  readonly refs: ReadonlyRecord<string, unknown>
}

/**
 * @since 3.3.0
 * @category environment
 */
export const EnvRefTypeId: unique symbol = Symbol.for("effect/Micro/EnvRef")

/**
 * @since 3.3.0
 * @category environment
 */
export type EnvRefTypeId = typeof EnvRefTypeId

/**
 * @since 3.3.0
 * @category environment
 */
export interface EnvRef<A> {
  readonly [EnvRefTypeId]: EnvRefTypeId
  readonly key: string
  readonly initial: A
}

const EnvProto = {
  [EnvTypeId]: {
    _R: identity
  }
}

/**
 * @since 3.3.0
 * @category environment
 */
export const envMake = <R = never>(
  refs: Record<string, unknown>
): Env<R> => {
  const self = Object.create(EnvProto)
  self.refs = refs
  return self
}

/**
 * @since 3.3.0
 * @category environment
 */
export const envUnsafeMakeEmpty = (): Env<never> => {
  const controller = new AbortController()
  const refs = Object.create(null)
  refs[currentAbortController.key] = controller
  refs[currentAbortSignal.key] = controller.signal
  return envMake(refs)
}

/**
 * @since 3.3.0
 * @category environment
 */
export const envGet = <R, A>(env: Env<R>, ref: EnvRef<A>): A => env.refs[ref.key] as A ?? ref.initial

/**
 * @since 3.3.0
 * @category environment
 */
export const envSet = <R, A>(env: Env<R>, ref: EnvRef<A>, value: A): Env<R> => {
  const refs = Object.assign(Object.create(null), env.refs)
  refs[ref.key] = value
  return envMake(refs)
}

/**
 * @since 3.3.0
 * @category environment
 */
export const envMutate = <R>(
  env: Env<R>,
  f: (map: Record<string, unknown>) => ReadonlyRecord<string, unknown>
): Env<R> => envMake(f(Object.assign(Object.create(null), env.refs)))

// ========================================================================
// Env refs
// ========================================================================

const EnvRefProto = {
  [EnvRefTypeId]: EnvRefTypeId
}

/**
 * @since 3.3.0
 * @category environment refs
 */
export const envRefMake = <A>(key: string, initial: LazyArg<A>): EnvRef<A> =>
  globalValue(key, () => {
    const self = Object.create(EnvRefProto)
    self.key = key
    self.initial = initial()
    return self
  })

/**
 * @since 3.3.0
 * @category environment refs
 */
export const currentAbortController: EnvRef<AbortController> = envRefMake(
  "effect/Micro/currentAbortController",
  () => new AbortController()
)

/**
 * @since 3.3.0
 * @category environment refs
 */
export const currentAbortSignal: EnvRef<AbortSignal> = envRefMake(
  "effect/Micro/currentAbortSignal",
  () => currentAbortController.initial.signal
)

/**
 * @since 3.3.0
 * @category environment refs
 */
export const currentContext: EnvRef<Context.Context<never>> = envRefMake(
  "effect/Micro/currentContext",
  () => Context.empty()
)

/**
 * @since 3.3.0
 * @category environment refs
 */
export const currentConcurrency: EnvRef<"unbounded" | number> = envRefMake(
  "effect/Micro/currentConcurrency",
  () => "unbounded"
)

const currentInterruptible: EnvRef<boolean> = envRefMake(
  "effect/Micro/currentInterruptible",
  () => true
)

/**
 * If you have a `Micro` that uses `concurrency: "inherit"`, you can use this
 * api to control the concurrency of that `Micro` when it is run.
 *
 * @since 3.3.0
 * @category env refs
 * @example
 * import * as Micro from "effect/Micro"
 *
 * Micro.forEach([1, 2, 3], (n) => Micro.succeed(n), {
 *   concurrency: "inherit"
 * }).pipe(
 *   Micro.withConcurrency(2) // use a concurrency of 2
 * )
 */
export const withConcurrency: {
  (concurrency: "unbounded" | number): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(self: Micro<A, E, R>, concurrency: "unbounded" | number): Micro<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Micro<A, E, R>, concurrency: "unbounded" | number): Micro<A, E, R> =>
    locally(self, currentConcurrency, concurrency)
)

// ----------------------------------------------------------------------------
// constructors
// ----------------------------------------------------------------------------

const MicroProto = {
  ...Effectable.EffectPrototype,
  _op: "Micro",
  [TypeId]: {
    _A: identity,
    _E: identity,
    _R: identity
  },
  [Symbol.iterator]() {
    return new SingleShotGen(new YieldWrap(this)) as any
  }
}

const unsafeMake = <A, E, R>(
  run: (env: Env<R>, onResult: (result: Result<A, E>) => void) => void
): Micro<A, E, R> => {
  const self = Object.create(MicroProto)
  self[runSymbol] = run
  return self
}

const unsafeMakeNoAbort = <A, E, R>(
  run: (env: Env<R>, onResult: (result: Result<A, E>) => void) => void
): Micro<A, E, R> =>
  unsafeMake(function(env, onResult) {
    try {
      run(env, onResult)
    } catch (err) {
      onResult(Either.left(FailureUnexpected(err)))
    }
  })

/**
 * A low-level constructor for creating a `Micro` effect. It takes a function
 * that receives an environment and a callback which should be called with the
 * result of the effect.
 *
 * @since 3.3.0
 * @category constructors
 */
export const make = <A, E, R>(
  run: (env: Env<R>, onResult: (result: Result<A, E>) => void) => void
): Micro<A, E, R> =>
  unsafeMake(function(env: Env<R>, onResult: (result: Result<A, E>) => void) {
    if (env.refs[currentInterruptible.key] !== false && (env.refs[currentAbortSignal.key] as AbortSignal).aborted) {
      return onResult(ResultAborted)
    }
    try {
      run(env, onResult)
    } catch (err) {
      onResult(ResultFailUnexpected(err))
    }
  })

/**
 * Creates a `Micro` effect that will succeed with the specified constant value.
 *
 * @since 3.3.0
 * @category constructors
 */
export const succeed = <A>(a: A): Micro<A> =>
  make(function(_env, onResult) {
    onResult(ResultSucceed(a))
  })

/**
 * Creates a `Micro` effect that will fail with the specified error.
 *
 * This will result in a `FailureExpected`, where the error is tracked at the
 * type level.
 *
 * @since 3.3.0
 * @category constructors
 */
export const fail = <E>(e: E): Micro<never, E> =>
  make(function(_env, onResult) {
    onResult(ResultFail(e))
  })

/**
 * Creates a `Micro` effect that will fail with lazily evaluated error.
 *
 * This will result in a `FailureExpected`, where the error is tracked at the
 * type level.
 *
 * @since 3.3.0
 * @category constructors
 */
export const failSync = <E>(e: LazyArg<E>): Micro<never, E> =>
  make(function(_env, onResult) {
    onResult(ResultFail(e()))
  })

/**
 * Abort the current `Micro` effect.
 *
 * @since 3.3.0
 * @category constructors
 */
export const abort: Micro<never> = make(function(env, onResult) {
  const controller = envGet(env, currentAbortController)
  controller.abort()
  onResult(ResultAborted)
})

/**
 * Creates a `Micro` effect that will die with the specified error.
 *
 * This will result in a `FailureUnexpected`, where the error is not tracked at
 * the type level.
 *
 * @since 3.3.0
 * @category constructors
 */
export const die = (defect: unknown): Micro<never> =>
  make(function(_env, onResult) {
    onResult(ResultFailUnexpected(defect))
  })

/**
 * Creates a `Micro` effect that will fail with the specified `Failure`.
 *
 * @since 3.3.0
 * @category constructors
 */
export const failWith = <E>(failure: Failure<E>): Micro<never, E> =>
  make(function(_env, onResult) {
    onResult(Either.left(failure))
  })

/**
 * Creates a `Micro` effect that will fail with the lazily evaluated `Failure`.
 *
 * @since 3.3.0
 * @category constructors
 */
export const failWithSync = <E>(failure: LazyArg<Failure<E>>): Micro<never, E> =>
  make(function(_env, onResult) {
    onResult(Either.left(failure()))
  })

/**
 * Creates a `Micro` effect that will succeed with the lazily evaluated value.
 *
 * If the evaluation of the value throws an error, the effect will fail with
 * `FailureUnexpected`.
 *
 * @since 3.3.0
 * @category constructors
 */
export const sync = <A>(evaluate: LazyArg<A>): Micro<A> =>
  make(function(_env, onResult) {
    onResult(Either.right(evaluate()))
  })

/**
 * Converts a `Result` into a `Micro` effect.
 *
 * @since 3.3.0
 * @category constructors
 */
export const fromResult = <A, E>(self: Result<A, E>): Micro<A, E> =>
  make(function(_env, onResult) {
    onResult(self)
  })

/**
 * Access the given `Context.Tag` from the environment.
 *
 * @since 3.3.0
 * @category constructors
 */
export const service = <I, S>(tag: Context.Tag<I, S>): Micro<S, never, I> =>
  make(function(env, onResult) {
    onResult(Either.right(Context.get(envGet(env, currentContext) as Context.Context<I>, tag as any) as S))
  })

/**
 * Access the given `Context.Tag` from the environment, without tracking the
 * dependency at the type level.
 *
 * It will return an `Option` of the service, depending on whether it is
 * available in the environment or not.
 *
 * @since 3.3.0
 * @category constructors
 */
export const serviceOption = <I, S>(tag: Context.Tag<I, S>): Micro<Option.Option<S>> =>
  make(function(env, onResult) {
    onResult(ResultSucceed(Context.getOption(envGet(env, currentContext) as Context.Context<I>, tag)))
  })

/**
 * Converts an `Option` into a `Micro` effect, that will fail with a
 * `Option.None` if the option is `None`. Otherwise, it will succeed with the
 * value of the option.
 *
 * @since 3.3.0
 * @category constructors
 */
export const fromOption = <A>(option: Option.Option<A>): Micro<A, Option.None<never>> =>
  make(function(_env, onResult) {
    onResult(option._tag === "Some" ? Either.right(option.value) : ResultFail(Option.none()) as any)
  })

/**
 * Converts an `Either` into a `Micro` effect, that will fail with the left side
 * of the either if it is a `Left`. Otherwise, it will succeed with the right
 * side of the either.
 *
 * @since 3.3.0
 * @category constructors
 */
export const fromEither = <R, L>(either: Either.Either<R, L>): Micro<R, L> =>
  make(function(_env, onResult) {
    onResult(either._tag === "Right" ? either : ResultFail(either.left) as any)
  })

/**
 * Lazily creates a `Micro` effect from the given side-effect.
 *
 * @since 3.3.0
 * @category constructors
 */
export const suspend = <A, E, R>(evaluate: LazyArg<Micro<A, E, R>>): Micro<A, E, R> =>
  make(function(env, onResult) {
    evaluate()[runSymbol](env, onResult)
  })

const void_: Micro<void> = succeed(void 0)
export {
  /**
   * A `Micro` effect that will succeed with `void` (`undefined`).
   *
   * @since 3.3.0
   * @category constructors
   */
  void_ as void
}

/**
 * Create a `Micro` effect from an asynchronous computation.
 *
 * You can return a cleanup effect that will be run when the effect is aborted.
 * It is also passed an `AbortSignal` that is triggered when the effect is
 * aborted.
 *
 * @since 3.3.0
 * @category constructors
 */
export const async = <A, E = never, R = never>(
  register: (resume: (effect: Micro<A, E, R>) => void, signal: AbortSignal) => void | Micro<void, never, R>
): Micro<A, E, R> =>
  make(function(env, onResult) {
    let resumed = false
    const signal = envGet(env, currentAbortSignal)
    let cleanup: Micro<void, never, R> | void = undefined
    function onAbort() {
      if (cleanup) {
        resume(uninterruptible(andThen(cleanup, fromResult(ResultAborted))))
      } else {
        resume(failWith(FailureAborted()))
      }
    }
    function resume(effect: Micro<A, E, R>) {
      if (resumed) {
        return
      }
      resumed = true
      signal.removeEventListener("abort", onAbort)
      effect[runSymbol](env, onResult)
    }
    cleanup = register(resume, signal)
    if (resumed) return
    signal.addEventListener("abort", onAbort)
  })

const try_ = <A, E>(options: {
  try: LazyArg<A>
  catch: (error: unknown) => E
}): Micro<A, E> =>
  make(function(_env, onResult) {
    try {
      onResult(ResultSucceed(options.try()))
    } catch (err) {
      onResult(ResultFail(options.catch(err)))
    }
  })
export {
  /**
   * The `Micro` equivalent of a try / catch block, which allows you to map
   * thrown errors to a specific error type.
   *
   * @since 3.3.0
   * @category constructors
   */
  try_ as try
}

/**
 * Wrap a `Promise` into a `Micro` effect. Any errors will result in a
 * `FailureUnexpected`.
 *
 * @since 3.3.0
 * @category constructors
 */
export const promise = <A>(evaluate: (signal: AbortSignal) => PromiseLike<A>): Micro<A> =>
  async<A>(function(resume, signal) {
    evaluate(signal).then(
      (a) => resume(succeed(a)),
      (e) => resume(die(e))
    )
  })

/**
 * Wrap a `Promise` into a `Micro` effect. Any errors will be caught and
 * converted into a specific error type.
 *
 * @since 3.3.0
 * @category constructors
 */
export const tryPromise = <A, E>(options: {
  readonly try: (signal: AbortSignal) => PromiseLike<A>
  readonly catch: (error: unknown) => E
}): Micro<A, E> =>
  async<A, E>(function(resume, signal) {
    try {
      options.try(signal).then(
        (a) => resume(succeed(a)),
        (e) => resume(fail(options.catch(e)))
      )
    } catch (err) {
      resume(fail(options.catch(err)))
    }
  })

const yieldState: {
  tasks: Array<() => void>
  working: boolean
} = globalValue("effect/Micro/yieldState", () => ({
  tasks: [],
  working: false
}))

const yieldFlush = () => {
  const tasks = yieldState.tasks
  yieldState.tasks = []
  for (let i = 0, len = tasks.length; i < len; i++) {
    tasks[i]()
  }
}

const setImmediate = "setImmediate" in globalThis ? globalThis.setImmediate : (f: () => void) => setTimeout(f, 0)

const yieldAdd = (task: () => void) => {
  yieldState.tasks.push(task)
  if (!yieldState.working) {
    yieldState.working = true
    setImmediate(() => {
      yieldState.working = false
      yieldFlush()
    })
  }
}

/**
 * Pause the execution of the current `Micro` effect, and resume it on the next
 * iteration of the event loop.
 *
 * @since 3.3.0
 * @category constructors
 */
export const yieldNow: Micro<void> = make(function(_env, onResult) {
  yieldAdd(() => onResult(Either.right(void 0)))
})

/**
 * A `Micro` that will never succeed or fail. It wraps `setInterval` to prevent
 * the Javascript runtime from exiting.
 *
 * @since 3.3.0
 * @category constructors
 */
export const never: Micro<never> = async<never>(function() {
  const interval = setInterval(constVoid, 2147483646)
  return sync(() => clearInterval(interval))
})

/**
 * @since 3.3.0
 * @category constructors
 */
export const gen = <Eff extends YieldWrap<Micro<any, any, any>>, AEff>(
  f: () => Generator<Eff, AEff, never>
): Micro<
  AEff,
  [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Micro<infer _A, infer E, infer _R>>] ? E : never,
  [Eff] extends [never] ? never : [Eff] extends [YieldWrap<Micro<infer _A, infer _E, infer R>>] ? R : never
> =>
  make(function(env, onResult) {
    const iterator = f() as Iterator<YieldWrap<Micro<any, any, any>>, AEff, any>
    let running = false
    let value: any = undefined
    function run() {
      running = true
      try {
        let shouldContinue = true
        while (shouldContinue) {
          const result = iterator.next(value)
          if (result.done) {
            return onResult(Either.right(result.value))
          }
          shouldContinue = false
          yieldWrapGet(result.value)[runSymbol](env, function(result) {
            if (result._tag === "Left") {
              onResult(result)
            } else {
              shouldContinue = true
              value = result.right
              if (!running) run()
            }
          })
        }
      } catch (err) {
        onResult(ResultFailUnexpected(err))
      }
      running = false
    }
    run()
  })

// ----------------------------------------------------------------------------
// mapping & sequencing
// ----------------------------------------------------------------------------

/**
 * Flattens any nested `Micro` effects, merging the error and requirement types.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const flatten = <A, E, R, E2, R2>(self: Micro<Micro<A, E, R>, E2, R2>): Micro<A, E | E2, R | R2> =>
  make(function(env, onResult) {
    self[runSymbol](
      env,
      (result) => result._tag === "Left" ? onResult(result as any) : result.right[runSymbol](env, onResult)
    )
  })

/**
 * Transforms the success value of the `Micro` effect with the specified
 * function.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const map: {
  <A, B>(f: (a: NoInfer<A>) => B): <E, R>(self: Micro<A, E, R>) => Micro<B, E, R>
  <A, E, R, B>(self: Micro<A, E, R>, f: (a: NoInfer<A>) => B): Micro<B, E, R>
} = dual(2, <A, E, R, B>(self: Micro<A, E, R>, f: (a: A) => B): Micro<B, E, R> =>
  make(function(env, onResult) {
    self[runSymbol](env, function(result) {
      onResult(result._tag === "Left" ? result as any : ResultSucceed(f(result.right)))
    })
  }))

/**
 * Create a `Micro` effect that will replace the success value of the given
 * effect.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const as: {
  <A, B>(value: B): <E, R>(self: Micro<A, E, R>) => Micro<B, E, R>
  <A, E, R, B>(self: Micro<A, E, R>, value: B): Micro<B, E, R>
} = dual(2, <A, E, R, B>(self: Micro<A, E, R>, value: B): Micro<B, E, R> => map(self, (_) => value))

/**
 * Wrap the success value of this `Micro` effect in an `Option.Some`.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const asSome = <A, E, R>(self: Micro<A, E, R>): Micro<Option.Some<A>, E, R> => map(self, Option.some) as any

/**
 * Map the success value of this `Micro` effect to another `Micro` effect, then
 * flatten the result.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const flatMap: {
  <A, B, E2, R2>(f: (a: NoInfer<A>) => Micro<B, E2, R2>): <E, R>(self: Micro<A, E, R>) => Micro<B, E | E2, R | R2>
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: NoInfer<A>) => Micro<B, E2, R2>): Micro<B, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: A) => Micro<B, E2, R2>): Micro<B, E | E2, R | R2> =>
    make(function(env, onResult) {
      self[runSymbol](env, function(result) {
        if (result._tag === "Left") {
          return onResult(result as any)
        }
        f(result.right)[runSymbol](env, onResult)
      })
    })
)

/**
 * Swap the error and success types of the `Micro` effect.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const flip = <A, E, R>(self: Micro<A, E, R>): Micro<E, A, R> =>
  matchMicro(self, {
    onFailure: succeed,
    onSuccess: fail
  })

/**
 * A more flexible version of `flatMap`, that combines `map` and `flatMap` into
 * a single api.
 *
 * It also allows you to pass in a `Micro` effect directly, which will be
 * executed after the current effect.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const andThen: {
  <A, X>(
    f: (a: NoInfer<A>) => X
  ): <E, R>(
    self: Micro<A, E, R>
  ) => [X] extends [Micro<infer A1, infer E1, infer R1>] ? Micro<A1, E | E1, R | R1>
    : Micro<X, E, R>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Micro<A, E, R>
  ) => [X] extends [Micro<infer A1, infer E1, infer R1>] ? Micro<A1, E | E1, R | R1>
    : Micro<X, E, R>
  <A, E, R, X>(
    self: Micro<A, E, R>,
    f: (a: NoInfer<A>) => X
  ): [X] extends [Micro<infer A1, infer E1, infer R1>] ? Micro<A1, E | E1, R | R1>
    : Micro<X, E, R>
  <A, E, R, X>(
    self: Micro<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Micro<infer A1, infer E1, infer R1>] ? Micro<A1, E | E1, R | R1>
    : Micro<X, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: any): Micro<B, E | E2, R | R2> =>
    make(function(env, onResult) {
      self[runSymbol](env, function(result) {
        if (result._tag === "Left") {
          return onResult(result as any)
        } else if (envGet(env, currentAbortSignal).aborted) {
          return onResult(ResultAborted)
        }
        const value = isMicro(f) ? f : typeof f === "function" ? f(result.right) : f
        if (isMicro(value)) {
          value[runSymbol](env, onResult)
        } else {
          onResult(ResultSucceed(value))
        }
      })
    })
)

/**
 * Execute a side effect from the success value of the `Micro` effect.
 *
 * It is similar to the `andThen` api, but the success value is ignored.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const tap: {
  <A, X>(
    f: (a: NoInfer<A>) => X
  ): <E, R>(
    self: Micro<A, E, R>
  ) => [X] extends [Micro<infer _A1, infer E1, infer R1>] ? Micro<A, E | E1, R | R1>
    : Micro<A, E, R>
  <X>(
    f: NotFunction<X>
  ): <A, E, R>(
    self: Micro<A, E, R>
  ) => [X] extends [Micro<infer _A1, infer E1, infer R1>] ? Micro<A, E | E1, R | R1>
    : Micro<A, E, R>
  <A, E, R, X>(
    self: Micro<A, E, R>,
    f: (a: NoInfer<A>) => X
  ): [X] extends [Micro<infer _A1, infer E1, infer R1>] ? Micro<A, E | E1, R | R1>
    : Micro<A, E, R>
  <A, E, R, X>(
    self: Micro<A, E, R>,
    f: NotFunction<X>
  ): [X] extends [Micro<infer _A1, infer E1, infer R1>] ? Micro<A, E | E1, R | R1>
    : Micro<A, E, R>
} = dual(
  2,
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: A) => Micro<B, E2, R2>): Micro<A, E | E2, R | R2> =>
    make(function(env, onResult) {
      self[runSymbol](env, function(selfResult) {
        if (selfResult._tag === "Left") {
          return onResult(selfResult as any)
        } else if (envGet(env, currentAbortSignal).aborted) {
          return onResult(ResultAborted)
        }
        const value = isMicro(f) ? f : typeof f === "function" ? f(selfResult.right) : f
        if (isMicro(value)) {
          value[runSymbol](env, function(tapResult) {
            if (tapResult._tag === "Left") {
              return onResult(tapResult)
            }
            onResult(selfResult)
          })
        } else {
          onResult(selfResult)
        }
      })
    })
)

/**
 * Replace the success value of the `Micro` effect with `void`.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const asVoid = <A, E, R>(self: Micro<A, E, R>): Micro<void, E, R> => map(self, (_) => undefined)

/**
 * Access the `Result` of the given `Micro` effect.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const asResult = <A, E, R>(self: Micro<A, E, R>): Micro<Result<A, E>, never, R> =>
  make(function(env, onResult) {
    self[runSymbol](env, function(result) {
      onResult(ResultSucceed(result))
    })
  })

/**
 * Replace the error type of the given `Micro` with the full `Failure` object.
 *
 * @since 3.3.0
 * @category mapping & sequencing
 */
export const sandbox = <A, E, R>(self: Micro<A, E, R>): Micro<A, Failure<E>, R> =>
  catchFailure(self, (failure) => fail(failure))

function forkSignal(env: Env<any>) {
  const controller = new AbortController()
  const parentSignal = envGet(env, currentAbortSignal)
  function onAbort() {
    controller.abort()
    parentSignal.removeEventListener("abort", onAbort)
  }
  parentSignal.addEventListener("abort", onAbort)
  const envWithSignal = envMutate(env, function(refs) {
    refs[currentAbortController.key] = controller
    refs[currentAbortSignal.key] = controller.signal
    return refs
  })
  return [envWithSignal, onAbort] as const
}

/**
 * Returns an effect that races all the specified effects,
 * yielding the value of the first effect to succeed with a value. Losers of
 * the race will be interrupted immediately
 *
 * @since 3.3.0
 * @category sequencing
 */
export const raceAll = <Eff extends Micro<any, any, any>>(
  all: Iterable<Eff>
): Micro<Micro.Success<Eff>, Micro.Error<Eff>, Micro.Context<Eff>> =>
  make(function(env, onResult) {
    const [envWithSignal, onAbort] = forkSignal(env)

    const effects = Array.from(all)
    let len = effects.length
    let index = 0
    let done = 0
    let result: Result<any, any> | undefined = undefined
    const failures: Array<Failure<any>> = []
    function onDone(result_: Result<any, any>) {
      done++
      if (result_._tag === "Right" && result === undefined) {
        len = index
        result = result_
        onAbort()
      } else if (result_._tag === "Left") {
        failures.push(result_.left)
      }
      if (done >= len) {
        onResult(result ?? Either.left(failures[0]))
      }
    }

    for (; index < len; index++) {
      effects[index][runSymbol](envWithSignal, onDone)
    }
  })

/**
 * Returns an effect that races all the specified effects,
 * yielding the value of the first effect to succeed or fail. Losers of
 * the race will be interrupted immediately
 *
 * @since 3.3.0
 * @category sequencing
 */
export const raceAllFirst = <Eff extends Micro<any, any, any>>(
  all: Iterable<Eff>
): Micro<Micro.Success<Eff>, Micro.Error<Eff>, Micro.Context<Eff>> =>
  make(function(env, onResult) {
    const [envWithSignal, onAbort] = forkSignal(env)

    const effects = Array.from(all)
    let len = effects.length
    let index = 0
    let done = 0
    let result: Result<any, any> | undefined = undefined
    const failures: Array<Failure<any>> = []
    function onDone(result_: Result<any, any>) {
      done++
      if (result === undefined) {
        len = index
        result = result_
        onAbort()
      }
      if (done >= len) {
        onResult(result ?? Either.left(failures[0]))
      }
    }

    for (; index < len; index++) {
      effects[index][runSymbol](envWithSignal, onDone)
    }
  })

/**
 * Returns an effect that races two effects, yielding the value of the first
 * effect to succeed. Losers of the race will be interrupted immediately
 *
 * @since 3.3.0
 * @category sequencing
 */
export const race: {
  <A2, E2, R2>(that: Micro<A2, E2, R2>): <A, E, R>(self: Micro<A, E, R>) => Micro<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, that: Micro<A2, E2, R2>): Micro<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, that: Micro<A2, E2, R2>): Micro<A | A2, E | E2, R | R2> =>
    raceAll([self, that])
)

/**
 * Returns an effect that races two effects, yielding the value of the first
 * effect to succeed *or* fail. Losers of the race will be interrupted immediately
 *
 * @since 3.3.0
 * @category sequencing
 */
export const raceFirst: {
  <A2, E2, R2>(that: Micro<A2, E2, R2>): <A, E, R>(self: Micro<A, E, R>) => Micro<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, that: Micro<A2, E2, R2>): Micro<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, that: Micro<A2, E2, R2>): Micro<A | A2, E | E2, R | R2> =>
    raceAllFirst([self, that])
)

// ----------------------------------------------------------------------------
// zipping
// ----------------------------------------------------------------------------

/**
 * Combine two `Micro` effects into a single effect that produces a tuple of
 * their results.
 *
 * @since 3.3.0
 * @category zipping
 */
export const zip: {
  <A2, E2, R2>(
    that: Micro<A2, E2, R2>,
    options?:
      | { readonly concurrent?: boolean | undefined }
      | undefined
  ): <A, E, R>(self: Micro<A, E, R>) => Micro<[A, A2], E2 | E, R2 | R>
  <A, E, R, A2, E2, R2>(
    self: Micro<A, E, R>,
    that: Micro<A2, E2, R2>,
    options?:
      | { readonly concurrent?: boolean | undefined }
      | undefined
  ): Micro<[A, A2], E | E2, R | R2>
} = dual((args) => isMicro(args[1]), <A, E, R, A2, E2, R2>(
  self: Micro<A, E, R>,
  that: Micro<A2, E2, R2>,
  options?:
    | { readonly concurrent?: boolean | undefined }
    | undefined
): Micro<[A, A2], E | E2, R | R2> => {
  if (options?.concurrent) {
    return all([self, that], { concurrency: "unbounded" })
  }
  return flatMap(self, (a) => map(that, (a2) => [a, a2]))
})

// ----------------------------------------------------------------------------
// filtering & conditionals
// ----------------------------------------------------------------------------

/**
 * Filter the specified effect with the provided function, failing with specified
 * error if the predicate fails.
 *
 * In addition to the filtering capabilities discussed earlier, you have the option to further
 * refine and narrow down the type of the success channel by providing a
 * [user-defined type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
 * Let's explore this concept through an example:
 *
 * @since 3.3.0
 * @category filtering & conditionals
 */
export const filterOrFailWith: {
  <A, B extends A, E2>(
    refinement: Refinement<NoInfer<A>, B>,
    orFailWith: (a: NoInfer<A>) => Failure<E2>
  ): <E, R>(self: Micro<A, E, R>) => Micro<B, E2 | E, R>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => Failure<E2>
  ): <E, R>(self: Micro<A, E, R>) => Micro<A, E2 | E, R>
  <A, E, R, B extends A, E2>(
    self: Micro<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => Failure<E2>
  ): Micro<B, E | E2, R>
  <A, E, R, E2>(self: Micro<A, E, R>, predicate: Predicate<A>, orFailWith: (a: A) => Failure<E2>): Micro<A, E | E2, R>
} = dual((args) => isMicro(args[0]), <A, E, R, B extends A, E2>(
  self: Micro<A, E, R>,
  refinement: Refinement<A, B>,
  orFailWith: (a: A) => Failure<E2>
): Micro<B, E | E2, R> => flatMap(self, (a) => refinement(a) ? succeed(a as any) : failWith(orFailWith(a))))

/**
 * Filter the specified effect with the provided function, failing with specified
 * error if the predicate fails.
 *
 * In addition to the filtering capabilities discussed earlier, you have the option to further
 * refine and narrow down the type of the success channel by providing a
 * [user-defined type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates).
 * Let's explore this concept through an example:
 *
 * @since 3.3.0
 * @category filtering & conditionals
 */
export const filterOrFail: {
  <A, B extends A, E2>(
    refinement: Refinement<NoInfer<A>, B>,
    orFailWith: (a: NoInfer<A>) => E2
  ): <E, R>(self: Micro<A, E, R>) => Micro<B, E2 | E, R>
  <A, E2>(
    predicate: Predicate<NoInfer<A>>,
    orFailWith: (a: NoInfer<A>) => E2
  ): <E, R>(self: Micro<A, E, R>) => Micro<A, E2 | E, R>
  <A, E, R, B extends A, E2>(
    self: Micro<A, E, R>,
    refinement: Refinement<A, B>,
    orFailWith: (a: A) => E2
  ): Micro<B, E | E2, R>
  <A, E, R, E2>(self: Micro<A, E, R>, predicate: Predicate<A>, orFailWith: (a: A) => E2): Micro<A, E | E2, R>
} = dual((args) => isMicro(args[0]), <A, E, R, B extends A, E2>(
  self: Micro<A, E, R>,
  refinement: Refinement<A, B>,
  orFailWith: (a: A) => E2
): Micro<B, E | E2, R> => flatMap(self, (a) => refinement(a) ? succeed(a as any) : fail(orFailWith(a))))

/**
 * The moral equivalent of `if (p) exp`.
 *
 * @since 3.3.0
 * @category filtering & conditionals
 */
export const when: {
  (condition: LazyArg<boolean>): <A, E, R>(self: Micro<A, E, R>) => Micro<Option.Option<A>, E, R>
  <A, E, R>(self: Micro<A, E, R>, condition: LazyArg<boolean>): Micro<Option.Option<A>, E, R>
} = dual(
  2,
  <A, E, R>(self: Micro<A, E, R>, condition: LazyArg<boolean>): Micro<Option.Option<A>, E, R> =>
    suspend(() => condition() ? asSome(self) : succeed(Option.none()))
)

/**
 * The moral equivalent of `if (p) exp`, that allows an effectful predicate.
 *
 * @since 3.3.0
 * @category filtering & conditionals
 */
export const whenMicro: {
  <E, R>(
    condition: Micro<boolean, E, R>
  ): <A, E2, R2>(effect: Micro<A, E2, R2>) => Micro<Option.Option<A>, E | E2, R | R2>
  <A, E2, R2, E, R>(self: Micro<A, E2, R2>, condition: Micro<boolean, E, R>): Micro<Option.Option<A>, E2 | E, R2 | R>
} = dual(
  2,
  <A, E2, R2, E, R>(self: Micro<A, E2, R2>, condition: Micro<boolean, E, R>): Micro<Option.Option<A>, E2 | E, R2 | R> =>
    flatMap(condition, (pass) => pass ? asSome(self) : succeed(Option.none()))
)

// ----------------------------------------------------------------------------
// repetition
// ----------------------------------------------------------------------------

/**
 * Repeat the given `Micro` using the provided options.
 *
 * The `while` predicate will be checked after each iteration, and can use the
 * fall `Result` of the effect to determine if the repetition should continue.
 *
 * @since 3.3.0
 * @category repetition
 */
export const repeatResult: {
  <A, E>(options: {
    while: Predicate<Result<A, E>>
    times?: number | undefined
    delay?: DelayFn | undefined
  }): <R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(self: Micro<A, E, R>, options: {
    while: Predicate<Result<A, E>>
    times?: number | undefined
    delay?: DelayFn | undefined
  }): Micro<A, E, R>
} = dual(2, <A, E, R>(self: Micro<A, E, R>, options: {
  while: Predicate<Result<A, E>>
  times?: number | undefined
  delay?: DelayFn | undefined
}): Micro<A, E, R> =>
  make(function(env, onResult) {
    const startedAt = options.delay ? Date.now() : 0
    let attempt = 0
    self[runSymbol](env, function loop(result) {
      if (options.while !== undefined && !options.while(result)) {
        return onResult(result)
      } else if (options.times !== undefined && attempt >= options.times) {
        return onResult(result)
      }
      attempt++
      let delayEffect = yieldNow
      if (options.delay !== undefined) {
        const elapsed = Date.now() - startedAt
        const duration = options.delay(attempt, elapsed)
        if (Option.isNone(duration)) {
          return onResult(result)
        }
        delayEffect = sleep(duration.value)
      }
      delayEffect[runSymbol](env, function(result) {
        if (result._tag === "Left") {
          return onResult(result as any)
        }
        self[runSymbol](env, loop)
      })
    })
  }))

/**
 * Repeat the given `Micro` effect using the provided options. Only successful
 * results will be repeated.
 *
 * @since 3.3.0
 * @category repetition
 */
export const repeat: {
  <A, E>(
    options?: {
      while?: Predicate<A> | undefined
      times?: number | undefined
      delay?: DelayFn | undefined
    } | undefined
  ): <R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(
    self: Micro<A, E, R>,
    options?: {
      while?: Predicate<A> | undefined
      times?: number | undefined
      delay?: DelayFn | undefined
    } | undefined
  ): Micro<A, E, R>
} = dual((args) => isMicro(args[0]), <A, E, R>(
  self: Micro<A, E, R>,
  options?: {
    while?: Predicate<A> | undefined
    times?: number | undefined
    delay?: DelayFn | undefined
  } | undefined
): Micro<A, E, R> =>
  repeatResult(self, {
    ...options,
    while: (result) => result._tag === "Right" && (options?.while === undefined || options.while(result.right))
  }))

/**
 * Repeat the given `Micro` effect forever, only stopping if the effect fails.
 *
 * @since 3.3.0
 * @category repetition
 */
export const forever = <A, E, R>(self: Micro<A, E, R>): Micro<never, E, R> => repeat(self) as any

// ----------------------------------------------------------------------------
// delays
// ----------------------------------------------------------------------------

/**
 * Represents a function that can be used to calculate the delay between
 * repeats.
 *
 * The function takes the current attempt number and the elapsed time since
 * the first attempt, and returns the delay for the next attempt. If the
 * function returns `None`, the repetition will stop.
 *
 * @since 3.3.0
 * @category delays
 */
export type DelayFn = (attempt: number, elapsed: number) => Option.Option<number>

/**
 * Create a `DelayFn` that will generate a duration with an exponential backoff.
 *
 * @since 3.3.0
 * @category delays
 */
export const delayExponential = (baseMillis: number, factor = 2): DelayFn => (attempt) =>
  Option.some(attempt ** factor * baseMillis)

/**
 * Create a `DelayFn` that will generate a duration with fixed intervals.
 *
 * @since 3.3.0
 * @category delays
 */
export const delaySpaced = (millis: number): DelayFn => (_) => Option.some(millis)

/**
 * Transform a `DelayFn` to one that will have a duration that will never exceed
 * the specified maximum.
 *
 * @since 3.3.0
 * @category delays
 */
export const delayWithMax: {
  (max: number): (self: DelayFn) => DelayFn
  (self: DelayFn, max: number): DelayFn
} = dual(
  2,
  (self: DelayFn, max: number): DelayFn => (attempt, elapsed) =>
    Option.map(self(attempt, elapsed), (duration) => Math.min(duration, max))
)

/**
 * Transform a `DelayFn` to one that will stop repeating after the specified
 * amount of time.
 *
 * @since 3.3.0
 * @category delays
 */
export const delayWithMaxElapsed: {
  (max: number): (self: DelayFn) => DelayFn
  (self: DelayFn, max: number): DelayFn
} = dual(
  2,
  (self: DelayFn, max: number): DelayFn => (attempt, elapsed) => elapsed < max ? self(attempt, elapsed) : Option.none()
)

/**
 * Transform a `DelayFn` to one that will stop repeating after the specified
 * number of attempts.
 *
 * @since 3.3.0
 * @category delays
 */
export const delayWithRecurs: {
  (n: number): (self: DelayFn) => DelayFn
  (self: DelayFn, n: number): DelayFn
} = dual(
  2,
  (self: DelayFn, n: number): DelayFn => (attempt, elapsed) => Option.filter(self(attempt, elapsed), () => attempt <= n)
)

// ----------------------------------------------------------------------------
// error handling
// ----------------------------------------------------------------------------

/**
 * Catch the full `Failure` object of the given `Micro` effect, allowing you to
 * recover from any error.
 *
 * @since 3.3.0
 * @category error handling
 */
export const catchFailure: {
  <E, B, E2, R2>(
    f: (failure: NoInfer<Failure<E>>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Micro<A, E, R>,
    f: (failure: NoInfer<Failure<E>>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Micro<A, E, R>,
    f: (failure: NoInfer<Failure<E>>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2> =>
    make(function(env, onResult) {
      self[runSymbol](env, function(result) {
        if (result._tag === "Right") {
          return onResult(result as any)
        }
        f(result.left)[runSymbol](env, onResult)
      })
    })
)

/**
 * Catch the error of the given `Micro` effect, allowing you to recover from it.
 *
 * It only catches expected (`FailureExpected`) errors.
 *
 * @since 3.3.0
 * @category error handling
 */
export const catchExpected: {
  <E, B, E2, R2>(
    f: (e: NoInfer<E>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (e: NoInfer<E>) => Micro<B, E2, R2>): Micro<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Micro<A, E, R>,
    f: (a: NoInfer<E>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2> =>
    catchFailure(self, (failure) => failure._tag === "Expected" ? f(failure.error) : failWith(failure))
)

/**
 * Catch any unexpected errors of the given `Micro` effect, allowing you to recover from them.
 *
 * @since 3.3.0
 * @category error handling
 */
export const catchUnexpected: {
  <E, B, E2, R2>(
    f: (defect: unknown) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (defect: unknown) => Micro<B, E2, R2>): Micro<A | B, E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(
    self: Micro<A, E, R>,
    f: (a: NoInfer<E>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2> =>
    catchFailure(self, (failure) => failure._tag === "Expected" ? f(failure.error) : failWith(failure))
)

/**
 * Perform a side effect using the full `Failure` object of the given `Micro`.
 *
 * @since 3.3.0
 * @category error handling
 */
export const tapFailure: {
  <E, B, E2, R2>(
    f: (a: NoInfer<Failure<E>>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: NoInfer<Failure<E>>) => Micro<B, E2, R2>): Micro<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: NoInfer<E>) => Micro<B, E2, R2>): Micro<A, E | E2, R | R2> =>
    catchFailure(self, (failure) => andThen(f(failure as any), failWith(failure)))
)

/**
 * Perform a side effect from expected errors of the given `Micro`.
 *
 * @since 3.3.0
 * @category error handling
 */
export const tapError: {
  <E, B, E2, R2>(
    f: (a: NoInfer<E>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A, E | E2, R | R2>
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: NoInfer<E>) => Micro<B, E2, R2>): Micro<A, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, B, E2, R2>(self: Micro<A, E, R>, f: (a: NoInfer<E>) => Micro<B, E2, R2>): Micro<A, E | E2, R | R2> =>
    tapFailure(self, (failure) => failure._tag === "Expected" ? f(failure.error) : failWith(failure))
)

/**
 * Catch any expected errors that match the specified predicate.
 *
 * @since 3.3.0
 * @category error handling
 */
export const catchIf: {
  <E, EB extends E, B, E2, R2>(
    pred: Refinement<E, EB>,
    f: (a: NoInfer<EB>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A | B, E2, R | R2>
  <E, B, E2, R2>(
    pred: Predicate<NoInfer<E>>,
    f: (a: NoInfer<E>) => Micro<B, E2, R2>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A | B, E2, R | R2>
  <A, E, R, EB extends E, B, E2, R2>(
    self: Micro<A, E, R>,
    pred: Refinement<E, EB>,
    f: (a: NoInfer<EB>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2>
  <A, E, R, B, E2, R2>(
    self: Micro<A, E, R>,
    pred: Predicate<NoInfer<E>>,
    f: (a: NoInfer<E>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2>
} = dual(
  3,
  <A, E, R, EB extends E, B, E2, R2>(
    self: Micro<A, E, R>,
    pred: Refinement<E, EB>,
    f: (a: NoInfer<EB>) => Micro<B, E2, R2>
  ): Micro<A | B, E2, R | R2> => catchExpected(self, (error) => pred(error) ? f(error) : fail(error) as any)
)

/**
 * Recovers from the specified tagged error.
 *
 * @since 3.3.0
 * @category error handling
 */
export const catchTag: {
  <K extends E extends { _tag: string } ? E["_tag"] : never, E, A1, E1, R1>(
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Micro<A1, E1, R1>
  ): <A, R>(self: Micro<A, E, R>) => Micro<A1 | A, E1 | Exclude<E, { _tag: K }>, R1 | R>
  <A, E, R, K extends E extends { _tag: string } ? E["_tag"] : never, R1, E1, A1>(
    self: Micro<A, E, R>,
    k: K,
    f: (e: Extract<E, { _tag: K }>) => Micro<A1, E1, R1>
  ): Micro<A | A1, E1 | Exclude<E, { _tag: K }>, R | R1>
} = dual(3, <A, E, R, K extends E extends { _tag: string } ? E["_tag"] : never, R1, E1, A1>(
  self: Micro<A, E, R>,
  k: K,
  f: (e: Extract<E, { _tag: K }>) => Micro<A1, E1, R1>
): Micro<A | A1, E1 | Exclude<E, { _tag: K }>, R | R1> => catchIf(self, (error) => isTagged(error, k), f as any))

/**
 * Transform the full `Failure` object of the given `Micro` effect.
 *
 * @since 3.3.0
 * @category error handling
 */
export const mapFailure: {
  <E, E2>(f: (a: NoInfer<Failure<E>>) => Failure<E2>): <A, R>(self: Micro<A, E, R>) => Micro<A, E2, R>
  <A, E, R, E2>(self: Micro<A, E, R>, f: (a: NoInfer<Failure<E>>) => Failure<E2>): Micro<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(self: Micro<A, E, R>, f: (a: NoInfer<Failure<E>>) => Failure<E2>): Micro<A, E2, R> =>
    catchFailure(self, (failure) => failWith(f(failure)))
)

/**
 * Transform any expected errors of the given `Micro` effect.
 *
 * @since 3.3.0
 * @category error handling
 */
export const mapError: {
  <E, E2>(f: (a: NoInfer<E>) => E2): <A, R>(self: Micro<A, E, R>) => Micro<A, E2, R>
  <A, E, R, E2>(self: Micro<A, E, R>, f: (a: NoInfer<E>) => E2): Micro<A, E2, R>
} = dual(
  2,
  <A, E, R, E2>(self: Micro<A, E, R>, f: (a: NoInfer<E>) => E2): Micro<A, E2, R> =>
    catchExpected(self, (error) => fail(f(error)))
)

/**
 * Elevate any expected errors of the given `Micro` effect to unexpected errors,
 * resulting in an error type of `never`.
 *
 * @since 3.3.0
 * @category error handling
 */
export const orDie = <A, E, R>(self: Micro<A, E, R>): Micro<A, never, R> => catchExpected(self, die)

/**
 * Recover from all errors by succeeding with the given value.
 *
 * @since 3.3.0
 * @category error handling
 */
export const orElseSucceed: {
  <B>(f: LazyArg<B>): <A, E, R>(self: Micro<A, E, R>) => Micro<A | B, never, R>
  <A, E, R, B>(self: Micro<A, E, R>, f: LazyArg<B>): Micro<A | B, never, R>
} = dual(
  2,
  <A, E, R, B>(self: Micro<A, E, R>, f: LazyArg<B>): Micro<A | B, never, R> => catchExpected(self, (_) => sync(f))
)

/**
 * Ignore any expected errors of the given `Micro` effect, returning `void`.
 *
 * @since 3.3.0
 * @category error handling
 */
export const ignore = <A, E, R>(self: Micro<A, E, R>): Micro<void, never, R> =>
  matchMicro(self, { onFailure: die, onSuccess: () => void_ })

/**
 * Replace the success value of the given `Micro` effect with an `Option`,
 * wrapping the success value in `Some` and returning `None` if the effect fails
 * with an expected error.
 *
 * @since 3.3.0
 * @category error handling
 */
export const option = <A, E, R>(self: Micro<A, E, R>): Micro<Option.Option<A>, never, R> =>
  match(self, { onFailure: () => Option.none(), onSuccess: Option.some })

/**
 * Replace the success value of the given `Micro` effect with an `Either`,
 * wrapping the success value in `Right` and wrapping any expected errors with
 * a `Left`.
 *
 * @since 3.3.0
 * @category error handling
 */
export const either = <A, E, R>(self: Micro<A, E, R>): Micro<Either.Either<A, E>, never, R> =>
  match(self, { onFailure: Either.left, onSuccess: Either.right })

/**
 * Retry the given `Micro` effect using the provided options.
 *
 * @since 3.3.0
 * @category error handling
 */
export const retry: {
  <A, E>(
    options?: {
      while?: Predicate<E> | undefined
      times?: number | undefined
      delay?: DelayFn | undefined
    } | undefined
  ): <R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(
    self: Micro<A, E, R>,
    options?: {
      while?: Predicate<E> | undefined
      times?: number | undefined
      delay?: DelayFn | undefined
    } | undefined
  ): Micro<A, E, R>
} = dual((args) => isMicro(args[0]), <A, E, R>(
  self: Micro<A, E, R>,
  options?: {
    while?: Predicate<E> | undefined
    times?: number | undefined
    delay?: DelayFn | undefined
  } | undefined
): Micro<A, E, R> =>
  repeatResult(self, {
    ...options,
    while: (result) =>
      result._tag === "Left" && result.left._tag === "Expected" &&
      (options?.while === undefined || options.while(result.left.error))
  }))

/**
 * Add a stack trace to any failures that occur in the effect. The trace will be
 * added to the `traces` field of the `Failure` object.
 *
 * @since 3.3.0
 * @category error handling
 */
export const withTrace: {
  (name: string): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(self: Micro<A, E, R>, name: string): Micro<A, E, R>
} = function() {
  const prevLimit = globalThis.Error.stackTraceLimit
  globalThis.Error.stackTraceLimit = 2
  const error = new globalThis.Error()
  globalThis.Error.stackTraceLimit = prevLimit
  function generate(name: string, failure: Failure<any>) {
    const stack = error.stack
    if (!stack) {
      return failure
    }
    const line = stack.split("\n")[2]?.trim().replace(/^at /, "")
    if (!line) {
      return failure
    }
    const lineMatch = line.match(/\((.*)\)$/)
    return failureWithTrace(failure, `at ${name} (${lineMatch ? lineMatch[1] : line})`)
  }
  const f = (name: string) => (self: Micro<any, any, any>) =>
    unsafeMakeNoAbort(function(env, onResult) {
      self[runSymbol](env, function(result) {
        onResult(result._tag === "Left" ? Either.left(generate(name, result.left)) : result)
      })
    })
  if (arguments.length === 2) {
    return f(arguments[1])(arguments[0])
  }
  return f(arguments[0])
} as any

// ----------------------------------------------------------------------------
// pattern matching
// ----------------------------------------------------------------------------

/**
 * @since 3.3.0
 * @category pattern matching
 */
export const matchFailureMicro: {
  <E, A2, E2, R2, A, A3, E3, R3>(
    options: {
      readonly onFailure: (failure: Failure<E>) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): <R>(self: Micro<A, E, R>) => Micro<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (failure: Failure<E>) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): Micro<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (failure: Failure<E>) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): Micro<A2 | A3, E2 | E3, R2 | R3 | R> =>
    make(function(env, onResult) {
      self[runSymbol](env, function(result) {
        try {
          const next = result._tag === "Left" ? options.onFailure(result.left) : options.onSuccess(result.right)
          next[runSymbol](env, onResult)
        } catch (err) {
          onResult(ResultFailUnexpected(err))
        }
      })
    })
)

/**
 * @since 3.3.0
 * @category pattern matching
 */
export const matchMicro: {
  <E, A2, E2, R2, A, A3, E3, R3>(
    options: {
      readonly onFailure: (e: E) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): <R>(self: Micro<A, E, R>) => Micro<A2 | A3, E2 | E3, R2 | R3 | R>
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): Micro<A2 | A3, E2 | E3, R2 | R3 | R>
} = dual(
  2,
  <A, E, R, A2, E2, R2, A3, E3, R3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (e: E) => Micro<A2, E2, R2>
      readonly onSuccess: (a: A) => Micro<A3, E3, R3>
    }
  ): Micro<A2 | A3, E2 | E3, R2 | R3 | R> =>
    matchFailureMicro(self, {
      onFailure: (failure) => failure._tag === "Expected" ? options.onFailure(failure.error) : failWith(failure),
      onSuccess: options.onSuccess
    })
)

/**
 * @since 3.3.0
 * @category pattern matching
 */
export const match: {
  <E, A2, A, A3>(
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): <R>(self: Micro<A, E, R>) => Micro<A2 | A3, never, R>
  <A, E, R, A2, A3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Micro<A2 | A3, never, R>
} = dual(
  2,
  <A, E, R, A2, A3>(
    self: Micro<A, E, R>,
    options: {
      readonly onFailure: (error: E) => A2
      readonly onSuccess: (value: A) => A3
    }
  ): Micro<A2 | A3, never, R> =>
    matchMicro(self, {
      onFailure: (error) => sync(() => options.onFailure(error)),
      onSuccess: (value) => sync(() => options.onSuccess(value))
    })
)

// ----------------------------------------------------------------------------
// delays & timeouts
// ----------------------------------------------------------------------------

/**
 * Create a `Micro` effect that will sleep for the specified duration.
 *
 * @since 3.3.0
 * @category delays & timeouts
 */
export const sleep = (millis: number): Micro<void> =>
  async(function(resume) {
    const timeout = setTimeout(function() {
      resume(void_)
    }, millis)
    return sync(() => {
      return clearTimeout(timeout)
    })
  })

/**
 * Returns an effect that will delay the execution of this effect by the
 * specified duration.
 *
 * @since 3.3.0
 * @category delays & timeouts
 */
export const delay: {
  (millis: number): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E, R>
  <A, E, R>(self: Micro<A, E, R>, millis: number): Micro<A, E, R>
} = dual(
  2,
  <A, E, R>(self: Micro<A, E, R>, millis: number): Micro<A, E, R> => andThen(sleep(millis), self)
)

/**
 * Returns an effect that will timeout this effect, that will execute the
 * fallback effect if the timeout elapses before the effect has produced a value.
 *
 * If the timeout elapses, the running effect will be safely interrupted.
 *
 * @since 3.3.0
 * @category delays & timeouts
 */
export const timeoutOrElse: {
  <A2, E2, R2>(options: {
    readonly duration: number
    readonly onTimeout: LazyArg<Micro<A2, E2, R2>>
  }): <A, E, R>(self: Micro<A, E, R>) => Micro<A | A2, E | E2, R | R2>
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, options: {
    readonly duration: number
    readonly onTimeout: LazyArg<Micro<A2, E2, R2>>
  }): Micro<A | A2, E | E2, R | R2>
} = dual(
  2,
  <A, E, R, A2, E2, R2>(self: Micro<A, E, R>, options: {
    readonly duration: number
    readonly onTimeout: LazyArg<Micro<A2, E2, R2>>
  }): Micro<A | A2, E | E2, R | R2> =>
    raceFirst(self, andThen(interruptible(sleep(options.duration)), options.onTimeout))
)

/**
 * Returns an effect that will timeout this effect, succeeding with a `None`
 * if the timeout elapses before the effect has produced a value; and `Some` of
 * the produced value otherwise.
 *
 * If the timeout elapses, the running effect will be safely interrupted.
 *
 * @since 3.3.0
 * @category delays & timeouts
 */
export const timeout: {
  (millis: number): <A, E, R>(self: Micro<A, E, R>) => Micro<Option.Option<A>, E, R>
  <A, E, R>(self: Micro<A, E, R>, millis: number): Micro<Option.Option<A>, E, R>
} = dual(
  2,
  <A, E, R>(self: Micro<A, E, R>, millis: number): Micro<Option.Option<A>, E, R> =>
    raceFirst(
      asSome(self),
      as(interruptible(sleep(millis)), Option.none())
    )
)

// ----------------------------------------------------------------------------
// resources & finalization
// ----------------------------------------------------------------------------

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export const MicroScopeTypeId: unique symbol = Symbol.for("effect/Micro/MicroScope")

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export type MicroScopeTypeId = typeof MicroScopeTypeId

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export interface MicroScope {
  readonly [MicroScopeTypeId]: MicroScopeTypeId
  readonly addFinalizer: (finalizer: (result: Result<unknown, unknown>) => Micro<void>) => Micro<void>
  readonly fork: Micro<MicroScope.Closeable>
}

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export declare namespace MicroScope {
  /**
   * @since 3.3.0
   * @category resources & finalization
   */
  export interface Closeable extends MicroScope {
    readonly close: (result: Result<any, any>) => Micro<void>
  }
}

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export const MicroScope: Context.Tag<MicroScope, MicroScope> = Context.GenericTag<MicroScope>("effect/Micro/MicroScope")

class ScopeImpl implements MicroScope.Closeable {
  readonly [MicroScopeTypeId]: MicroScopeTypeId
  state: {
    readonly _tag: "Open"
    readonly finalizers: Set<(result: Result<any, any>) => Micro<void>>
  } | {
    readonly _tag: "Closed"
    readonly result: Result<any, any>
  } = { _tag: "Open", finalizers: new Set() }

  constructor() {
    this[MicroScopeTypeId] = MicroScopeTypeId
  }

  unsafeAddFinalizer(finalizer: (result: Result<any, any>) => Micro<void>): void {
    if (this.state._tag === "Open") {
      this.state.finalizers.add(finalizer)
    }
  }
  addFinalizer(finalizer: (result: Result<any, any>) => Micro<void>): Micro<void> {
    return suspend(() => {
      if (this.state._tag === "Open") {
        this.state.finalizers.add(finalizer)
        return void_
      }
      return finalizer(this.state.result)
    })
  }
  unsafeRemoveFinalizer(finalizer: (result: Result<any, any>) => Micro<void>): void {
    if (this.state._tag === "Open") {
      this.state.finalizers.delete(finalizer)
    }
  }
  close(result: Result<any, any>): Micro<void> {
    return suspend(() => {
      if (this.state._tag === "Open") {
        const finalizers = Array.from(this.state.finalizers).reverse()
        this.state = { _tag: "Closed", result }
        return flatMap(
          forEach(finalizers, (finalizer) => asResult(finalizer(result))),
          (results) => asVoid(fromResult(Either.all(results)))
        )
      }
      return void_
    })
  }
  get fork() {
    return sync(() => {
      const newScope = new ScopeImpl()
      if (this.state._tag === "Closed") {
        newScope.state = this.state
        return newScope
      }
      function fin(result: Result<any, any>) {
        return newScope.close(result)
      }
      this.state.finalizers.add(fin)
      newScope.unsafeAddFinalizer((_) => sync(() => this.unsafeRemoveFinalizer(fin)))
      return newScope
    })
  }
}

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export const scopeMake = (): Micro<MicroScope.Closeable> => sync(() => new ScopeImpl())

/**
 * @since 3.3.0
 * @category resources & finalization
 */
export const scopeUnsafeMake = (): MicroScope.Closeable => new ScopeImpl()

/**
 * Access the current `MicroScope`.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const scope: Micro<MicroScope, never, MicroScope> = service(MicroScope)

/**
 * Provide a `MicroScope` to the given effect, closing it after the effect has
 * finished executing.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const scoped = <A, E, R>(self: Micro<A, E, R>): Micro<A, E, Exclude<R, MicroScope>> =>
  suspend(function() {
    const scope = new ScopeImpl()
    return onResult(provideService(self, MicroScope, scope), (result) => scope.close(result))
  })

/**
 * Create a resource with a cleanup `Micro` effect, ensuring the cleanup is
 * executed when the `MicroScope` is closed.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const acquireRelease = <A, E, R>(
  acquire: Micro<A, E, R>,
  release: (a: A, result: Result<unknown, unknown>) => Micro<void>
): Micro<A, E, R | MicroScope> =>
  uninterruptible(flatMap(
    scope,
    (scope) => tap(acquire, (a) => scope.addFinalizer((result) => release(a, result)))
  ))

/**
 * Add a finalizer to the current `MicroScope`.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const addFinalizer = (
  finalizer: (result: Result<unknown, unknown>) => Micro<void>
): Micro<void, never, MicroScope> => flatMap(scope, (scope) => scope.addFinalizer(finalizer))

/**
 * When the `Micro` effect is completed, run the given finalizer effect with the
 * `Result` of the executed effect.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const onResult: {
  <A, E, XE, XR>(
    f: (result: Result<A, E>) => Micro<void, XE, XR>
  ): <R>(self: Micro<A, E, R>) => Micro<A, E | XE, R | XR>
  <A, E, R, XE, XR>(self: Micro<A, E, R>, f: (result: Result<A, E>) => Micro<void, XE, XR>): Micro<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(self: Micro<A, E, R>, f: (result: Result<A, E>) => Micro<void, XE, XR>): Micro<A, E | XE, R | XR> =>
    uninterruptibleMask((restore) =>
      make(function(env, onResult) {
        restore(self)[runSymbol](env, function(result) {
          f(result)[runSymbol](env, function(finalizerResult) {
            if (finalizerResult._tag === "Left") {
              return onResult(finalizerResult as any)
            }
            onResult(result)
          })
        })
      })
    )
)

/**
 * Regardless of the result of the this `Micro` effect, run the finalizer effect.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const ensuring: {
  <XE, XR>(
    finalizer: Micro<void, XE, XR>
  ): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E | XE, R | XR>
  <A, E, R, XE, XR>(self: Micro<A, E, R>, finalizer: Micro<void, XE, XR>): Micro<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(self: Micro<A, E, R>, finalizer: Micro<void, XE, XR>): Micro<A, E | XE, R | XR> =>
    onResult(self, (_) => finalizer)
)

/**
 * If this `Micro` effect is interrupted, run the finalizer effect.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const onInterrupt: {
  <XE, XR>(
    finalizer: Micro<void, XE, XR>
  ): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E | XE, R | XR>
  <A, E, R, XE, XR>(self: Micro<A, E, R>, finalizer: Micro<void, XE, XR>): Micro<A, E | XE, R | XR>
} = dual(
  2,
  <A, E, R, XE, XR>(self: Micro<A, E, R>, finalizer: Micro<void, XE, XR>): Micro<A, E | XE, R | XR> =>
    onResult(self, (result) => (result._tag === "Left" && result.left._tag === "Aborted" ? finalizer : void_))
)

/**
 * Acquire a resource, use it, and then release the resource when the `use`
 * effect has completed.
 *
 * @since 3.3.0
 * @category resources & finalization
 */
export const acquireUseRelease = <Resource, E, R, A, E2, R2, E3, R3>(
  acquire: Micro<Resource, E, R>,
  use: (a: Resource) => Micro<A, E2, R2>,
  release: (a: Resource, result: Result<A, E2>) => Micro<void, E3, R3>
): Micro<A, E | E2 | E3, R | R2 | R3> =>
  uninterruptibleMask((restore) =>
    flatMap(
      acquire,
      (a) =>
        flatMap(
          asResult(restore(use(a))),
          (result) => andThen(release(a, result), fromResult(result))
        )
    )
  )

// ----------------------------------------------------------------------------
// environment
// ----------------------------------------------------------------------------

/**
 * Retrieve the current value of the given `EnvRef`.
 *
 * @since 3.3.0
 * @category environment
 */
export const getEnvRef = <A>(envRef: EnvRef<A>): Micro<A> =>
  make((env, onResult) => onResult(Either.right(envGet(env, envRef))))

/**
 * Set the value of the given `EnvRef` for the duration of the effect.
 *
 * @since 3.3.0
 * @category environment
 */
export const locally: {
  <A>(fiberRef: EnvRef<A>, value: A): <XA, E, R>(self: Micro<XA, E, R>) => Micro<XA, E, R>
  <XA, E, R, A>(self: Micro<XA, E, R>, fiberRef: EnvRef<A>, value: A): Micro<XA, E, R>
} = dual(
  3,
  <XA, E, R, A>(self: Micro<XA, E, R>, fiberRef: EnvRef<A>, value: A): Micro<XA, E, R> =>
    make((env, onResult) => self[runSymbol](envSet(env, fiberRef, value), onResult))
)

/**
 * Access the current `Context` from the environment.
 *
 * @since 3.3.0
 * @category environment
 */
export const context = <R>(): Micro<Context.Context<R>> => getEnvRef(currentContext) as any

/**
 * Merge the given `Context` with the current context.
 *
 * @since 3.3.0
 * @category environment
 */
export const provideContext: {
  <XR>(context: Context.Context<XR>): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E, Exclude<R, XR>>
  <A, E, R, XR>(self: Micro<A, E, R>, context: Context.Context<XR>): Micro<A, E, Exclude<R, XR>>
} = dual(
  2,
  <A, E, R, XR>(self: Micro<A, E, R>, provided: Context.Context<XR>): Micro<A, E, Exclude<R, XR>> =>
    make(function(env, onResult) {
      const context = envGet(env, currentContext)
      const nextEnv = envSet(env, currentContext, Context.merge(context, provided))
      self[runSymbol](nextEnv, onResult)
    })
)

/**
 * Add the provided service to the current context.
 *
 * @since 3.3.0
 * @category environment
 */
export const provideService: {
  <I, S>(tag: Context.Tag<I, S>, service: S): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E, Exclude<R, I>>
  <A, E, R, I, S>(self: Micro<A, E, R>, tag: Context.Tag<I, S>, service: S): Micro<A, E, Exclude<R, I>>
} = dual(
  3,
  <A, E, R, I, S>(self: Micro<A, E, R>, tag: Context.Tag<I, S>, service: S): Micro<A, E, Exclude<R, I>> =>
    make(function(env, onResult) {
      const context = envGet(env, currentContext)
      const nextEnv = envSet(env, currentContext, Context.add(context, tag, service))
      self[runSymbol](nextEnv, onResult)
    })
)

/**
 * Create a service using the provided `Micro` effect, and add it to the
 * current context.
 *
 * @since 3.3.0
 * @category environment
 */
export const provideServiceMicro: {
  <I, S, E2, R2>(
    tag: Context.Tag<I, S>,
    acquire: Micro<S, E2, R2>
  ): <A, E, R>(self: Micro<A, E, R>) => Micro<A, E | E2, Exclude<R, I> | R2>
  <A, E, R, I, S, E2, R2>(
    self: Micro<A, E, R>,
    tag: Context.Tag<I, S>,
    acquire: Micro<S, E2, R2>
  ): Micro<A, E | E2, Exclude<R, I> | R2>
} = dual(
  3,
  <A, E, R, I, S, E2, R2>(
    self: Micro<A, E, R>,
    tag: Context.Tag<I, S>,
    acquire: Micro<S, E2, R2>
  ): Micro<A, E | E2, Exclude<R, I> | R2> => flatMap(acquire, (service) => provideService(self, tag, service))
)

// ----------------------------------------------------------------------------
// interruption
// ----------------------------------------------------------------------------

/**
 * Wrap the given `Micro` effect in an uninterruptible region, preventing the
 * effect from being interrupted.
 *
 * @since 3.3.0
 * @category interruption
 */
export const uninterruptible = <A, E, R>(self: Micro<A, E, R>): Micro<A, E, R> =>
  unsafeMakeNoAbort(function(env, onResult) {
    const nextEnv = envMutate(env, function(env) {
      env[currentInterruptible.key] = false
      env[currentAbortSignal.key] = new AbortController().signal
      return env
    })
    self[runSymbol](nextEnv, onResult)
  })

/**
 * Wrap the given `Micro` effect in an uninterruptible region, preventing the
 * effect from being interrupted.
 *
 * You can use the `restore` function to restore a `Micro` effect to the
 * interruptibility state that was present before the `uninterruptibleMask` was
 * applied.
 *
 * @since 3.3.0
 * @category interruption
 * @example
 * import * as Micro from "effect/Micro"
 *
 * Micro.uninterruptibleMask((restore) =>
 *   Micro.sleep(1000).pipe( // uninterruptible
 *     Micro.andThen(restore(Micro.sleep(1000))) // interruptible
 *   )
 * )
 */
export const uninterruptibleMask = <A, E, R>(
  f: (restore: <A, E, R>(effect: Micro<A, E, R>) => Micro<A, E, R>) => Micro<A, E, R>
): Micro<A, E, R> =>
  unsafeMakeNoAbort((env, onResult) => {
    const isInterruptible = envGet(env, currentInterruptible)
    const effect = isInterruptible ? f(interruptible) : f(identity)
    const nextEnv = isInterruptible ?
      envMutate(env, function(env) {
        env[currentInterruptible.key] = false
        env[currentAbortSignal.key] = new AbortController().signal
        return env
      }) :
      env
    effect[runSymbol](nextEnv, onResult)
  })

/**
 * Wrap the given `Micro` effect in an interruptible region, allowing the effect
 * to be interrupted.
 *
 * @since 3.3.0
 * @category interruption
 */
export const interruptible = <A, E, R>(self: Micro<A, E, R>): Micro<A, E, R> =>
  make((env, onResult) => {
    const isInterruptible = envGet(env, currentInterruptible)
    let newEnv = env
    if (!isInterruptible) {
      const controller = envGet(env, currentAbortController)
      newEnv = envMutate(env, function(env) {
        env[currentInterruptible.key] = true
        env[currentAbortSignal.key] = controller.signal
        return env
      })
    }
    self[runSymbol](newEnv, onResult)
  })

// ========================================================================
// collecting & elements
// ========================================================================

/**
 * @since 3.3.0
 */
export declare namespace All {
  /**
   * @since 3.3.0
   */
  export type MicroAny = Micro<any, any, any>

  /**
   * @since 3.3.0
   */
  export type ReturnIterable<T extends Iterable<MicroAny>, Discard extends boolean> = [T] extends
    [Iterable<Micro<infer A, infer E, infer R>>] ? Micro<
      Discard extends true ? void : Array<A>,
      E,
      R
    >
    : never

  /**
   * @since 3.3.0
   */
  export type ReturnTuple<T extends ReadonlyArray<unknown>, Discard extends boolean> = Micro<
    Discard extends true ? void
      : T[number] extends never ? []
      : { -readonly [K in keyof T]: T[K] extends Micro<infer _A, infer _E, infer _R> ? _A : never },
    T[number] extends never ? never
      : T[number] extends Micro<infer _A, infer _E, infer _R> ? _E
      : never,
    T[number] extends never ? never
      : T[number] extends Micro<infer _A, infer _E, infer _R> ? _R
      : never
  > extends infer X ? X : never

  /**
   * @since 3.3.0
   */
  export type ReturnObject<T, Discard extends boolean> = [T] extends [{ [K: string]: MicroAny }] ? Micro<
      Discard extends true ? void :
        { -readonly [K in keyof T]: [T[K]] extends [Micro<infer _A, infer _E, infer _R>] ? _A : never },
      keyof T extends never ? never
        : T[keyof T] extends Micro<infer _A, infer _E, infer _R> ? _E
        : never,
      keyof T extends never ? never
        : T[keyof T] extends Micro<infer _A, infer _E, infer _R> ? _R
        : never
    >
    : never

  /**
   * @since 3.3.0
   */
  export type IsDiscard<A> = [Extract<A, { readonly discard: true }>] extends [never] ? false : true

  /**
   * @since 3.3.0
   */
  export type Return<
    Arg extends Iterable<MicroAny> | Record<string, MicroAny>,
    O extends {
      readonly concurrency?: Concurrency | undefined
      readonly discard?: boolean | undefined
    }
  > = [Arg] extends [ReadonlyArray<MicroAny>] ? ReturnTuple<Arg, IsDiscard<O>>
    : [Arg] extends [Iterable<MicroAny>] ? ReturnIterable<Arg, IsDiscard<O>>
    : [Arg] extends [Record<string, MicroAny>] ? ReturnObject<Arg, IsDiscard<O>>
    : never
}

/**
 * Runs all the provided effects in sequence respecting the structure provided in input.
 *
 * Supports multiple arguments, a single argument tuple / array or record / struct.
 *
 * @since 3.3.0
 * @category collecting & elements
 */
export const all = <
  const Arg extends Iterable<Micro<any, any, any>> | Record<string, Micro<any, any, any>>,
  O extends {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: boolean | undefined
  }
>(arg: Arg, options?: O): All.Return<Arg, O> => {
  if (Array.isArray(arg) || isIterable(arg)) {
    return (forEach as any)(arg, identity, options)
  } else if (options?.discard) {
    return (forEach as any)(Object.values(arg), identity, options)
  }
  return suspend(() => {
    const out: Record<string, unknown> = {}
    return as(
      forEach(Object.entries(arg), ([key, effect]) =>
        map(effect, (value) => {
          out[key] = value
        }), {
        discard: true,
        concurrency: options?.concurrency
      }),
      out
    )
  }) as any
}

/**
 * For each element of the provided iterable, run the effect and collect the results.
 *
 * If the `discard` option is set to `true`, the results will be discarded and
 * the effect will return `void`.
 *
 * The `concurrency` option can be set to control how many effects are run in
 * parallel. By default, the effects are run sequentially.
 *
 * @since 3.3.0
 * @category collecting & elements
 */
export const forEach: {
  <A, B, E, R>(iterable: Iterable<A>, f: (a: NoInfer<A>, index: number) => Micro<B, E, R>, options?: {
    readonly concurrency?: Concurrency | undefined
    readonly discard?: false | undefined
  }): Micro<Array<B>, E, R>
  <A, B, E, R>(iterable: Iterable<A>, f: (a: NoInfer<A>, index: number) => Micro<B, E, R>, options: {
    readonly concurrency?: Concurrency | undefined
    readonly discard: true
  }): Micro<void, E, R>
} = <
  A,
  B,
  E,
  R
>(iterable: Iterable<A>, f: (a: NoInfer<A>, index: number) => Micro<B, E, R>, options?: {
  readonly concurrency?: Concurrency | undefined
  readonly discard?: boolean | undefined
}): Micro<any, E, R> =>
  make(function(env, onResult) {
    const concurrency = options?.concurrency === "inherit"
      ? envGet(env, currentConcurrency)
      : options?.concurrency ?? 1
    if (concurrency === "unbounded" || concurrency > 1) {
      forEachConcurrent(iterable, f, {
        discard: options?.discard,
        concurrency
      })[runSymbol](
        env,
        onResult
      )
    } else {
      forEachSequential(iterable, f, options)[runSymbol](env, onResult)
    }
  })

const forEachSequential = <
  A,
  B,
  E,
  R
>(iterable: Iterable<A>, f: (a: NoInfer<A>, index: number) => Micro<B, E, R>, options?: {
  readonly discard?: boolean | undefined
}): Micro<any, E, R> =>
  make(function(env, onResult) {
    const items = Array.from(iterable)
    const length = items.length
    const out: Array<B> | undefined = options?.discard ? undefined : new Array(length)
    let index = 0
    let running = false
    function tick(): void {
      running = true
      while (index < length) {
        let complete = false
        const current = index++
        try {
          f(items[current], current)[runSymbol](env, function(result) {
            complete = true
            if (result._tag === "Left") {
              index = length
              onResult(result)
            } else if (out !== undefined) {
              out[current] = result.right
            }
            if (current === length - 1) {
              onResult(Either.right(out))
            } else if (!running) {
              tick()
            }
          })
        } catch (err) {
          onResult(ResultFailUnexpected(err))
          break
        }
        if (!complete) {
          break
        }
      }
      running = false
    }
    tick()
  })

const forEachConcurrent = <
  A,
  B,
  E,
  R
>(iterable: Iterable<A>, f: (a: NoInfer<A>, index: number) => Micro<B, E, R>, options: {
  readonly concurrency: number | "unbounded"
  readonly discard?: boolean | undefined
}): Micro<any, E, R> =>
  unsafeMake(function(env, onResult) {
    // abort
    const [envWithSignal, onAbort] = forkSignal(env)
    function onDone() {
      length = index
      onAbort()
    }

    // iterate
    const concurrency = options.concurrency === "unbounded" ? Infinity : options.concurrency
    let failure: Result<any, any> | undefined = undefined
    const items = Array.from(iterable)
    let length = items.length
    const out: Array<B> | undefined = options?.discard ? undefined : new Array(length)
    let index = 0
    let inProgress = 0
    let doneCount = 0
    let pumping = false
    function pump() {
      pumping = true
      while (inProgress < concurrency && index < length) {
        const currentIndex = index
        const item = items[currentIndex]
        index++
        inProgress++
        try {
          f(item, currentIndex)[runSymbol](envWithSignal, function(result) {
            if (result._tag === "Left") {
              if (failure === undefined) {
                failure = result
                onDone()
              }
            } else if (out !== undefined) {
              out[currentIndex] = result.right
            }
            doneCount++
            inProgress--
            if (doneCount === length) {
              onAbort()
              onResult(failure ?? Either.right(out))
            } else if (!pumping && inProgress < concurrency) {
              pump()
            }
          })
        } catch (err) {
          failure = ResultFailUnexpected(err)
          onDone()
        }
      }
      pumping = false
    }
    pump()
  })

/**
 * Effectfully filter the elements of the provided iterable.
 *
 * Use the `concurrency` option to control how many elements are processed in parallel.
 *
 * @since 3.3.0
 * @category collecting & elements
 */
export const filter = <A, E, R>(iterable: Iterable<A>, f: (a: NoInfer<A>) => Micro<boolean, E, R>, options?: {
  readonly concurrency?: Concurrency | undefined
  readonly negate?: boolean | undefined
}): Micro<Array<A>, E, R> =>
  suspend(() => {
    const out: Array<A> = []
    return as(
      forEach(iterable, (a) =>
        map(f(a), (passed) => {
          if (options?.negate === true) {
            passed = !passed
          }
          if (passed) {
            out.push(a)
          }
        }), {
        discard: true,
        concurrency: options?.concurrency
      }),
      out
    )
  })

// ----------------------------------------------------------------------------
// handle & forking
// ----------------------------------------------------------------------------

/**
 * @since 3.3.0
 * @category handle & forking
 */
export const HandleTypeId: unique symbol = Symbol.for("effect/Micro/Handle")

/**
 * @since 3.3.0
 * @category handle & forking
 */
export type HandleTypeId = typeof HandleTypeId

/**
 * @since 3.3.0
 * @category handle & forking
 */
export interface Handle<A, E = never> {
  readonly [HandleTypeId]: HandleTypeId
  readonly await: Micro<Result<A, E>>
  readonly join: Micro<A, E>
  readonly abort: Micro<void>
  readonly unsafeAbort: () => void
  readonly addObserver: (observer: (result: Result<A, E>) => void) => void
  readonly removeObserver: (observer: (result: Result<A, E>) => void) => void
  readonly unsafePoll: () => Result<A, E> | null
}

class HandleImpl<A, E> implements Handle<A, E> {
  readonly [HandleTypeId]: HandleTypeId

  readonly observers: Set<(result: Result<A, E>) => void> = new Set()
  private _result: Result<A, E> | undefined = undefined
  _controller: AbortController
  readonly isRoot: boolean

  constructor(readonly parentSignal: AbortSignal, controller?: AbortController) {
    this[HandleTypeId] = HandleTypeId
    this.isRoot = controller !== undefined
    this._controller = controller ?? new AbortController()
    if (!this.isRoot) {
      parentSignal.addEventListener("abort", this.unsafeAbort)
    }
  }

  unsafePoll(): Result<A, E> | null {
    return this._result ?? null
  }

  unsafeAbort = () => {
    this._controller.abort()
  }

  emit(result: Result<A, E>): void {
    if (this._result) {
      return
    }
    this._result = result
    if (!this.isRoot) {
      this.parentSignal.removeEventListener("abort", this.unsafeAbort)
    }
    this._controller.abort()
    this.observers.forEach((observer) => observer(result))
    this.observers.clear()
  }

  addObserver(observer: (result: Result<A, E>) => void): void {
    if (this._result) {
      return observer(this._result)
    }
    this.observers.add(observer)
  }

  removeObserver(observer: (result: Result<A, E>) => void): void {
    this.observers.delete(observer)
  }

  get await(): Micro<Result<A, E>> {
    return suspend(() => {
      if (this._result) {
        return succeed(this._result)
      }
      return async((resume) => {
        function observer(result: Result<A, E>) {
          resume(succeed(result))
        }
        this.addObserver(observer)
        return sync(() => {
          this.removeObserver(observer)
        })
      })
    })
  }

  get join(): Micro<A, E> {
    return suspend(() => {
      if (this._result) {
        return fromResult(this._result)
      }
      return async((resume) => {
        function observer(result: Result<A, E>) {
          resume(fromResult(result))
        }
        this.addObserver(observer)
        return sync(() => {
          this.removeObserver(observer)
        })
      })
    })
  }

  get abort(): Micro<void> {
    return suspend(() => {
      this.unsafeAbort()
      return asVoid(this.await)
    })
  }
}

/**
 * Run the `Micro` effect in a new `Handle` that can be awaited, joined, or
 * aborted.
 *
 * When the parent `Micro` finishes, this `Micro` will be aborted.
 *
 * @since 3.3.0
 * @category handle & forking
 */
export const fork = <A, E, R>(self: Micro<A, E, R>): Micro<Handle<A, E>, never, R> =>
  make(function(env, onResult) {
    const signal = envGet(env, currentAbortSignal)
    const handle = new HandleImpl<A, E>(signal)
    const nextEnv = envMutate(env, (map) => {
      map[currentAbortController.key] = handle._controller
      map[currentAbortSignal.key] = handle._controller.signal
      return map
    })
    yieldAdd(() => {
      self[runSymbol](nextEnv, (result) => {
        handle.emit(result)
      })
    })
    onResult(Either.right(handle))
  })

/**
 * Run the `Micro` effect in a new `Handle` that can be awaited, joined, or
 * aborted.
 *
 * It will not be aborted when the parent `Micro` finishes.
 *
 * @since 3.3.0
 * @category handle & forking
 */
export const forkDaemon = <A, E, R>(self: Micro<A, E, R>): Micro<Handle<A, E>, never, R> =>
  make(function(env, onResult) {
    const controller = new AbortController()
    const handle = new HandleImpl<A, E>(controller.signal, controller)
    const nextEnv = envMutate(env, (map) => {
      map[currentAbortController.key] = controller
      map[currentAbortSignal.key] = controller.signal
      return map
    })
    yieldAdd(() => {
      self[runSymbol](nextEnv, (result) => {
        handle.emit(result)
      })
    })
    onResult(Either.right(handle))
  })

// ----------------------------------------------------------------------------
// execution
// ----------------------------------------------------------------------------

/**
 * Execute the `Micro` effect and return a `Handle` that can be awaited, joined,
 * or aborted.
 *
 * You can listen for the result by adding an observer using the handle's
 * `addObserver` method.
 *
 * @since 3.3.0
 * @category execution
 * @example
 * import * as Micro from "effect/Micro"
 *
 * const handle = Micro.succeed(42).pipe(
 *   Micro.delay("1 second"),
 *   Micro.runFork
 * )
 *
 * handle.addObserver((result) => {
 *   console.log(result)
 * })
 */
export const runFork = <A, E>(
  effect: Micro<A, E>,
  options?: {
    readonly signal?: AbortSignal | undefined
  } | undefined
): Handle<A, E> => {
  const controller = new AbortController()
  const refs = Object.create(null)
  refs[currentAbortController.key] = controller
  refs[currentAbortSignal.key] = controller.signal
  const env = envMake(refs)
  const handle = new HandleImpl<A, E>(controller.signal, controller)
  effect[runSymbol](envSet(env, currentAbortSignal, handle._controller.signal), (result) => {
    handle.emit(result)
  })
  if (options?.signal) {
    if (options.signal.aborted) {
      handle.unsafeAbort()
    } else {
      options.signal.addEventListener("abort", () => handle.unsafeAbort())
    }
  }
  return handle
}

/**
 * Execute the `Micro` effect and return a `Promise` that resolves with the
 * `Result` of the computation.
 *
 * @since 3.3.0
 * @category execution
 */
export const runPromiseResult = <A, E>(
  effect: Micro<A, E>,
  options?: {
    readonly signal?: AbortSignal | undefined
  } | undefined
): Promise<Result<A, E>> =>
  new Promise((resolve, _reject) => {
    const handle = runFork(effect, options)
    handle.addObserver(resolve)
  })

/**
 * Execute the `Micro` effect and return a `Promise` that resolves with the
 * successful result of the computation.
 *
 * @since 3.3.0
 * @category execution
 */
export const runPromise = <A, E>(
  effect: Micro<A, E>,
  options?: {
    readonly signal?: AbortSignal | undefined
  } | undefined
): Promise<A> =>
  runPromiseResult(effect, options).then((result) => {
    if (result._tag === "Left") {
      throw result.left
    }
    return result.right
  })

/**
 * Attempt to execute the `Micro` effect synchronously and return the `Result`.
 *
 * If any asynchronous effects are encountered, the function will return an
 * FailureUnexpected containing the `Handle`.
 *
 * @since 3.3.0
 * @category execution
 */
export const runSyncResult = <A, E>(effect: Micro<A, E>): Result<A, E> => {
  const handle = runFork(effect)
  while (yieldState.tasks.length > 0) {
    yieldFlush()
  }
  const result = handle.unsafePoll()
  if (result === null) {
    return ResultFailUnexpected(handle)
  }
  return result
}

/**
 * Attempt to execute the `Micro` effect synchronously and return the success
 * value.
 *
 * @since 3.3.0
 * @category execution
 */
export const runSync = <A, E>(effect: Micro<A, E>): A => {
  const result = runSyncResult(effect)
  if (result._tag === "Left") {
    throw result.left
  }
  return result.right
}

// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------

interface YieldableError extends Pipeable, Inspectable, Readonly<Error> {
  readonly [EffectTypeId]: Effect.VarianceStruct<never, this, never>
  readonly [Stream.StreamTypeId]: Effect.VarianceStruct<never, this, never>
  readonly [Sink.SinkTypeId]: Sink.Sink.VarianceStruct<never, unknown, never, this, never>
  readonly [Channel.ChannelTypeId]: Channel.Channel.VarianceStruct<never, unknown, this, unknown, never, unknown, never>
  readonly [TypeId]: Micro.Variance<never, this, never>
  readonly [runSymbol]: (env: Env<any>, onResult: (result: Result<never, this>) => void) => void
  [Symbol.iterator](): MicroIterator<Micro<never, this, never>>
}

const YieldableError: new(message?: string) => YieldableError = (function() {
  class YieldableError extends globalThis.Error {
    [runSymbol](_env: any, onResult: any) {
      onResult(ResultFail(this))
    }
    toString() {
      return this.message ? `${this.name}: ${this.message}` : this.name
    }
    toJSON() {
      return { ...this }
    }
    [NodeInspectSymbol](): string {
      const stack = this.stack
      if (stack) {
        return `${this.toString()}\n${stack.split("\n").slice(1).join("\n")}`
      }
      return this.toString()
    }
  }
  Object.assign(YieldableError.prototype, MicroProto, StructuralPrototype)
  return YieldableError as any
})()

/**
 * @since 3.3.0
 * @category errors
 */
export const Error: new<A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true ? void
    : { readonly [P in keyof A]: A[P] }
) => YieldableError & Readonly<A> = (function() {
  return class extends YieldableError {
    constructor(args: any) {
      super()
      if (args) {
        Object.assign(this, args)
      }
    }
  } as any
})()

/**
 * @since 3.3.0
 * @category errors
 */
export const TaggedError = <Tag extends string>(tag: Tag): new<A extends Record<string, any> = {}>(
  args: Equals<A, {}> extends true ? void
    : { readonly [P in keyof A as P extends "_tag" ? never : P]: A[P] }
) => YieldableError & { readonly _tag: Tag } & Readonly<A> => {
  class Base extends Error<{}> {
    readonly _tag = tag
  }
  ;(Base.prototype as any).name = tag
  return Base as any
}
