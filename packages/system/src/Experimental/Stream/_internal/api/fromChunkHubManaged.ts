// ets_tracing: off

import type * as CK from "../../../../Collections/Immutable/Chunk"
import * as H from "../../../../Hub"
import * as M from "../../../../Managed"
import type * as C from "../core"
import * as FromChunkQueue from "./fromChunkQueue"

/**
 * Creates a stream from a subscription to a hub in the context of a managed
 * effect. The managed effect describes subscribing to receive messages from
 * the hub while the stream describes taking messages from the hub.
 */
export function fromChunkHubManaged<R, E, O>(
  hub: H.XHub<never, R, unknown, E, never, CK.Chunk<O>>
): M.UIO<C.Stream<R, E, O>> {
  return M.map_(H.subscribe(hub), (queue) => FromChunkQueue.fromChunkQueue(queue))
}
