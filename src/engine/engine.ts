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
import { CardRegistry } from "./scripts/registry";
import "./scripts/base_cards";

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
    const cardId = instanceId.substring(0, instanceId.lastIndexOf("_"));
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

  /** Get a card definition by ID from the engine's registry */
  getCardDef(cardId: string): CardDefinition | undefined {
    return this.cardDefs.get(cardId);
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
          const cardId = instanceId.substring(0, instanceId.lastIndexOf("_"));
          const cardDef = this.cardDefs.get(cardId);
          if (!cardDef) continue;
          if (p.negatedInstances?.includes(instanceId)) continue;

          const effects = CardRegistry.getEffects(cardId);
          const activeEffects = effects.length > 0 ? effects : (cardDef.effects || []);
          for (const effect of activeEffects) {
            const isMatch = (effect.trigger.type === triggerType);
            
            if (!isMatch) continue;
            
            const isSource = (instanceId === triggerParams.instanceId);
            if (effect.trigger.params?.selfOnly && !isSource) continue;

            // Location check
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

            if (effect.canActivate && !effect.canActivate(game, pi)) continue;

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

      // 3. Queue Triggers for SEGOC
      game.queuedTriggers = game.queuedTriggers || [];
      for (const link of candidateLinks) {
        let originZone = "unknown";
        for (const p of game.players) {
            if (p.hand.includes(link.instanceId)) originZone = "hand";
            else if (p.monsterZones.includes(link.instanceId)) originZone = "monsterZones";
            else if (p.spellZones.includes(link.instanceId)) originZone = "spellZones";
            else if (p.gy.includes(link.instanceId)) originZone = "gy";
            else if (p.removed.includes(link.instanceId)) originZone = "removed";
            else if (p.deck.includes(link.instanceId)) originZone = "deck";
        }
        game.queuedTriggers.push({
          instanceId: link.instanceId,
          effectId: link.effect.id,
          controllerIndex: link.controllerIndex,
          isMandatory: !!link.effect.isMandatory,
          originZone
        });
      }

      // If we are NOT currently building or resolving a chain, process the queue immediately
      if (!game.chainPriority && (!game.pendingChain || game.pendingChain.length === 0)) {
         game = this.processSegocQueue(game);
      }

      return game;


    } catch (err) {
      console.error("Engine Crash:", err);
      return currentGame;
    }
  }

  // ─── SEGOC Processing ────────────────────────────────────────────────────
  
  public processSegocQueue(currentGame: SyncedGameState): SyncedGameState {
    let game = JSON.parse(JSON.stringify(currentGame)) as SyncedGameState;
    if (!game.queuedTriggers || game.queuedTriggers.length === 0) {
      game.segocPhase = null;
      
      // If there is a pending direct attack, prompt for Salvation BEFORE Quick Effects
      if (game.pendingAttack?.targetId === 'DIRECT' && !game.directAttackPrompt && !game.salvationHandled) {
         game.directAttackPrompt = game.pendingAttack.attackerId;
         // Do not start chainPriority yet. UI will handle salvation prompt and transition to chainPriority if needed.
         return game;
      }
      
      // Triggers handled, pass normal priority to start Quick Effects (Speed 2+)
      // If we already have a pending chain, whoever didn't add the last link gets priority
      const lastController = game.pendingChain && game.pendingChain.length > 0 
        ? game.pendingChain[game.pendingChain.length - 1].controllerIndex 
        : game.activePlayerIndex;
      const nextPriorityPlayer = 1 - lastController;
      
      game.chainPriority = {
        playerIndex: nextPriorityPlayer,
        passCount: 0
      };
      return game;
    }

    game.pendingChain = game.pendingChain || [];

    // Filter out triggers where the card left its origin zone
    game.queuedTriggers = game.queuedTriggers.filter(t => {
      let currentZone = "unknown";
      for (const p of game.players) {
          if (p.hand.includes(t.instanceId)) currentZone = "hand";
          else if (p.monsterZones.includes(t.instanceId)) currentZone = "monsterZones";
          else if (p.spellZones.includes(t.instanceId)) currentZone = "spellZones";
          else if (p.gy.includes(t.instanceId)) currentZone = "gy";
          else if (p.removed.includes(t.instanceId)) currentZone = "removed";
          else if (p.deck.includes(t.instanceId)) currentZone = "deck";
      }
      return currentZone === t.originZone;
    });

    if (game.queuedTriggers.length === 0) {
      return this.processSegocQueue(game);
    }

    // 1. Turn Player Mandatory
    const tpMandatory = game.queuedTriggers.findIndex(t => t.isMandatory && t.controllerIndex === game.activePlayerIndex);
    if (tpMandatory !== -1) {
      const t = game.queuedTriggers.splice(tpMandatory, 1)[0];
      game.pendingChain.push({ instanceId: t.instanceId, effectId: t.effectId, controllerIndex: t.controllerIndex });
      return this.processSegocQueue(game);
    }

    // 2. Opponent Mandatory
    const oppMandatory = game.queuedTriggers.findIndex(t => t.isMandatory && t.controllerIndex !== game.activePlayerIndex);
    if (oppMandatory !== -1) {
      const t = game.queuedTriggers.splice(oppMandatory, 1)[0];
      game.pendingChain.push({ instanceId: t.instanceId, effectId: t.effectId, controllerIndex: t.controllerIndex });
      return this.processSegocQueue(game);
    }

    // 3. Turn Player Optional
    const tpOptional = game.queuedTriggers.filter(t => !t.isMandatory && t.controllerIndex === game.activePlayerIndex);
    if (tpOptional.length > 0) {
      game.segocPhase = "TP_OPTIONAL";
      return game;
    }

    // 4. Opponent Optional
    const oppOptional = game.queuedTriggers.filter(t => !t.isMandatory && t.controllerIndex !== game.activePlayerIndex);
    if (oppOptional.length > 0) {
      game.segocPhase = "OPP_OPTIONAL";
      return game;
    }

    return game;
  }

  public selectSegocTrigger(currentGame: SyncedGameState, instanceId: string, effectId: string): SyncedGameState {
    let game = JSON.parse(JSON.stringify(currentGame)) as SyncedGameState;
    if (!game.queuedTriggers || !game.segocPhase) return game;

    const idx = game.queuedTriggers.findIndex(t => t.instanceId === instanceId && t.effectId === effectId);
    if (idx !== -1) {
      const t = game.queuedTriggers.splice(idx, 1)[0];
      game.pendingChain = game.pendingChain || [];
      game.pendingChain.push({ instanceId: t.instanceId, effectId: t.effectId, controllerIndex: t.controllerIndex });
    }

    return this.processSegocQueue(game);
  }

  // ─── Public: Manually add a card effect to the current chain ───────────

  addToChain(
    instanceId: string,
    effectId: string,
    currentGame: SyncedGameState,
    costPaid: boolean = false
  ): SyncedGameState {
    let game: SyncedGameState = JSON.parse(JSON.stringify(currentGame));
    
    const cardId = instanceId.substring(0, instanceId.lastIndexOf("_"));
    const cardDef = this.cardDefs.get(cardId);
    if (!cardDef) return game;

    const registryEffects = CardRegistry.getEffects(cardId);
    const activeEffects = registryEffects.length > 0 ? registryEffects : (cardDef.effects || []);
    
    const effect = activeEffects.find(e => e.id === effectId);
    if (!effect) return game;

    const controllerIndex = getControllerIndex(game, instanceId) ?? 0;
    
    game.pendingChain = game.pendingChain || [];
    game.pendingChain.push({
      instanceId,
      effectId,
      controllerIndex,
      costPaid,
    });
    
    return game;
  }

  /**
   * Activates an effect manually from the field, passes priority to opponent.
   */
  async activateManualEffect(
    instanceId: string,
    effectId: string,
    currentGame: SyncedGameState
  ): Promise<SyncedGameState> {
    const controllerIndex = getControllerIndex(currentGame, instanceId) ?? 0;
    const player = currentGame.players[controllerIndex];
    if (player.negatedInstances?.includes(instanceId)) {
      console.warn(`Attempted to activate negated instance ${instanceId}`);
      return currentGame;
    }
    
    let game = this.addToChain(instanceId, effectId, currentGame);
    
    // Find effect speed
    const cardId = instanceId.substring(0, instanceId.lastIndexOf("_"));
    const cardDef = this.cardDefs.get(cardId);
    let speed: 1 | 2 | 3 = 1;
    if (cardDef) {
       const eff = (cardDef.effects || []).find(e => e.id === effectId);
       if (eff && eff.speed) speed = eff.speed;
    }
    
    // Ensure priority level doesn't go backwards
    const currentPriority = game.chainPriority?.priorityLevel || 1;
    const newPriority = Math.max(currentPriority, speed) as 1 | 2 | 3;

    game.chainPriority = {
      playerIndex: 1 - controllerIndex,
      passCount: 0,
      priorityLevel: newPriority
    };
    
    return game;
  }

  /**
   * Passes priority to the next player. If both passed, enters RESOLVING state.
   */
  async passPriority(
    currentGame: SyncedGameState,
    requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>
  ): Promise<SyncedGameState> {
    let game: SyncedGameState = JSON.parse(JSON.stringify(currentGame));
    if (!game.chainPriority) return game;
    
    game.chainPriority.passCount += 1;
    if (game.chainPriority.passCount >= 2) {
      // Both passed, start step-by-step resolution
      if (!game.pendingChain || game.pendingChain.length === 0) {
        game.chainPriority = undefined;
        return game;
      }
      game.chainPriority.isResolving = true;
      // Set playerIndex to the controller of the LAST link (LIFO)
      game.chainPriority.playerIndex = game.pendingChain[game.pendingChain.length - 1].controllerIndex;
    } else {
      // Pass back to opponent
      game.chainPriority.playerIndex = 1 - game.chainPriority.playerIndex;
    }
    
    return game;
  }

  /**
   * Resolves ONE link from the pending chain (LIFO)
   */
  async resolveNextLink(
    currentGame: SyncedGameState,
    requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>
  ): Promise<SyncedGameState> {
    let game: SyncedGameState = JSON.parse(JSON.stringify(currentGame));
    const log = (msg: string, type = "effect") => {
      if (!game.logs) game.logs = [];
      game.logs.push({ id: Date.now() + Math.random(), msg, type });
      if (game.logs.length > 40) game.logs.shift();
    };

    if (!game.pendingChain || game.pendingChain.length === 0) {
      game.chainPriority = undefined;
      return game;
    }

    // Pop the last link (LIFO)
    const pLink = game.pendingChain.pop()!;
    const cardId = pLink.instanceId.substring(0, pLink.instanceId.lastIndexOf("_"));
    const cardDef = this.cardDefs.get(cardId);

    if (cardDef) {
      const registryEffects = CardRegistry.getEffects(cardId);
      const activeEffects = registryEffects.length > 0 ? registryEffects : (cardDef.effects || []);
      const effect = activeEffects.find(e => e.id === pLink.effectId);

      if (effect) {
        log(`Resolving Chain Link: ${cardDef.name}`, "chain");

        const ctx = buildContext(
          game, 
          this.cardDefs, 
          pLink.controllerIndex as 0 | 1, 
          pLink.instanceId, 
          cardDef, 
          effect, 
          log, 
          requestSelection
        );

        // Resolve costs and resolutions
        if (effect.execute) {
          game = await effect.execute(ctx);
        } else {
          // Legacy AST execution
          if (!pLink.costPaid) {
            for (const cost of effect.costs || []) {
              const fn = ActionRegistry.getAction(cost.action);
              if (fn) game = await fn({ ...ctx, game }, cost.params);
            }
          }
          for (const res of effect.resolutions || []) {
            const fn = ActionRegistry.getAction(res.action);
            if (fn) game = await fn({ ...ctx, game }, res.params);
            else log(`Unknown action: ${res.action}`, "system");
          }
        }

        // Mark frequency
        const scopeId = effect.restriction.hardOncePerTurn ? cardId : pLink.instanceId;
        const freqKey = `${scopeId}:${effect.id}`;
        usedThisTurn.set(freqKey, (usedThisTurn.get(freqKey) || 0) + 1);
        usedThisDuel.set(freqKey, (usedThisDuel.get(freqKey) || 0) + 1);

        // Spell cleanup for this specific link
        if (cardDef.type === "SPELL") {
          const p = game.players[pLink.controllerIndex];
          const sIdx = p.spellZones.indexOf(pLink.instanceId);
          if (sIdx !== -1) {
            p.spellZones[sIdx] = null;
            p.gy.push(pLink.instanceId);
            log(`${cardDef.name} was sent to GY.`, "system");
          }
        }
      }
    }

    // Prepare for next link or close chain
    if (game.pendingChain.length > 0) {
      // Set playerIndex to the controller of the NEW last link
      game.chainPriority!.playerIndex = game.pendingChain[game.pendingChain.length - 1].controllerIndex;
      return game;
    } else {
      game.chainPriority = undefined;
      log("--- Chain Closed ---", "chain");
      return this.processSegocQueue(game);
    }
  }

  /**
   * Resolves the current chain in LIFO order
   */
  async resolveChain(
    currentGame: SyncedGameState,
    requestSelection?: (options: string[], count: number, message: string) => Promise<string[]>
  ): Promise<SyncedGameState> {
    let game: SyncedGameState = JSON.parse(JSON.stringify(currentGame));
    const log = (msg: string, type = "effect") => {
      if (!game.logs) game.logs = [];
      game.logs.push({ id: Date.now() + Math.random(), msg, type });
      if (game.logs.length > 40) game.logs.shift();
    };

    if (!game.pendingChain || game.pendingChain.length === 0) return game;
    log("--- Resolving Chain ---", "chain");
    
    const chainLinks: ChainLink[] = [];
    for (let i = 0; i < game.pendingChain.length; i++) {
        const pLink = game.pendingChain[i];
        const cardId = pLink.instanceId.substring(0, pLink.instanceId.lastIndexOf("_"));
        const cardDef = this.cardDefs.get(cardId);
        if (!cardDef) continue;
        
        const registryEffects = CardRegistry.getEffects(cardId);
        const activeEffects = registryEffects.length > 0 ? registryEffects : (cardDef.effects || []);
        const effect = activeEffects.find(e => e.id === pLink.effectId);
        if (!effect) continue;
        
        chainLinks.push({
            linkNumber: i + 1,
            instanceId: pLink.instanceId,
            cardDef,
            effect,
            controllerIndex: pLink.controllerIndex as 0 | 1
        });
    }

    const originalChain = [...chainLinks]; // Track for cleanup
    
    while (chainLinks.length > 0) {
      const link = chainLinks.pop()!;
      const ctx = buildContext(game, this.cardDefs, link.controllerIndex, link.instanceId, link.cardDef, link.effect, log, requestSelection);
      
      // Check if costs were already paid at activation time
      const pLink = game.pendingChain ? game.pendingChain.find(
        p => p.instanceId === link.instanceId && p.effectId === link.effect.id
      ) : null;
      const alreadyPaidCost = pLink?.costPaid ?? false;

      // Resolve costs and resolutions
      if (link.effect.execute) {
        game = await link.effect.execute(ctx);
      } else {
        // Legacy AST execution — skip costs if already paid
        if (!alreadyPaidCost) {
          for (const cost of link.effect.costs || []) {
            const fn = ActionRegistry.getAction(cost.action);
            if (fn) game = await fn({ ...ctx, game }, cost.params);
          }
        }
        for (const res of link.effect.resolutions || []) {
          const fn = ActionRegistry.getAction(res.action);
          if (fn) game = await fn({ ...ctx, game }, res.params);
          else log(`Unknown action: ${res.action}`, "system");
        }
      }

      // Mark frequency
      const cardId = link.instanceId.substring(0, link.instanceId.lastIndexOf("_"));
      const scopeId = link.effect.restriction.hardOncePerTurn ? cardId : link.instanceId;
      const freqKey = `${scopeId}:${link.effect.id}`;
      usedThisTurn.set(freqKey, (usedThisTurn.get(freqKey) || 0) + 1);
      usedThisDuel.set(freqKey, (usedThisDuel.get(freqKey) || 0) + 1);
    }

    // Final Cleanup (Spells to GY)
    for (const link of originalChain) {
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

    game.pendingChain = [];
    game.chainPriority = undefined;

    log("--- Chain Closed ---", "chain");
    return game;
  }

  /** Current chain depth (useful for the UI chain indicator) */
  get chainLength() {
    return this.chain.length;
  }

  /** Get a snapshot of the current chain for UI rendering */
  get chainSnapshot(): ChainLink[] {
    return [...this.chain];
  }

  /**
   * Build a snapshot of the pending chain for UI animations.
   * Returns chain links with card defs and names for rendering
   * the chain overview and per-link resolution animations.
   */
  getChainSnapshot(game: SyncedGameState): Array<{
    chainNumber: number;
    instanceId: string;
    cardName: string;
    cardDef: CardDefinition;
    controllerIndex: number;
    playerName: string;
    effectName: string;
  }> {
    if (!game.pendingChain || game.pendingChain.length === 0) return [];
    return game.pendingChain.map((pLink, i) => {
      const cardId = pLink.instanceId.substring(0, pLink.instanceId.lastIndexOf("_"));
      const cardDef = this.cardDefs.get(cardId);
      const registryEffects = CardRegistry.getEffects(cardId);
      const activeEffects = registryEffects.length > 0 ? registryEffects : (cardDef?.effects || []);
      const effect = activeEffects.find(e => e.id === pLink.effectId);
      return {
        chainNumber: i + 1,
        instanceId: pLink.instanceId,
        cardName: cardDef?.name || 'Unknown',
        cardDef: cardDef!,
        controllerIndex: pLink.controllerIndex,
        playerName: game.players[pLink.controllerIndex]?.name || 'Player',
        effectName: effect?.name || 'Effect',
      };
    });
  }
}
