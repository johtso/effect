// ets_tracing: off

import * as CK from "../../../../Collections/Immutable/Chunk"
import type * as C from "../core"
import * as Concat from "./concat"
import * as Empty from "./empty"

/**
 * Concatenates all of the streams in the chunk to one stream.
 */
export function concatAll<R, E, O>(
  streams: CK.Chunk<C.Stream<R, E, O>>
): C.Stream<R, E, O> {
  return CK.reduce_(streams, Empty.empty as C.Stream<R, E, O>, (a, b) =>
    Concat.concat_(a, b)
  )
}
