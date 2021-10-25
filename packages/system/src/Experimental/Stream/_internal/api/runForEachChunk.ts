// ets_tracing: off

import type * as CK from "../../../../Collections/Immutable/Chunk"
import type * as T from "../../../../Effect"
import * as SK from "../../Sink"
import type * as C from "../core"
import * as Run from "./run"

/**
 * Consumes all elements of the stream, passing them to the specified callback.
 */
export function runForEachChunk_<R, R1, E, E1, A, Z>(
  self: C.Stream<R, E, A>,
  f: (c: CK.Chunk<A>) => T.Effect<R1, E1, Z>
): T.Effect<R & R1, E | E1, void> {
  return Run.run_(self, SK.forEachChunk(f))
}

/**
 * Consumes all elements of the stream, passing them to the specified callback.
 *
 * @ets_data_first runForEachChunk_
 */
export function runForEachChunk<R1, E1, A, Z>(
  f: (c: CK.Chunk<A>) => T.Effect<R1, E1, Z>
) {
  return <R, E>(self: C.Stream<R, E, A>) => runForEachChunk_(self, f)
}
