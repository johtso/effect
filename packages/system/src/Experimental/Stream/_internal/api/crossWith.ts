// ets_tracing: off

import type * as C from "../core"
import * as Chain from "./chain"
import * as Map from "./map"

/**
 * Composes this stream with the specified stream to create a cartesian product of elements
 * with a specified function.
 * The `that` stream would be run multiple times, for every element in the `this` stream.
 */
export function crossWith<R, R1, E, E1, A, A1>(
  self: C.Stream<R, E, A>,
  that: C.Stream<R1, E1, A1>
) {
  return <C>(f: (a: A, a1: A1) => C): C.Stream<R & R1, E | E1, C> =>
    Chain.chain_(self, (l) => Map.map_(that, (r) => f(l, r)))
}
