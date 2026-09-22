/**
 * DreamsTCG Engine Runtime Types
 *
 * These types are INTERNAL to the engine and separate from the card definition
 * types in src/types.ts.  The distinction matters: CardEffect describes WHAT a
 * card can do (its static definition); EngineContext describes the LIVE STATE
 * the engine mutates while resolving effects.
 */

import { CardDefinition, CardEffect, PlayerState, GameState } from "../types";

// ─── Log Entry ───────────────────────────────────────────────────────────────

export interface LogEntry {
  id: number;
  msg: string;
  type: string;
}

// ─── Synced Game State ────────────────────────────────────────────────────────

export interface SyncedGameState extends GameState {
  logs?: LogEntry[];
  winnerEmail?: string | null;
  waitingForResponse?: boolean;
  responderEmail?: string | null; // Who gets priority to respond
}

// ─── Chain Link ───────────────────────────────────────────────────────────────

export interface ChainLink {
  linkNumber: number;           // 1-indexed position in current chain
  instanceId: string;           // Which card instance triggered it
  cardDef: CardDefinition;
  effect: CardEffect;
  controllerIndex: 0 | 1;      // Which player controls the source
}

// ─── Engine Context (passed to every action/condition function) ───────────────

export interface EngineContext {
  game: SyncedGameState;
  /** Looks up a card definition from an instance ID like "fireDragon_abc123" */
  getCardDef: (instanceId: string | null) => CardDefinition | null;
  /** Finds which player and zone contains a given instance ID */
  findCardLocation: (instanceId: string) => {
    playerIndex: 0 | 1;
    zone: "hand" | "monsterZones" | "spellZones" | "gy" | "removed" | "deck";
    slotIndex: number;
  } | null;
  log: (msg: string, type?: string) => void;
  /** The card that is the SOURCE of the effect being resolved */
  sourceInstanceId: string;
  sourceCardDef: CardDefinition;
  sourceEffect: CardEffect;
  controllerIndex: 0 | 1;
  /** Request the UI to prompt the user to select from a list of cards */
  requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>;
}

// ─── Action & Condition signatures ────────────────────────────────────────────

/** An action mutates the game state and returns the next state */
export type ActionFn = (
  ctx: EngineContext,
  params: Record<string, any>
) => SyncedGameState | Promise<SyncedGameState>;

/** A condition checks the current state and returns true/false */
export type ConditionFn = (
  ctx: EngineContext,
  params: Record<string, any>
) => boolean;

// ─── Resolution Event (fired by the engine, consumed by UI/server) ────────────

export interface ResolutionEvent {
  type: "STATE_UPDATE" | "CHAIN_OPEN" | "CHAIN_RESOLVE" | "COST_PAID" | "EFFECT_NEGATED";
  nextState: SyncedGameState;
  chainSnapshot?: ChainLink[];
  message: string;
}
