// ets_tracing: off

import type * as C from "../core"
import * as FlattenPar from "./flattenPar"
import * as FromIterable from "./fromIterable"

/**
 * Merges a variable list of streams in a non-deterministic fashion.
 * Up to `n` streams may be consumed in parallel and up to
 * `outputBuffer` chunks may be buffered by this operator.
 */
export function mergeAll(n: number, outputBuffer = 16) {
  return <R, E, O>(...streams: C.Stream<R, E, O>[]) =>
    FlattenPar.flattenPar_(FromIterable.fromIterable(streams), n, outputBuffer)
}
