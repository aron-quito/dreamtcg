/**
 * DreamsTCG Engine Context
 *
 * Shared interface re-exported so both the engine modules and DuelBoard.tsx
 * can import SyncedGameState from one place without circular deps.
 */

import { GameState } from "../types";

export interface LogEntry {
  id: number;
  msg: string;
  type: string;
}

export interface SyncedGameState extends GameState {
  logs?: LogEntry[];
  winnerEmail?: string | null;
  waitingForResponse?: boolean;
  responderEmail?: string | null; // Who gets priority to respond
}
