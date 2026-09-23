import { CardRegistry } from './registry';
import { CardLocation, FrequencyType, TriggerType } from '../../types';
import { ActionRegistry } from '../actions';
import { EngineContext } from '../types';

CardRegistry.register('base_01', [
  {
    id: 'eff_01',
    name: 'Visionary Reach',
    restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.ONCE_PER_TURN },
    trigger: { type: TriggerType.ON_SUMMON },
    canActivate: (game: any, controller: number) => game.players[controller].lp > 500,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const payLp = ActionRegistry.getAction('PAY_LP');
       const draw = ActionRegistry.getAction('DRAW');
       
       if (payLp) {
         game = await payLp({ ...ctx, game }, { n: 500 });
       }
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 2 });
       }
       return game;
    }
  }
]);

CardRegistry.register('base_02', [
  {
    id: 'eff_02',
    name: 'Shadow Banish',
    restriction: { locations: [], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ANY_TIME },
    canActivate: (game: any, controller: number) => 
       game.players[controller].hand.length >= 1 && 
       game.players[1 - controller].gy.length >= 1,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const p = game.players[ctx.controllerIndex];
       const oppIndex = 1 - ctx.controllerIndex;
       const oppGy = game.players[oppIndex].gy;
       
       if (p.hand.length === 0 || !ctx.requestSelection) return game;
       
       // Cost: Discard 1
       const discardSelection = await ctx.requestSelection(p.hand, 1, "Select 1 card to discard for cost");
       if (!discardSelection || discardSelection.length === 0) return game;
       
       const discardId = discardSelection[0];
       p.hand = p.hand.filter((id: string) => id !== discardId);
       p.gy.push(discardId);
       ctx.log(`${p.name} discarded a card for Nightmare Shade's cost.`);
       
       // Resolution: Banish from opponent GY
       const banish = ActionRegistry.getAction('BANISH_CARD');
       if (banish && oppGy.length > 0) {
         const selection = await ctx.requestSelection(oppGy, 1, "Select a card from opponent's GY to banish");
         if (selection && selection.length > 0) {
           game = await banish({ ...ctx, game }, { targets: selection });
         }
       }
       return game;
    }
  }
]);

CardRegistry.register('base_03', [
  {
    id: 'eff_03',
    name: 'Healing Breeze',
    restriction: { locations: [CardLocation.HAND, CardLocation.SPELL_ZONE], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ON_ACTIVATION },
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const draw = ActionRegistry.getAction('DRAW');
       const gainLp = ActionRegistry.getAction('GAIN_LP');
       
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 1 });
       }
       if (gainLp) {
         game = await gainLp({ ...ctx, game }, { n: 1000 });
       }
       return game;
    }
  }
]);
