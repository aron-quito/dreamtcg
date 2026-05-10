/**
 * DreamsTCG Event Bus & Engine Controller
 */

import { 
  GameState, 
  TriggerType, 
  CardDefinition, 
  CardLocation, 
  CardEffect 
} from "../types";
import { EffectRegistry } from "./registry";

type EventType = TriggerType;

export class CardEngine {
  private state: GameState;
  private cardInstances: Map<string, CardDefinition>; // id to def

  constructor(initialState: GameState, cards: CardDefinition[]) {
    this.state = initialState;
    this.cardInstances = new Map(cards.map(c => [c.id, c]));
  }

  getState() {
    return this.state;
  }

  /**
   * Main Event Emission System
   */
  async emit(event: EventType, params: any = {}) {
    console.log(`[Engine] Emitting Event: ${event}`, params);

    const triggeredEffects: { card: CardDefinition, effect: CardEffect }[] = [];

    // 1. Scan all relevant zones for cards with effects that react to this trigger
    // In a real TCG, you'd check field, hand, GY, etc. based on restrictions
    this.cardInstances.forEach((card) => {
      card.effects.forEach((effect) => {
        if (effect.trigger.type === event) {
          if (this.checkRestrictions(card, effect)) {
             triggeredEffects.push({ card, effect });
          }
        }
      });
    });

    // 2. Resolve triggered effects
    for (const item of triggeredEffects) {
      await this.resolveEffect(item.card, item.effect);
    }
  }

  private checkRestrictions(card: CardDefinition, effect: CardEffect): boolean {
    // Check if card is in valid location (Mocking for now)
    // In production, we'd find the card's current location in this.state
    const currentLocation = CardLocation.MONSTER_ZONE; 
    
    if (!effect.restriction.locations.includes(currentLocation)) {
      return false;
    }

    // Additional custom condition checks
    if (effect.restriction.customConditions) {
      for (const condName of effect.restriction.customConditions) {
        const cond = EffectRegistry.getCondition(condName);
        if (cond && !cond(this.state, {}, card)) return false;
      }
    }

    return true;
  }

  private async resolveEffect(card: CardDefinition, effect: CardEffect) {
    console.log(`[Engine] Resolving effect: ${effect.name} from ${card.name}`);

    // 1. Pay Costs
    for (const cost of effect.costs) {
      const action = EffectRegistry.getAction(cost.action);
      if (action) {
        this.state = await action(this.state, cost.params, card, effect);
      }
    }

    // 2. Execute Resolutions
    for (const res of effect.resolutions) {
      const action = EffectRegistry.getAction(res.action);
      if (action) {
        this.state = await action(this.state, res.params, card, effect);
      }
    }
  }
}
