// ets_tracing: off

import type * as CK from "../../../../Collections/Immutable/Chunk"
import * as CH from "../../Channel"
import * as C from "../core"

/**
 * Loops over the stream chunks concatenating the result of f
 */
export function loopOnChunks_<R, E, A, R1, E1, A1>(
  self: C.Stream<R, E, A>,
  f: (
    a: CK.Chunk<A>
  ) => CH.Channel<R1, E | E1, CK.Chunk<A>, unknown, E | E1, CK.Chunk<A1>, boolean>
): C.Stream<R & R1, E | E1, A1> {
  const loop: CH.Channel<
    R1,
    E | E1,
    CK.Chunk<A>,
    unknown,
    E | E1,
    CK.Chunk<A1>,
    boolean
  > = CH.readWithCause(
    (chunk) => CH.chain_(f(chunk), (cont) => (cont ? loop : CH.end(false))),
    CH.failCause,
    (_) => CH.end(false)
  )
  return new C.Stream(self.channel[">>>"](loop))
}

/**
 * Loops over the stream chunks concatenating the result of f
 *
 * @ets_data_first loopOnChunks_
 */
export function loopOnChunks<E, A, R1, E1, A1>(
  f: (
    a: CK.Chunk<A>
  ) => CH.Channel<R1, E | E1, CK.Chunk<A>, unknown, E | E1, CK.Chunk<A1>, boolean>
) {
  return <R>(self: C.Stream<R, E, A>) => loopOnChunks_(self, f)
}
