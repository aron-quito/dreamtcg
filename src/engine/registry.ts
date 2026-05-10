/**
 * DreamsTCG Engine Registry System
 * This allows for easy extensibility by registering new triggers and actions.
 */

import { GameState, CardEffect, CardDefinition } from "../types";

export type ActionFunction = (
  state: GameState, 
  params: any, 
  sourceCard: CardDefinition, 
  effect: CardEffect
) => GameState | Promise<GameState>;

export type ConditionFunction = (
  state: GameState,
  params: any,
  sourceCard: CardDefinition
) => boolean;

class Registry {
  private actions: Map<string, ActionFunction> = new Map();
  private conditions: Map<string, ConditionFunction> = new Map();

  // Register a new resolution (e.g., BANISH_CARD)
  registerAction(name: string, fn: ActionFunction) {
    console.log(`[Registry] Registered Action: ${name}`);
    this.actions.set(name, fn);
  }

  getAction(name: string): ActionFunction | undefined {
    return this.actions.get(name);
  }

  registerCondition(name: string, fn: ConditionFunction) {
    this.conditions.set(name, fn);
  }

  getCondition(name: string): ConditionFunction | undefined {
    return this.conditions.get(name);
  }
}

export const EffectRegistry = new Registry();

// --- INITIAL REGISTRATIONS (Examples of Extensibility) ---

EffectRegistry.registerAction("DRAW", (state, params, sourceCard) => {
  const newState = { ...state };
  const player = newState.players[newState.activePlayerIndex];
  const count = params.n || 1;
  
  for (let i = 0; i < count; i++) {
    const card = player.deck.pop();
    if (card) player.hand.push(card);
  }
  
  return newState;
});

EffectRegistry.registerAction("PAY_LP", (state, params) => {
  const newState = { ...state };
  const player = newState.players[newState.activePlayerIndex];
  player.lp -= params.n;
  return newState;
});

EffectRegistry.registerAction("DESTROY", (state, params) => {
  // Logic to move card to GY
  console.log(`Destroying card with params:`, params);
  return state;
});

// Adding BANISH (requested example of easy extension)
EffectRegistry.registerAction("BANISH_CARD", (state, params) => {
  console.log("Banishing card...", params.target);
  return state;
});
