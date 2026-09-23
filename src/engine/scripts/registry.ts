import { CardEffect } from '../../types';

export const CardRegistry = {
  effects: new Map<string, CardEffect[]>(),
  
  register(cardId: string, effects: CardEffect[]) {
    this.effects.set(cardId, effects);
  },
  
  getEffects(cardId: string): CardEffect[] {
    return this.effects.get(cardId) || [];
  }
};
