import { CardRegistry } from './registry';
import { CardLocation, FrequencyType, TriggerType } from '../../types';
import { ActionRegistry } from '../actions';
import { EngineContext } from '../types';

CardRegistry.register('base_01', [
  {
    id: 'eff_01',
    name: 'Visionary Reach',
    restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.ONCE_PER_TURN },
    trigger: { type: TriggerType.ON_SUMMON, params: { selfOnly: true } },
    speed: 1,
    isMandatory: false,
    canActivate: (game: any, controller: number) => game.players[controller].lp > 500,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const payLp = ActionRegistry.getAction('PAY_LP');
       const draw = ActionRegistry.getAction('DRAW');
       
       if (payLp) {
         game = await payLp({ ...ctx, game }, { n: 500 });
       }
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 1 });
       }
       return game;
    }
  }
]);

CardRegistry.register('base_02', [
  {
    id: 'eff_02',
    name: 'Nightmare Shade',
    restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ANY_TIME },
    speed: 2,
    isMandatory: false,
    canActivate: (game: any, controller: number) => {
       const p = game.players[controller];
       const oppIndex = 1 - controller;
       const oppMonsters = game.players[oppIndex].monsterZones.filter(id => id !== null);
       return p.hand.length >= 1 && oppMonsters.length >= 1;
    },
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const p = game.players[ctx.controllerIndex];
       const oppIndex = 1 - ctx.controllerIndex;
       
       if (p.hand.length === 0 || !ctx.requestSelection) return game;
       
       // Cost: Discard 1
       const discardSelection = await ctx.requestSelection(p.hand, 1, "Select 1 card to discard for cost");
       if (!discardSelection || discardSelection.length === 0) return game;
       
       const discardId = discardSelection[0];
       p.hand = p.hand.filter((id: string) => id !== discardId);
       p.gy.push(discardId);
       ctx.log(`${p.name} discarded a card for Nightmare Shade's cost.`);
       
       // Resolution: Destroy 1 opponent's monster
       const oppMonsters = game.players[oppIndex].monsterZones.filter(id => id !== null) as string[];
       if (oppMonsters.length > 0) {
         const selection = await ctx.requestSelection(oppMonsters, 1, "Select 1 opponent's monster to destroy");
         if (selection && selection.length > 0) {
           const targetId = selection[0];
           const destroy = ActionRegistry.getAction('DESTROY_CARD');
           if (destroy) {
             game = await destroy({ ...ctx, game }, { targets: [targetId] });
           }
         }
       }
       return game;
    }
  }
]);

CardRegistry.register('base_03', [
  {
    id: 'eff_03',
    name: 'Greedy Heal',
    restriction: { locations: [CardLocation.HAND, CardLocation.SPELL_ZONE], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ANY_TIME },
    speed: 2,
    isMandatory: false,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const draw = ActionRegistry.getAction('DRAW');
       const gainLp = ActionRegistry.getAction('GAIN_LP');
       
       if (gainLp) {
         game = await gainLp({ ...ctx, game }, { n: 500 });
       }
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 1 });
       }
       return game;
    }
  }
]);

CardRegistry.register('base_04', [
  {
    id: 'eff_04',
    name: 'Thunder Draw',
    restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ON_SUMMON },
    speed: 1,
    isMandatory: true,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const draw = ActionRegistry.getAction('DRAW');
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 1 });
       }
       return game;
    }
  }
]);

CardRegistry.register('base_05', [
  {
    id: 'eff_05',
    name: 'Emergency Guard',
    restriction: { locations: [CardLocation.HAND, CardLocation.SPELL_ZONE], frequency: FrequencyType.UNLIMITED },
    trigger: { type: TriggerType.ANY_TIME },
    speed: 2,
    isMandatory: false,
    execute: async (ctx: EngineContext) => {
       let game = ctx.game;
       const draw = ActionRegistry.getAction('DRAW');
       const gainLp = ActionRegistry.getAction('GAIN_LP');
       
       if (gainLp) {
         game = await gainLp({ ...ctx, game }, { n: 1000 });
       }
       if (draw) {
         game = await draw({ ...ctx, game }, { n: 1 });
       }
       return game;
    }
  }
]);
