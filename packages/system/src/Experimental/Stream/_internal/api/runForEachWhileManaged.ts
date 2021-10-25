// ets_tracing: off

import type * as T from "../../../../Effect"
import type * as M from "../../../../Managed"
import * as SK from "../../Sink"
import type * as C from "../core"
import * as RunManaged from "./runManaged"

/**
 * Like `Stream#forEachWhile`, but returns a `Managed` so the finalization order
 * can be controlled.
 */
export function runForEachWhileManaged_<R, R1, E, E1, A>(
  self: C.Stream<R, E, A>,
  f: (a: A) => T.Effect<R1, E1, boolean>
): M.Managed<R & R1, E | E1, void> {
  return RunManaged.runManaged_(self, SK.forEachWhile(f))
}

/**
 * Like `Stream#forEachWhile`, but returns a `Managed` so the finalization order
 * can be controlled.
 *
 * @ets_data_first runForEachWhileManaged_
 */
export function runForEachWhileManaged<R1, E1, A>(
  f: (a: A) => T.Effect<R1, E1, boolean>
) {
  return <R, E>(self: C.Stream<R, E, A>) => runForEachWhileManaged_(self, f)
}
