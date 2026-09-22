/**
 * DreamsTCG Engine — Public barrel export
 *
 * DuelBoard.tsx (and any other consumer) should import from here,
 * never directly from engine internals.
 *
 * Usage:
 *   import { EffectEngine, ActionRegistry, TriggerType } from '../engine';
 */

export { EffectEngine, resetTurnTracking } from "./engine";
export { ActionRegistry } from "./actions";
export type { ChainLink, EngineContext, ResolutionEvent, SyncedGameState } from "./types";
