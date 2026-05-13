/**
 * DreamsTCG Core Types & Interfaces
 */

export enum CardType {
  MONSTER = "MONSTER",
  SPELL = "SPELL",
}

export enum GamePhase {
  DREAM = "DREAM",
  DRAW = "DRAW",
  MAIN = "MAIN",
  BATTLE = "BATTLE",
  END = "END",
}

export enum CardAttribute {
  DARK = "DARK",
  LIGHT = "LIGHT",
  EARTH = "EARTH",
  WATER = "WATER",
  FIRE = "FIRE",
  WIND = "WIND",
}

export enum CardLocation {
  HAND = "HAND",
  DECK = "DECK",
  MONSTER_ZONE = "MONSTER_ZONE",
  SPELL_ZONE = "SPELL_ZONE",
  GY = "GY",
  REMOVED = "REMOVED",
  EXTRA_DECK = "EXTRA_DECK",
}

export enum TriggerType {
  ANY_TIME = "ANY_TIME",
  ON_ACTIVATION = "ON_ACTIVATION",
  ON_ATTACK = "ON_ATTACK",
  ON_DRAW = "ON_DRAW",
  ON_SEND_TO_GY = "ON_SEND_TO_GY",
  ON_SUMMON = "ON_SUMMON",
}

export enum FrequencyType {
  UNLIMITED = "UNLIMITED",
  ONCE_PER_TURN = "ONCE_PER_TURN",
  ONCE_PER_DUEL = "ONCE_PER_DUEL",
  CONTINUOUS = "CONTINUOUS",
}

// --- EFFECT AST STRUCTURE ---

export interface Restriction {
  locations: CardLocation[];
  frequency: FrequencyType;
  mustBePosition?: "ATTACK" | "DEFENSE" | "FACE_UP" | "FACE_DOWN";
  summonRestriction?: "NONE" | "ONLY_SPECIAL" | "ONLY_NORMAL" | "CANNOT_SUMMON";
  customConditions?: string[]; // References to condition registry
}

export interface Trigger {
  type: TriggerType;
  params?: Record<string, any>; // e.g., { opponentOnly: true, name: "X" }
}

export interface Cost {
  action: string; // References ActionRegistry (e.g., "DISCARD")
  params: Record<string, any>; // e.g., { n: 1 }
}

export interface Resolution {
  action: string; // References ActionRegistry (e.g., "DRAW")
  params: Record<string, any>; // e.g., { n: 2 }
}

export interface CardEffect {
  id: string;
  name: string;
  restriction: Restriction;
  trigger: Trigger;
  costs: Cost[];
  resolutions: Resolution[];
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  level?: number;
  atk?: number;
  def?: number;
  attribute?: CardAttribute;
  description: string;
  effects: CardEffect[];
  image?: string; // Base64 or URL
  isCustom: boolean;
  isPublic?: boolean;
  limit?: number; // 0, 1, 2, 3
  mainAdjustments?: { x: number; y: number; zoom: number };
  mini1Adjustments?: { x: number; y: number; zoom: number };
  mini2Adjustments?: { x: number; y: number; zoom: number };
}

// --- ENGINE STATE ---

export interface PlayerState {
  id: string;
  name: string;
  email: string;
  lp: number;
  deck: string[]; // Card IDs
  hand: string[];
  monsterZones: (string | null)[]; // Max 3
  spellZones: (string | null)[];   // Max 3
  cardPositions: Record<string, "ATTACK" | "DEFENSE">; // instanceId -> position
  cardVisibilities: Record<string, "FACE_UP" | "FACE_DOWN">; // instanceId -> visibility
  gy: string[];
  removed: string[]; // Banned
  extraDeck: string[];
  attacksMade: Record<string, number>; // instanceId -> count
  negatedInstances: string[]; // instanceIds with negated effects
}

export interface DeckDefinition {
  id: string;
  name: string;
  mainCards: string[]; // IDs
  extraCards: string[]; // IDs
}

export interface GameState {
  players: [PlayerState, PlayerState];
  turn: number;
  phase: GamePhase;
  activePlayerIndex: number;
  firstPlayerIndex: number; // Index of the player who started the duel
  chain: string[]; // Stack of effect IDs
}
