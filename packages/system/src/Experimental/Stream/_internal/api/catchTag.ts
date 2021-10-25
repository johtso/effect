// ets_tracing: off

import type * as C from "../core"
import * as CatchAll from "./catchAll"
import * as Fail from "./fail"

/**
 * Recovers from specified error.
 *
 * @ets_data_first catchTag_
 */
export function catchTag<
  K extends E["_tag"] & string,
  E extends { _tag: string },
  R1,
  E1,
  A1
>(k: K, f: (e: Extract<E, { _tag: K }>) => C.Stream<R1, E1, A1>) {
  return <R, A>(
    self: C.Stream<R, E, A>
  ): C.Stream<R & R1, Exclude<E, { _tag: K }> | E1, A | A1> => catchTag_(self, k, f)
}

/**
 * Recovers from specified error.
 */
export function catchTag_<
  K extends E["_tag"] & string,
  E extends { _tag: string },
  R,
  A,
  R1,
  E1,
  A1
>(
  self: C.Stream<R, E, A>,
  k: K,
  f: (e: Extract<E, { _tag: K }>) => C.Stream<R1, E1, A1>
): C.Stream<R & R1, Exclude<E, { _tag: K }> | E1, A | A1> {
  return CatchAll.catchAll_(self, (e) => {
    if ("_tag" in e && e["_tag"] === k) {
      return f(e as any)
    }
    return Fail.fail(e as any)
  })
}
