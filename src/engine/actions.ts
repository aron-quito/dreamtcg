/**
 * DreamsTCG Action & Condition Registry  (v2 — Engine Upgrade)
 *
 * This registry is the "instruction set" of the engine.  Each entry maps a
 * plain string key (what lives in CardEffect.costs[].action and
 * CardEffect.resolutions[].action) to a runtime function that mutates
 * the live game state.
 *
 * Adding a new card ability = registering one or two functions here.
 * No touching the core engine is ever needed.
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  NAMING CONVENTIONS
 *  ─────────────────────────────────────────────────────────────────────────
 *  Actions    SCREAMING_SNAKE   e.g. DRAW, DESTROY_CARD, GAIN_LP
 *  Conditions camelCase         e.g. hasMonsterOnField, controlsAttribute
 * ────────────────────────────────────────────────────────────────────────────
 */

import { SyncedGameState } from "./types";
import { ActionFn, ConditionFn } from "./types";
import { CardLocation, CardDefinition } from "../types";

export function matchesFilter(def: CardDefinition | undefined, filter: any): boolean {
  if (!def || !filter) return true;
  if (filter.targetType && filter.targetType !== 'ANY' && def.type !== filter.targetType) return false;
  if (filter.cardName && !def.name.includes(filter.cardName)) return false;
  if (filter.attribute && filter.attribute !== 'ANY' && def.attribute !== filter.attribute) return false;
  if (filter.minLevel !== undefined && (def.level || 0) < filter.minLevel) return false;
  if (filter.maxLevel !== undefined && (def.level || 0) > filter.maxLevel) return false;
  if (filter.minAtk !== undefined && (def.atk || 0) < filter.minAtk) return false;
  if (filter.maxAtk !== undefined && (def.atk || 0) > filter.maxAtk) return false;
  return true;
}

// ─── Registry class ───────────────────────────────────────────────────────────

class EffectRegistryV2 {
  private actions = new Map<string, ActionFn>();
  private conditions = new Map<string, ConditionFn>();

  registerAction(name: string, fn: ActionFn) {
    this.actions.set(name, fn);
  }

  registerCondition(name: string, fn: ConditionFn) {
    this.conditions.set(name, fn);
  }

  getAction(name: string): ActionFn | undefined {
    return this.actions.get(name);
  }

  getCondition(name: string): ConditionFn | undefined {
    return this.conditions.get(name);
  }

  /** List all registered action names — useful for debugging */
  listActions(): string[] {
    return Array.from(this.actions.keys());
  }
}

export const ActionRegistry = new EffectRegistryV2();

// ═══════════════════════════════════════════════════════════════════════════
// ░ BUILT-IN ACTIONS  (the primitives every card effect builds on)
// ═══════════════════════════════════════════════════════════════════════════

// ─── Card Movement ────────────────────────────────────────────────────────────

/**
 * DRAW — Draw N cards from the top of your deck into your hand.
 * params: { n: number }
 */
const drawFn: ActionFn = (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const count = params.n ?? 1;

  for (let i = 0; i < count; i++) {
    if (player.deck.length === 0) {
      ctx.log(`${player.name} cannot draw — deck is empty!`, "system");
      g.winnerEmail = g.players[ctx.controllerIndex === 0 ? 1 : 0].email;
      break;
    }
    const drawn = player.deck.pop()!;
    player.hand.push(drawn);
    ctx.log(`${player.name} drew a card.`, "system");
  }
  return g;
};

ActionRegistry.registerAction("DRAW", drawFn);
ActionRegistry.registerAction("DRAW_CARD", drawFn);

/**
 * DISCARD — Discard N cards from your hand to the GY.
 * params: { n: number, targets?: string[] }   (targets = specific instanceIds)
 */
ActionRegistry.registerAction("DISCARD", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const targets: string[] = params.targets ?? [];
  const count = params.n ?? targets.length;

  if (targets.length > 0) {
    for (const id of targets) {
      const idx = player.hand.indexOf(id);
      if (idx !== -1) {
        player.hand.splice(idx, 1);
        player.gy.push(id);
        const def = ctx.getCardDef(id);
        ctx.log(`${player.name} discarded ${def?.name ?? id}.`, "action");
      }
    }
  } else {
    // Discard the last N from hand (random-like when no explicit targets)
    for (let i = 0; i < count && player.hand.length > 0; i++) {
      const id = player.hand.pop()!;
      player.gy.push(id);
      const def = ctx.getCardDef(id);
      ctx.log(`${player.name} discarded ${def?.name ?? id}.`, "action");
    }
  }
  return g;
});

/**
 * DESTROY_CARD — Destroy a card on the field (moves it to GY).
 * params: { targets: string[] }  (array of instanceIds)
 */
ActionRegistry.registerAction("DESTROY_CARD", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const targets: string[] = params.targets ?? [];

  for (const targetId of targets) {
    for (const player of g.players) {
      // Check monster zones
      const mIdx = player.monsterZones.indexOf(targetId);
      if (mIdx !== -1) {
        player.monsterZones[mIdx] = null;
        player.gy.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was destroyed.`, "combat");
        break;
      }
      // Check spell zones
      const sIdx = player.spellZones.indexOf(targetId);
      if (sIdx !== -1) {
        player.spellZones[sIdx] = null;
        player.gy.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was destroyed.`, "combat");
        break;
      }
    }
  }
  return g;
});

/**
 * SEND_TO_GY — Send a card to GY without "destroying" it.
 * If no targets provided, sends the source card itself.
 * params: { targets?: string[] }
 */
ActionRegistry.registerAction("SEND_TO_GY", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const targets: string[] = params.targets && params.targets.length > 0 
    ? params.targets 
    : [ctx.sourceInstanceId];

  for (const targetId of targets) {
    for (const player of g.players) {
      const removeFrom = (arr: (string | null)[], strict = false) => {
        const idx = strict ? (arr as string[]).indexOf(targetId) : arr.indexOf(targetId);
        if (idx !== -1) {
          if (strict) (arr as string[]).splice(idx, 1);
          else (arr as any[])[idx] = null;
          return true;
        }
        return false;
      };

      if (removeFrom(player.monsterZones) || removeFrom(player.spellZones) || removeFrom(player.hand, true)) {
        player.gy.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was sent to GY.`, "action");
        break;
      }
    }
  }
  return g;
});

/**
 * BANISH_CARD — Remove a card from play (any zone → removed pile).
 * params: { targets: string[] }
 */
ActionRegistry.registerAction("BANISH_CARD", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const targets: string[] = params.targets ?? [];

  for (const targetId of targets) {
    for (const player of g.players) {
      // Helper: removes from any array and returns whether found
      const removeFrom = (arr: (string | null)[], strict = false) => {
        const idx = strict
          ? (arr as string[]).indexOf(targetId)
          : arr.indexOf(targetId);
        if (idx !== -1) {
          if (strict) (arr as string[]).splice(idx, 1);
          else (arr as any[])[idx] = null;
          return true;
        }
        return false;
      };

      let found = false;
      if (removeFrom(player.monsterZones)) found = true;
      else if (removeFrom(player.spellZones)) found = true;
      else if (removeFrom(player.hand, true)) found = true;
      else if (removeFrom(player.gy, true)) found = true;

      if (found) {
        player.removed.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was banished.`, "combat");
        break;
      }
    }
  }
  return g;
});

/**
 * RETURN_TO_HAND — Return a field card to its controller's hand.
 * params: { targets: string[] }
 */
ActionRegistry.registerAction("RETURN_TO_HAND", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const targets: string[] = params.targets ?? [];

  for (const targetId of targets) {
    for (const player of g.players) {
      const mIdx = player.monsterZones.indexOf(targetId);
      if (mIdx !== -1) {
        player.monsterZones[mIdx] = null;
        player.hand.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was returned to hand.`, "action");
        break;
      }
      const sIdx = player.spellZones.indexOf(targetId);
      if (sIdx !== -1) {
        player.spellZones[sIdx] = null;
        player.hand.push(targetId);
        const def = ctx.getCardDef(targetId);
        ctx.log(`${def?.name ?? targetId} was returned to hand.`, "action");
        break;
      }
    }
  }
  return g;
});

// ─── Life Point Manipulation ──────────────────────────────────────────────────

/**
 * PAY_LP — Pay LP as a cost.
 * params: { n: number }
 */
ActionRegistry.registerAction("PAY_LP", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const amount = params.n ?? 0;
  player.lp = Math.max(0, player.lp - amount);
  ctx.log(`${player.name} paid ${amount} LP (now ${player.lp}).`, "action");
  if (player.lp <= 0) {
    g.winnerEmail = g.players[ctx.controllerIndex === 0 ? 1 : 0].email;
    ctx.log(`${player.name} LP reached 0 from an effect cost!`, "combat");
  }
  return g;
});

/**
 * GAIN_LP — Gain LP.
 * params: { n: number }
 */
const gainLpFn: ActionFn = (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  // Support both 'n' and 'amount' as parameter names
  const amount = params.n ?? params.amount ?? 0;
  player.lp += Number(amount);
  ctx.log(`${player.name} gained ${amount} LP (now ${player.lp}).`, "action");
  return g;
};

ActionRegistry.registerAction("GAIN_LP", gainLpFn);
ActionRegistry.registerAction("HEAL_LP", gainLpFn);
ActionRegistry.registerAction("RECOVER_LP", gainLpFn);

/**
 * DAMAGE_OPPONENT — Deal effect damage to the opponent's LP.
 * params: { n: number }
 */
ActionRegistry.registerAction("DAMAGE_OPPONENT", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const oppIdx = ctx.controllerIndex === 0 ? 1 : 0;
  const opp = g.players[oppIdx];
  const amount = params.n ?? 0;
  opp.lp = Math.max(0, opp.lp - amount);
  ctx.log(`${opp.name} took ${amount} effect damage (now ${opp.lp} LP).`, "combat");
  if (opp.lp <= 0) {
    g.winnerEmail = g.players[ctx.controllerIndex].email;
  }
  return g;
});

// ─── Stat Modification ────────────────────────────────────────────────────────

/**
 * BOOST_ATK — Temporarily boost a monster's ATK.
 * NOTE: Permanent stat boosts should be stored in cardPositions or a
 * dedicated statBoosts map.  For now this logs it; the stat overlay in the
 * UI should consume a `statOverrides` record added to SyncedGameState later.
 * params: { target: string, amount: number }
 */
ActionRegistry.registerAction("BOOST_ATK", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const def = ctx.getCardDef(params.target);
  ctx.log(
    `${def?.name ?? params.target} ATK boosted by ${params.amount}.`,
    "action"
  );
  // TODO: implement statOverrides in SyncedGameState for UI rendering
  return g;
});

// ─── Negate ────────────────────────────────────────────────────────────────

/**
 * NEGATE_EFFECT — Add target card instance to the negated list.
 * params: { target: string }  (instanceId)
 */
ActionRegistry.registerAction("NEGATE_EFFECT", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const target: string = params.target;

  for (const player of g.players) {
    if (!player.negatedInstances) player.negatedInstances = [];
    if (!player.negatedInstances.includes(target)) {
      player.negatedInstances.push(target);
      const def = ctx.getCardDef(target);
      ctx.log(`${def?.name ?? target} effects were negated.`, "action");
    }
  }
  return g;
});

// ─── Special Summon ───────────────────────────────────────────────────────────

/**
 * SPECIAL_SUMMON — Special Summon a card from GY or hand to a free zone.
 * params: { sourceInstanceId: string, from: "GY" | "HAND" | "REMOVED" }
 */
ActionRegistry.registerAction("SPECIAL_SUMMON", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const sourceId: string = params.sourceInstanceId;
  const from: string = params.from ?? "GY";

  // Find a free monster slot
  const freeSlot = player.monsterZones.indexOf(null);
  if (freeSlot === -1) {
    ctx.log("No free monster zone for special summon.", "system");
    return g;
  }

  // Remove from source zone
  let removed = false;
  if (from === "GY") {
    const idx = player.gy.indexOf(sourceId);
    if (idx !== -1) { player.gy.splice(idx, 1); removed = true; }
  } else if (from === "HAND") {
    const idx = player.hand.indexOf(sourceId);
    if (idx !== -1) { player.hand.splice(idx, 1); removed = true; }
  } else if (from === "REMOVED") {
    const idx = player.removed.indexOf(sourceId);
    if (idx !== -1) { player.removed.splice(idx, 1); removed = true; }
  }

  if (!removed) {
    ctx.log(`Special Summon failed — ${sourceId} not found in ${from}.`, "system");
    return g;
  }

  player.monsterZones[freeSlot] = sourceId;
  player.cardPositions[sourceId] = "ATTACK";
  player.cardVisibilities[sourceId] = "FACE_UP";
  const def = ctx.getCardDef(sourceId);
  ctx.log(`${def?.name ?? sourceId} was Special Summoned from ${from}.`, "action");
  return g;
});

// ─── Search / Mill ────────────────────────────────────────────────────────────

/**
 * SEARCH_CARD — Add a specific card from deck to hand (tutoring).
 * params: { targetCardId: string }  (the base card ID, not instance)
 */
ActionRegistry.registerAction("SEARCH_CARD", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const targetId: string = params.targetCardId;

  const idx = player.deck.findIndex(iid => iid.startsWith(targetId + "_"));
  if (idx === -1) {
    ctx.log(`${targetId} not found in deck.`, "system");
    return g;
  }

  const [found] = player.deck.splice(idx, 1);
  player.hand.push(found);
  const def = ctx.getCardDef(found);
  ctx.log(`${player.name} searched ${def?.name ?? found} from deck.`, "action");
  return g;
});

/**
 * MILL — Send N cards from the top of your deck to the GY.
 * params: { n: number }
 */
ActionRegistry.registerAction("MILL", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const count = params.n ?? 1;

  for (let i = 0; i < count && player.deck.length > 0; i++) {
    const milled = player.deck.pop()!;
    player.gy.push(milled);
    const def = ctx.getCardDef(milled);
    ctx.log(`${player.name} milled ${def?.name ?? milled} to GY.`, "action");
  }
  return g;
});

// ─── Custom Card Builder Actions ─────────────────────────────────────────────

/**
 * SUMMON_FROM_DECK — Special summon N matching monsters from deck.
 */
ActionRegistry.registerAction("SUMMON_FROM_DECK", async (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const count = params.n ?? 1;

  const validIds = player.deck.filter(id => {
    const def = ctx.getCardDef(id);
    return def?.type === 'MONSTER' && matchesFilter(def, params.filter);
  });

  if (validIds.length === 0) {
    ctx.log(`No valid monsters found in deck to summon.`, "system");
    return g;
  }

  let selectedIds: string[] = [];
  if (validIds.length <= count) {
    selectedIds = validIds;
  } else if (ctx.requestSelection) {
    selectedIds = await ctx.requestSelection(validIds, count, "Select monsters to Special Summon");
  } else {
    selectedIds = validIds.slice(0, count);
  }

  for (const id of selectedIds) {
    const idx = player.deck.indexOf(id);
    if (idx !== -1) {
      const freeSlot = player.monsterZones.findIndex(z => z === null);
      if (freeSlot === -1) {
        ctx.log(`No free monster zones to summon from deck.`, "system");
        break;
      }
      player.deck.splice(idx, 1);
      player.monsterZones[freeSlot] = id;
      player.cardPositions[id] = "ATTACK";
      player.cardVisibilities[id] = "FACE_UP";
      const def = ctx.getCardDef(id);
      ctx.log(`${player.name} Special Summoned ${def?.name ?? id} from Deck.`, "action");
    }
  }
  return g;
});

/**
 * ADD_TO_HAND — Search N matching cards from deck to hand.
 */
ActionRegistry.registerAction("ADD_TO_HAND", async (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const player = g.players[ctx.controllerIndex];
  const count = params.n ?? 1;

  const validIds = player.deck.filter(id => {
    const def = ctx.getCardDef(id);
    return matchesFilter(def, params.filter);
  });

  if (validIds.length === 0) {
    ctx.log(`No valid cards found in deck to add to hand.`, "system");
    return g;
  }

  let selectedIds: string[] = [];
  if (validIds.length <= count) {
    selectedIds = validIds;
  } else if (ctx.requestSelection) {
    selectedIds = await ctx.requestSelection(validIds, count, "Select cards to add to hand");
  } else {
    selectedIds = validIds.slice(0, count);
  }

  for (const id of selectedIds) {
    const idx = player.deck.indexOf(id);
    if (idx !== -1) {
      player.deck.splice(idx, 1);
      player.hand.push(id);
      const def = ctx.getCardDef(id);
      ctx.log(`${player.name} added ${def?.name ?? id} from Deck to Hand.`, "action");
    }
  }
  return g;
});

/**
 * DESTROY_ENEMY — Destroy N matching enemy cards.
 */
ActionRegistry.registerAction("DESTROY_ENEMY", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const oppIdx = ctx.controllerIndex === 0 ? 1 : 0;
  const opp = g.players[oppIdx];
  const count = params.n ?? 1;
  let destroyed = 0;

  for (let i = 0; i < opp.monsterZones.length && destroyed < count; i++) {
    const id = opp.monsterZones[i];
    if (id && matchesFilter(ctx.getCardDef(id), params.filter)) {
      opp.monsterZones[i] = null;
      opp.gy.push(id);
      destroyed++;
      const def = ctx.getCardDef(id);
      ctx.log(`${opp.name}'s ${def?.name ?? id} was destroyed.`, "combat");
    }
  }

  for (let i = 0; i < opp.spellZones.length && destroyed < count; i++) {
    const id = opp.spellZones[i];
    if (id && matchesFilter(ctx.getCardDef(id), params.filter)) {
      opp.spellZones[i] = null;
      opp.gy.push(id);
      destroyed++;
      const def = ctx.getCardDef(id);
      ctx.log(`${opp.name}'s ${def?.name ?? id} was destroyed.`, "combat");
    }
  }
  return g;
});

/**
 * BANISH_ENEMY — Banish N matching enemy cards.
 */
ActionRegistry.registerAction("BANISH_ENEMY", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const oppIdx = ctx.controllerIndex === 0 ? 1 : 0;
  const opp = g.players[oppIdx];
  const count = params.n ?? 1;
  let banished = 0;

  for (let i = 0; i < opp.monsterZones.length && banished < count; i++) {
    const id = opp.monsterZones[i];
    if (id && matchesFilter(ctx.getCardDef(id), params.filter)) {
      opp.monsterZones[i] = null;
      if (!opp.removed) opp.removed = [];
      opp.removed.push(id);
      banished++;
      const def = ctx.getCardDef(id);
      ctx.log(`${opp.name}'s ${def?.name ?? id} was banished.`, "action");
    }
  }

  for (let i = 0; i < opp.spellZones.length && banished < count; i++) {
    const id = opp.spellZones[i];
    if (id && matchesFilter(ctx.getCardDef(id), params.filter)) {
      opp.spellZones[i] = null;
      if (!opp.removed) opp.removed = [];
      opp.removed.push(id);
      banished++;
      const def = ctx.getCardDef(id);
      ctx.log(`${opp.name}'s ${def?.name ?? id} was banished.`, "action");
    }
  }
  return g;
});

/**
 * DEAL_DAMAGE — Deal N damage to opponent.
 */
ActionRegistry.registerAction("DEAL_DAMAGE", (ctx, params) => {
  const g: SyncedGameState = JSON.parse(JSON.stringify(ctx.game));
  const oppIdx = ctx.controllerIndex === 0 ? 1 : 0;
  const opp = g.players[oppIdx];
  const amount = params.n ?? 0;
  
  opp.lp = Math.max(0, opp.lp - amount);
  ctx.log(`${opp.name} took ${amount} damage.`, "combat");
  
  if (opp.lp <= 0) {
    g.winnerEmail = g.players[ctx.controllerIndex].email;
  }
  return g;
});

// ═══════════════════════════════════════════════════════════════════════════
// ░ BUILT-IN CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * hasMonsterOnField — True if the controller has at least one monster on field.
 */
ActionRegistry.registerCondition("hasMonsterOnField", (ctx) => {
  return ctx.game.players[ctx.controllerIndex].monsterZones.some(z => z !== null);
});

/**
 * opponentHasMonster — True if the opponent has at least one monster on field.
 */
ActionRegistry.registerCondition("opponentHasMonster", (ctx) => {
  const oppIdx = ctx.controllerIndex === 0 ? 1 : 0;
  return ctx.game.players[oppIdx].monsterZones.some(z => z !== null);
});

/**
 * controlsAttribute — True if controller has a monster on field matching
 * the given attribute.
 * params: { attribute: CardAttribute }
 */
ActionRegistry.registerCondition("controlsAttribute", (ctx, params) => {
  const player = ctx.game.players[ctx.controllerIndex];
  return player.monsterZones.some(id => {
    if (!id) return false;
    const def = ctx.getCardDef(id);
    return def?.attribute === params.attribute;
  });
});

/**
 * handHasCards — True if controller has at least N cards in hand.
 * params: { n: number }
 */
ActionRegistry.registerCondition("handHasCards", (ctx, params) => {
  return ctx.game.players[ctx.controllerIndex].hand.length >= (params.n ?? 1);
});

/**
 * gyHasCard — True if a specific card (by base ID) is in the GY.
 * params: { cardId: string }
 */
ActionRegistry.registerCondition("gyHasCard", (ctx, params) => {
  const gy = ctx.game.players[ctx.controllerIndex].gy;
  return gy.some(iid => iid.startsWith(params.cardId + "_"));
});
