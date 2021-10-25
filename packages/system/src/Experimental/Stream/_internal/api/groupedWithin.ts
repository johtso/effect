// ets_tracing: off

import type * as CL from "../../../../Clock"
import type * as CK from "../../../../Collections/Immutable/Chunk"
import * as SC from "../../../../Schedule"
import * as SK from "../../Sink"
import type * as C from "../core"
import * as AggregateAsyncWithin from "./aggregateAsyncWithin"

/**
 * Partitions the stream with the specified chunkSize or until the specified
 * duration has passed, whichever is satisfied first.
 */
export function groupedWithin_<R, E, A>(
  self: C.Stream<R, E, A>,
  chunkSize: number,
  within: number
): C.Stream<R & CL.HasClock, E, CK.Chunk<A>> {
  return AggregateAsyncWithin.aggregateAsyncWithin_(
    self,
    SK.collectAllN<E, A>(chunkSize),
    SC.spaced(within)
  )
}

/**
 * Partitions the stream with the specified chunkSize or until the specified
 * duration has passed, whichever is satisfied first.
 *
 * @ets_data_first groupedWithin_
 */
export function groupedWithin(chunkSize: number, within: number) {
  return <R, E, A>(self: C.Stream<R, E, A>) => groupedWithin_(self, chunkSize, within)
}
