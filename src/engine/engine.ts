/**
 * DreamsTCG Effect Engine  (v2)
 *
 * This is the core interpreter.  It works like a small programming language:
 *
 *   1. An EVENT is emitted by game actions (summon, attack, phase change…)
 *   2. The engine SCANS every live card on the field/hand/GY for reactive
 *      effects whose trigger matches the event.
 *   3. Eligible effects are added to a CHAIN (priority stack, LIFO).
 *   4. Once priority passes, the chain RESOLVES in reverse order.
 *   5. Each resolution calls the ActionRegistry for the concrete mutation.
 *
 * The engine is PURE with respect to its output: it never calls setState
 * directly.  Instead it emits ResolutionEvents that DuelBoard.tsx consumes
 * to update React state and sync to the server.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * DESIGN PRINCIPLES
 *  • Immutable-first  — every action produces a new state copy
 *  • Negation-aware   — negatedInstances is checked before resolving
 *  • Chain-safe       — all chain entries resolve LIFO, logged clearly
 *  • Extensible       — new effects = new entries in ActionRegistry only
 * ────────────────────────────────────────────────────────────────────────────
 */

import {
  CardDefinition,
  CardEffect,
  CardLocation,
  FrequencyType,
  TriggerType,
} from "../types";
import { SyncedGameState } from "./types";
import { ChainLink, EngineContext, ResolutionEvent } from "./types";
import { ActionRegistry } from "./actions";

// Side-effect: import actions so they self-register when this module is loaded
import "./actions";

// ─── Frequency tracking (counters for X per turn / per duel) ──────────────────

/** We track used effects by keys: "instanceId:effectId" (Soft) or "cardId:effectId" (Hard) */
const usedThisTurn = new Map<string, number>();
const usedThisDuel = new Map<string, number>();

export function resetTurnTracking() {
  usedThisTurn.clear();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build an EngineContext for an action call */
function buildContext(
  game: SyncedGameState,
  cardDefs: Map<string, CardDefinition>,
  controllerIndex: 0 | 1,
  sourceInstanceId: string,
  sourceCardDef: CardDefinition,
  sourceEffect: CardEffect,
  logFn: (msg: string, type?: string) => void,
  requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>
): EngineContext {
  const getCardDef = (instanceId: string | null): CardDefinition | null => {
    if (!instanceId) return null;
    const cardId = instanceId.split("_")[0];
    return cardDefs.get(cardId) ?? null;
  };

  const findCardLocation = (instanceId: string) => {
    for (let pi = 0; pi < game.players.length; pi++) {
      const p = game.players[pi];
      const zones: Array<{ name: "hand" | "monsterZones" | "spellZones" | "gy" | "removed" | "deck"; arr: any[] }> = [
        { name: "hand", arr: p.hand },
        { name: "monsterZones", arr: p.monsterZones },
        { name: "spellZones", arr: p.spellZones },
        { name: "gy", arr: p.gy },
        { name: "removed", arr: p.removed },
        { name: "deck", arr: p.deck },
      ];
      for (const zone of zones) {
        const idx = zone.arr.indexOf(instanceId);
        if (idx !== -1) {
          return {
            playerIndex: pi as 0 | 1,
            zone: zone.name,
            slotIndex: idx,
          };
        }
      }
    }
    return null;
  };

  return {
    game,
    getCardDef,
    findCardLocation,
    log: logFn,
    sourceInstanceId,
    sourceCardDef,
    sourceEffect,
    controllerIndex,
    requestSelection,
  };
}

/** Determine which player controls a given instance */
function getControllerIndex(game: SyncedGameState, instanceId: string): 0 | 1 | null {
  for (let pi = 0; pi < game.players.length; pi++) {
    const p = game.players[pi];
    const all = [
      ...p.monsterZones,
      ...p.spellZones,
      ...p.hand,
      ...p.gy,
      ...p.removed,
      ...p.deck,
    ];
    if (all.includes(instanceId)) return pi as 0 | 1;
  }
  return null;
}

/** Check if a card is currently in a location allowed by the effect restriction */
function isInAllowedLocation(
  game: SyncedGameState,
  instanceId: string,
  allowedLocations: CardLocation[]
): boolean {
  const p0 = game.players[0];
  const p1 = game.players[1];

  const locationMap: Record<CardLocation, string[]> = {
    [CardLocation.HAND]: [...p0.hand, ...p1.hand],
    [CardLocation.DECK]: [...p0.deck, ...p1.deck],
    [CardLocation.MONSTER_ZONE]: [
      ...p0.monsterZones.filter(Boolean),
      ...p1.monsterZones.filter(Boolean),
    ] as string[],
    [CardLocation.SPELL_ZONE]: [
      ...p0.spellZones.filter(Boolean),
      ...p1.spellZones.filter(Boolean),
    ] as string[],
    [CardLocation.GY]: [...p0.gy, ...p1.gy],
    [CardLocation.REMOVED]: [...p0.removed, ...p1.removed],
    [CardLocation.EXTRA_DECK]: [...p0.extraDeck, ...p1.extraDeck],
  };

  return allowedLocations.some(loc => locationMap[loc]?.includes(instanceId));
}

/** Check that all custom conditions pass */
function checkCustomConditions(
  ctx: EngineContext,
  effect: CardEffect
): boolean {
  if (!effect.restriction.customConditions) return true;
  for (const condName of effect.restriction.customConditions) {
    const fn = ActionRegistry.getCondition(condName);
    if (fn && !fn(ctx, {})) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// ░ CORE ENGINE CLASS
// ═══════════════════════════════════════════════════════════════════════════

export class EffectEngine {
  private cardDefs: Map<string, CardDefinition>;
  /** Pending chain (LIFO — last push resolves first) */
  private chain: ChainLink[] = [];

  constructor(cardDefs: CardDefinition[]) {
    this.cardDefs = new Map(cardDefs.map(c => [c.id, c]));
  }

  /** Call this when a new turn begins so ONCE_PER_TURN tracking resets */
  onNewTurn() {
    resetTurnTracking();
  }

  // ─── Public: Emit an event ──────────────────────────────────────────────

  async emit(
    triggerType: TriggerType,
    triggerParams: Record<string, any>,
    currentGame: SyncedGameState,
    onUpdate: (events: ResolutionEvent[]) => void,
    originZone?: string,
    requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>
  ): Promise<SyncedGameState> {
    try {
      let game: SyncedGameState = JSON.parse(JSON.stringify(currentGame));
      const events: ResolutionEvent[] = [];

      const log = (msg: string, type = "effect") => {
        if (!game.logs) game.logs = [];
        game.logs.push({ id: Date.now() + Math.random(), msg, type });
        if (game.logs.length > 40) game.logs.shift();
      };

      // 1. Initial Log
      const activatorIndex = triggerParams.controllerIndex ?? 0;
      const player = game.players[activatorIndex];
      if (player) {
        const actionName = triggerType === TriggerType.ON_ACTIVATION ? "Activated" : "Summoned";
        log(`${player.name} ${actionName} ${triggerParams.cardName || 'a card'}.`, "system");
      }

      // 2. Scan for Effects
      const candidateLinks: ChainLink[] = [];
      for (let pi = 0; pi < game.players.length; pi++) {
        const p = game.players[pi];
        const allInstances = [
          ...p.monsterZones.filter(Boolean),
          ...p.spellZones.filter(Boolean),
          ...p.hand,
          ...p.gy,
        ] as string[];

        for (const instanceId of allInstances) {
          const cardId = instanceId.split("_")[0];
          const cardDef = this.cardDefs.get(cardId);
          if (!cardDef) continue;
          if (p.negatedInstances?.includes(instanceId)) continue;

          for (const effect of cardDef.effects) {
            const isMatch = (effect.trigger.type === triggerType) || 
                            (effect.trigger.type === TriggerType.ANY_TIME && 
                             (triggerType === TriggerType.ON_ACTIVATION || triggerType === TriggerType.ON_SUMMON));
            
            if (!isMatch) continue;

            // Location check
            const isSource = (instanceId === triggerParams.instanceId);
            const currentLoc = isInAllowedLocation(game, instanceId, effect.restriction.locations);
            if (!currentLoc) {
               if (isSource && originZone === 'hand' && effect.restriction.locations.includes(CardLocation.HAND)) {
                  // Allowed
               } else {
                  continue;
               }
            }

            // Frequency check
            const scopeId = effect.restriction.hardOncePerTurn ? cardId : instanceId;
            const freqKey = `${scopeId}:${effect.id}`;
            const maxUses = effect.restriction.frequencyCount || 1;
            const used = (effect.restriction.frequency === FrequencyType.ONCE_PER_DUEL ? usedThisDuel : usedThisTurn).get(freqKey) || 0;
            if (used >= maxUses) continue;

            candidateLinks.push({
              linkNumber: candidateLinks.length + 1,
              instanceId,
              cardDef,
              effect,
              controllerIndex: pi as 0 | 1,
            });
          }
        }
      }

      if (candidateLinks.length === 0) {
        return game;
      }

      // 3. Resolve Chain (LIFO)
      const chain = [...candidateLinks];
      while (chain.length > 0) {
        const link = chain.pop()!;
        const ctx = buildContext(game, this.cardDefs, link.controllerIndex, link.instanceId, link.cardDef, link.effect, log, requestSelection);
        
        // Resolve costs
        for (const cost of link.effect.costs) {
          const fn = ActionRegistry.getAction(cost.action);
          if (fn) game = await fn(ctx, cost.params);
        }
        
        // Resolve resolutions
        for (const res of link.effect.resolutions) {
          const fn = ActionRegistry.getAction(res.action);
          if (fn) game = await fn(ctx, res.params);
          else log(`Unknown action: ${res.action}`, "system");
        }

        // Mark frequency
        const cardId = link.instanceId.split("_")[0];
        const scopeId = link.effect.restriction.hardOncePerTurn ? cardId : link.instanceId;
        const freqKey = `${scopeId}:${link.effect.id}`;
        usedThisTurn.set(freqKey, (usedThisTurn.get(freqKey) || 0) + 1);
        usedThisDuel.set(freqKey, (usedThisDuel.get(freqKey) || 0) + 1);
      }

      // 4. Final Cleanup (Spells to GY)
      for (const link of candidateLinks) {
        if (link.cardDef.type === "SPELL") {
          const p = game.players[link.controllerIndex];
          const sIdx = p.spellZones.indexOf(link.instanceId);
          if (sIdx !== -1) {
            p.spellZones[sIdx] = null;
            p.gy.push(link.instanceId);
            log(`${link.cardDef.name} resolved and was sent to GY.`, "system");
          }
        }
      }

      log("--- Chain Closed ---", "chain");
      return game;

    } catch (err) {
      console.error("Engine Crash:", err);
      return currentGame;
    }
  }

  // ─── Public: Manually add a card effect to the current chain ───────────

  /**
   * Used when a player manually activates a card effect (Quick Effect, etc.)
   * Returns the link number assigned.
   */
  addToChain(
    instanceId: string,
    effectId: string,
    currentGame: SyncedGameState
  ): ChainLink | null {
    const cardId = instanceId.split("_")[0];
    const cardDef = this.cardDefs.get(cardId);
    if (!cardDef) return null;

    const effect = cardDef.effects.find(e => e.id === effectId);
    if (!effect) return null;

    const controllerIndex = getControllerIndex(currentGame, instanceId) ?? 0;
    const link: ChainLink = {
      linkNumber: this.chain.length + 1,
      instanceId,
      cardDef,
      effect,
      controllerIndex,
    };
    this.chain.push(link);
    return link;
  }

  /** Current chain depth (useful for the UI chain indicator) */
  get chainLength() {
    return this.chain.length;
  }

  /** Get a snapshot of the current chain for UI rendering */
  get chainSnapshot(): ChainLink[] {
    return [...this.chain];
  }
}
