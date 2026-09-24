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
  NONE = "NONE",
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
  ON_FLIP = "ON_FLIP",
  IGNITION = "IGNITION",
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
  frequencyCount?: number; // Default 1
  hardOncePerTurn?: boolean; // If true, applies to all copies by name
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
  isMandatory?: boolean;
  speed?: 1 | 2 | 3; // 1 = Trigger, 2 = Quick, 3 = Counter
  causaText?: string;
  efectoText?: string;
  costs?: Cost[];
  resolutions?: Resolution[];
  execute?: (ctx: any) => any | Promise<any>;
  canActivate?: (game: any, controllerIndex: number) => boolean;
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  attribute: CardAttribute;
  level?: number;
  atk?: number;
  def?: number;
  description: string;
  effects: CardEffect[];
  image?: string;
  isCustom?: boolean;
  isPublic?: boolean;
  limit?: number; // 0=Banned, 1=Limited, 2=Semi, 3=Unlimited
  canBeUltra?: boolean;
  mainAdjustments?: { x: number; y: number; zoom: number };
  mini1Adjustments?: { x: number; y: number; zoom: number };
  mini2Adjustments?: { x: number; y: number; zoom: number };
}

export interface PhysicalCard {
  id: string; // uuid
  templateId: string; // points to CardDefinition.id
  ownerEmail: string;
  quality: 'NORMAL' | 'SPECIAL' | 'EPIC' | 'ULTRA';
  durability: number;
  maxDurability: number;
  originalOwner: string;
  serialNumber?: number;
  winCount: number;
  createdAt: string;
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
  dreamSummonUsedThisTurn?: boolean;
  dreamSummonAttackDeclared?: boolean;
  dreamSummonedInstanceId?: string | null;
  salvationUsedThisTurn?: boolean;
  statModifiers?: Record<string, { atk?: number, def?: number }>; // instanceId -> modifiers
}

export interface DeckDefinition {
  id: string;
  name: string;
  mainCards: string[]; // IDs
  extraCards: string[]; // IDs
}

export interface PendingChainLink {
  instanceId: string;
  effectId: string;
  controllerIndex: number;
  costPaid?: boolean;
}

export interface QueuedTrigger {
  instanceId: string;
  effectId: string;
  controllerIndex: 0 | 1;
  isMandatory: boolean;
}

export interface ChainPriority {
  playerIndex: number; // The player whose turn it is to respond, or to resolve a link if isResolving is true
  passCount: number;   // How many consecutive passes have occurred
  priorityLevel?: 1 | 2 | 3; // Current speed level of the window (1=Trigger, 2=Quick, 3=Counter)
  isResolving?: boolean; // If true, the chain is currently resolving step-by-step
}

export interface GameState {
  players: [PlayerState, PlayerState];
  turn: number;
  phase: GamePhase;
  activePlayerIndex: number;
  firstPlayerIndex: number; // Index of the player who started the duel
  chain: string[]; // Legacy (unused)
  pendingChain?: PendingChainLink[];
  chainPriority?: ChainPriority;
  salvationPrompt?: string; // attacker instanceId (legacy)
  directAttackPrompt?: string; // attacker instanceId
  pendingAttack?: {
    attackerId: string;
    targetId: string | 'DIRECT';
  };
  queuedTriggers?: QueuedTrigger[];
  segocPhase?: "TP_OPTIONAL" | "OPP_OPTIONAL";
  salvationHandled?: boolean;
}
