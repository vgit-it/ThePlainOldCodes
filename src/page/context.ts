// What the page files (share, exporter, real) can see of main.ts. The state itself stays in main.ts.

import type { Engine } from '../audio/engine';
import type { Idea } from '../idea';
import type { Track } from '../track';

export interface PageContext {
  engine: Engine;
  /** The idea on the page now (null before the first one). */
  idea: () => Idea | null;
  /** The track, in track mode. */
  track: () => Track | null;
  /** The status line under the buttons ('' puts the usual message back). */
  setStatus: (msg: string) => void;
  /** The Play / Stop button's look. */
  setPlaying: (on: boolean) => void;
}
