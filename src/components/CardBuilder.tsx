import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Settings, 
  Zap, 
  Target, 
  Coins, 
  PlayCircle 
} from 'lucide-react';
import { 
  CardDefinition, 
  CardType, 
  CardAttribute, 
  CardEffect, 
  CardLocation, 
  TriggerType, 
  FrequencyType,
  Trigger,
  Restriction
} from '../types';
import { EffectRegistry } from '../engine/registry';

const renderRestrictionText = (restriction: Restriction): string => {
  const locMap: Record<string, string> = {
    [CardLocation.HAND]: "la Mano",
    [CardLocation.DECK]: "el Deck",
    [CardLocation.MONSTER_ZONE]: "el Campo",
    [CardLocation.SPELL_ZONE]: "la Zona de Hechizos",
    [CardLocation.GY]: "el Cementerio",
    [CardLocation.REMOVED]: "el Destierro"
  };

  const freqMap: Record<string, string> = {
    [FrequencyType.UNLIMITED]: "Sin límite",
    [FrequencyType.ONCE_PER_TURN]: "1 vez por turno",
    [FrequencyType.ONCE_PER_DUEL]: "1 vez por duelo",
    [FrequencyType.CONTINUOUS]: "Efecto Permanente"
  };

  const posMap: Record<string, string> = {
    "ATTACK": "en Posición de Ataque",
    "DEFENSE": "en Posición de Defensa",
    "FACE_UP": "Boca Arriba",
    "FACE_DOWN": "Boca Abajo"
  };

  const locs = restriction.locations.map(l => locMap[l] || l).join(", ");
  const freq = freqMap[restriction.frequency] || restriction.frequency;
  const pos = restriction.mustBePosition ? ` (${posMap[restriction.mustBePosition]})` : "";
  
  let baseText = `Solo en ${locs}${pos}. [${freq}]`;

  if (restriction.summonRestriction && restriction.summonRestriction !== "NONE") {
    const sMap: Record<string, string> = {
      "ONLY_SPECIAL": "No puede ser Invocado de Modo Normal",
      "ONLY_NORMAL": "No puede ser Invocado de Modo Especial",
      "CANNOT_SUMMON": "No puede ser Invocado de ninguna forma"
    };
    baseText += `. ${sMap[restriction.summonRestriction]}`;
  }

  return baseText;
};

const renderTriggerText = (trigger: Trigger): string => {
  const params = trigger.params || {};
  switch (trigger.type) {
    case TriggerType.ANY_TIME:
      return "Cualquier momento (Efecto Rápido)";
    case TriggerType.ON_ACTIVATION:
      const actWho = params.activationWho === "OPPONENT" ? "el Oponente" : (params.activationWho === "ANY" ? "cualquiera" : "tú");
      let base = `Cuando ${actWho} activa${actWho === "tú" ? "s" : ""} una carta`;
      if (params.targetCardType === CardType.MONSTER) base = `Cuando ${actWho} activa${actWho === "tú" ? "s" : ""} un efecto de Monstruo`;
      if (params.targetCardType === CardType.SPELL) base = `Cuando ${actWho} activa${actWho === "tú" ? "s" : ""} una carta Hechizo`;
      if (params.filterName) base += ` [${params.filterName}]`;
      return base;
    case TriggerType.ON_SUMMON:
      const sWho = params.summonWho === "OPPONENT" ? "el oponente" : (params.summonWho === "ANY" ? "cualquier jugador" : "tú");
      const sMethod = params.summonMethod === "SPECIAL" ? "de Modo Especial" : (params.summonMethod === "NORMAL" ? "de Modo Normal" : (params.summonMethod === "FLIP" ? "por Volteo" : ""));
      const sTarget = params.targetCardType === CardType.MONSTER ? "un monstruo" : "una carta";
      const sFilter = params.filterName ? `[${params.filterName}]` : "";

      if (params.summonWho === "ANY") {
        return `Al ser Invocad${sTarget === "un monstruo" ? "o" : "a"} ${sMethod} ${sTarget} ${sFilter}`;
      }
      return `Cuando ${sWho} Invoca${sWho === "tú" ? "s" : ""} ${sMethod} ${sTarget} ${sFilter}`;
    case TriggerType.ON_DRAW:
      const drawWho = params.drawWho === "OPPONENT" ? "el oponente" : "tú";
      const drawMethod = params.drawMethod === "EFFECT" ? "por efecto" : (params.drawMethod === "PHASE" ? "en Draw Phase" : "");
      let drawBase = `Cuando ${drawWho} rob${drawWho === "tú" ? "as" : "a"} una carta ${drawMethod}`;
      if (params.filterName) drawBase += ` [${params.filterName}]`;
      return drawBase;
    case TriggerType.ON_ATTACK:
      const atkType = params.attackType;
      switch (atkType) {
        case "SELF": return "Cuando esta carta declara un ataque";
        case "BEING_ATTACKED": return "Cuando esta carta es atacada";
        case "CONTROLLED": return "Cuando un monstruo que controlas es atacado";
        case "OPPONENT": return "Cuando un monstruo enemigo es atacado";
        case "DIRECT": return "Cuando se declara un ataque directo";
        case "ANY": return "Cuando cualquier monstruo declara un ataque";
        default: return "Cuando se declara un ataque";
      }
    case TriggerType.ON_SEND_TO_GY:
      const sendIsSelf = params.isSelf;
      if (sendIsSelf) {
        const sFrom = params.sendFrom === "HAND" ? "desde la mano" : (params.sendFrom === "DECK" ? "desde el Deck" : (params.sendFrom === "FIELD" ? "desde el Campo" : ""));
        const sMethod = params.sendMethod === "BATTLE" ? "por batalla" : (params.sendMethod === "EFFECT" ? "por efecto" : (params.sendMethod === "COST" ? "como costo" : ""));
        return `Cuando esta carta es enviada al Cementerio ${sFrom} ${sMethod}`.replace(/\s+/g, ' ').trim();
      }

      const sendWho = params.sendWho === "OPPONENT" ? "el oponente" : (params.sendWho === "ANY" ? "cualquier jugador" : "tú");
      const sendFrom = params.sendFrom === "HAND" ? "desde la mano" : (params.sendFrom === "DECK" ? "desde el Deck" : (params.sendFrom === "FIELD" ? "desde el Campo" : ""));
      const sendMethod = params.sendMethod === "BATTLE" ? "por batalla" : (params.sendMethod === "EFFECT" ? "por efecto" : (params.sendMethod === "COST" ? "como costo" : ""));
      const sendTarget = params.targetCardType === CardType.MONSTER ? "un monstruo" : (params.targetCardType === CardType.SPELL ? "una carta de Hechizo" : "una carta");
      const sendFilter = params.filterName ? `[${params.filterName}]` : "";
      
      const sendVerb = sendWho === "tú" ? "envías" : "envía";
      return `Cuando ${sendWho} ${sendVerb} ${sendTarget} ${sendFilter} al Cementerio ${sendFrom} ${sendMethod}`.replace(/\s+/g, ' ').trim();
    default:
      return trigger.type;
  }
};

interface CardBuilderProps {
  onSave: (card: CardDefinition) => void;
  initialCard?: CardDefinition;
}

export const CardBuilder: React.FC<CardBuilderProps> = ({ onSave, initialCard }) => {
  const [card, setCard] = useState<CardDefinition>(initialCard || {
    id: crypto.randomUUID(),
    name: "New Card",
    type: CardType.MONSTER,
    description: "Enter description...",
    effects: [],
    level: 1,
    atk: 0,
    def: 0,
    attribute: CardAttribute.DARK,
    isCustom: true
  });

  const addEffect = () => {
    const newEffect: CardEffect = {
      id: crypto.randomUUID(),
      name: "New Effect",
      restriction: { locations: [CardLocation.HAND], frequency: FrequencyType.UNLIMITED },
      trigger: { type: TriggerType.ON_SUMMON },
      costs: [],
      resolutions: []
    };
    setCard({ ...card, effects: [...card.effects, newEffect] });
  };

  const updateEffect = (index: number, updated: CardEffect) => {
    const newEffects = [...card.effects];
    newEffects[index] = updated;
    setCard({ ...card, effects: newEffects });
  };

  const removeEffect = (index: number) => {
    setCard({ ...card, effects: card.effects.filter((_, i) => i !== index) });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Visual Preview */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Card Preview</h3>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          <div className="flex justify-between items-start mb-4">
            <h4 className="text-xl font-bold uppercase tracking-tight">{card.name || "Unnamed"}</h4>
            <span className="text-[10px] font-mono bg-slate-800 px-2 py-1 rounded">{card.attribute}</span>
          </div>
          <div className="aspect-[3/4] bg-slate-800 rounded-lg mb-4 flex items-center justify-center border border-slate-700/30">
            <Settings className="w-12 h-12 text-slate-700 animate-spin-slow" />
          </div>
          <div className="text-[11px] text-slate-400 italic mb-4 min-h-[4rem] space-y-3">
            <p className="leading-relaxed">{card.description || "Sin descripción establecida..."}</p>
            {card.effects.map((eff, i) => (
              <div key={i} className="pt-2 border-t border-slate-800/50 space-y-1 not-italic">
                <div className="flex gap-2">
                  <span className="text-indigo-400 font-bold shrink-0">Trigger:</span>
                  <span className="text-slate-200 leading-tight">{renderTriggerText(eff.trigger)}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold shrink-0">Condition:</span>
                  <span className="text-slate-200 leading-tight">{renderRestrictionText(eff.restriction)}</span>
                </div>
              </div>
            ))}
          </div>
          {card.type === CardType.MONSTER && (
            <div className="flex justify-between font-mono text-sm border-t border-slate-800 pt-3">
              <span>ATK/ {card.atk}</span>
              <span>DEF/ {card.def}</span>
            </div>
          )}
        </div>
        <button 
          onClick={() => onSave(card)}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Save className="w-5 h-5" /> Save to Collection
        </button>
      </div>

      {/* Editor Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Card Name</label>
              <input 
                value={card.name}
                onChange={e => setCard({...card, name: e.target.value})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                placeholder="Ex: Cyber Dragon"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
              <select 
                value={card.type}
                onChange={e => setCard({...card, type: e.target.value as CardType})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200"
              >
                <option value={CardType.MONSTER}>Monster</option>
                <option value={CardType.SPELL}>Spell</option>
              </select>
            </div>
          </div>

          {/* Effects Builder (The AST Core) */}
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-2">
                <PlayCircle className="w-4 h-4 text-indigo-400" /> Effect Tree (AST)
              </h4>
              <button 
                onClick={addEffect}
                className="text-[10px] font-bold bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-3 py-1.5 rounded-full transition-all flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Branch
              </button>
            </div>

            <div className="space-y-4">
              {card.effects.map((effect, idx) => (
                <div key={effect.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 relative group">
                  <button 
                    onClick={() => removeEffect(idx)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Trigger (EVENT BUS) */}
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 space-y-3">
                      <div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-2">
                          <Zap className="w-3 h-3" /> Trigger Type
                        </div>
                        <select 
                          value={effect.trigger.type}
                          onChange={e => updateEffect(idx, { ...effect, trigger: { ...effect.trigger, type: e.target.value as TriggerType, params: {} } })}
                          className="w-full bg-transparent border-none text-sm outline-none font-bold text-slate-200"
                        >
                          {Object.values(TriggerType).map(t => <option key={t} value={t} className="bg-slate-900">{t}</option>)}
                        </select>
                      </div>

                      {/* Sub-parameters for ON_ACTIVATION */}
                      {effect.trigger.type === TriggerType.ON_ACTIVATION && (
                        <div className="pl-4 border-l-2 border-indigo-500/30 space-y-3 pt-2 animate-in fade-in slide-in-from-left-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Target Type</label>
                              <select 
                                value={effect.trigger.params?.targetCardType || ""}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, targetCardType: e.target.value || undefined } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="">Any Card</option>
                                <option value={CardType.MONSTER}>Monster Card</option>
                                <option value={CardType.SPELL}>Spell Card</option>
                              </select>
                            </div>
                            <div>
                               <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Who?</label>
                               <select 
                                 value={effect.trigger.params?.activationWho || "SELF"}
                                 onChange={e => updateEffect(idx, { 
                                   ...effect, 
                                   trigger: { ...effect.trigger, params: { ...effect.trigger.params, activationWho: e.target.value } } 
                                 })}
                                 className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                               >
                                 <option value="SELF">You</option>
                                 <option value="OPPONENT">Opponent</option>
                                 <option value="ANY">Anyone</option>
                               </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Card Filter [Name]</label>
                            <input 
                              value={effect.trigger.params?.filterName || ""}
                              onChange={e => updateEffect(idx, { 
                                ...effect, 
                                trigger: { ...effect.trigger, params: { ...effect.trigger.params, filterName: e.target.value } } 
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                              placeholder="Ex: Cyber"
                            />
                          </div>
                        </div>
                      )}

                      {/* Sub-parameters for ON_SUMMON */}
                      {effect.trigger.type === TriggerType.ON_SUMMON && (
                        <div className="pl-4 border-l-2 border-indigo-500/30 space-y-3 pt-2 animate-in fade-in slide-in-from-left-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Who Summons?</label>
                              <select 
                                value={effect.trigger.params?.summonWho || "SELF"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, summonWho: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="SELF">You</option>
                                <option value="OPPONENT">Opponent</option>
                                <option value="ANY">Anyone</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Summon Method</label>
                              <select 
                                value={effect.trigger.params?.summonMethod || "ANY"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, summonMethod: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="ANY">Any</option>
                                <option value="NORMAL">Normal</option>
                                <option value="SPECIAL">Special</option>
                                <option value="FLIP">Flip</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Card Filter [Name]</label>
                            <input 
                              value={effect.trigger.params?.filterName || ""}
                              onChange={e => updateEffect(idx, { 
                                ...effect, 
                                trigger: { ...effect.trigger, params: { ...effect.trigger.params, filterName: e.target.value } } 
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 outline-none"
                              placeholder="Ex: Cyber"
                            />
                          </div>
                        </div>
                      )}

                      {/* Sub-parameters for ON_SEND_TO_GY */}
                      {effect.trigger.type === TriggerType.ON_SEND_TO_GY && (
                        <div className="pl-4 border-l-2 border-red-500/30 space-y-3 pt-2 animate-in fade-in slide-in-from-left-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={effect.trigger.params?.isSelf || false}
                              onChange={e => updateEffect(idx, { 
                                ...effect, 
                                trigger: { ...effect.trigger, params: { ...effect.trigger.params, isSelf: e.target.checked } } 
                              })}
                              className="w-3 h-3 rounded bg-slate-950 border-slate-800 accent-red-500"
                            />
                            <span className="text-[10px] font-bold text-slate-300 uppercase">Self Target? (This Card)</span>
                          </label>

                          {!effect.trigger.params?.isSelf && (
                            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-left-2">
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Target Type</label>
                                <select 
                                  value={effect.trigger.params?.targetCardType || ""}
                                  onChange={e => updateEffect(idx, { 
                                    ...effect, 
                                    trigger: { ...effect.trigger, params: { ...effect.trigger.params, targetCardType: e.target.value || undefined } } 
                                  })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                                >
                                  <option value="">Any Card</option>
                                  <option value={CardType.MONSTER}>Monster Card</option>
                                  <option value={CardType.SPELL}>Spell Card</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Who?</label>
                                <select 
                                  value={effect.trigger.params?.sendWho || "SELF"}
                                  onChange={e => updateEffect(idx, { 
                                    ...effect, 
                                    trigger: { ...effect.trigger, params: { ...effect.trigger.params, sendWho: e.target.value } } 
                                  })}
                                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                                >
                                  <option value="SELF">You</option>
                                  <option value="OPPONENT">Opponent</option>
                                  <option value="ANY">Anyone</option>
                                </select>
                              </div>
                            </div>
                          )}

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">From Where?</label>
                              <select 
                                value={effect.trigger.params?.sendFrom || "ANY"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, sendFrom: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="ANY">Anywhere</option>
                                <option value="HAND">Hand</option>
                                <option value="FIELD">Field</option>
                                <option value="DECK">Deck</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Send Method</label>
                              <select 
                                value={effect.trigger.params?.sendMethod || "ANY"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, sendMethod: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="ANY">Any</option>
                                <option value="BATTLE">Destroyed by Battle</option>
                                <option value="EFFECT">Destroyed by Effect</option>
                                <option value="COST">Sent as Cost</option>
                              </select>
                            </div>
                          </div>

                          {!effect.trigger.params?.isSelf && (
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Card Filter [Name]</label>
                              <input 
                                value={effect.trigger.params?.filterName || ""}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, filterName: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 outline-none focus:border-red-500"
                                placeholder="Ex: Cyber"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {effect.trigger.type === TriggerType.ON_DRAW && (
                        <div className="pl-4 border-l-2 border-emerald-500/30 space-y-3 pt-2 animate-in fade-in slide-in-from-left-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Who Draws?</label>
                              <select 
                                value={effect.trigger.params?.drawWho || "SELF"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, drawWho: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="SELF">You</option>
                                <option value="OPPONENT">Opponent</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Draw Method</label>
                              <select 
                                value={effect.trigger.params?.drawMethod || "ANY"}
                                onChange={e => updateEffect(idx, { 
                                  ...effect, 
                                  trigger: { ...effect.trigger, params: { ...effect.trigger.params, drawMethod: e.target.value } } 
                                })}
                                className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                              >
                                <option value="ANY">Any</option>
                                <option value="PHASE">Draw Phase</option>
                                <option value="EFFECT">Card Effect</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Specific Name Filter</label>
                            <input 
                              value={effect.trigger.params?.filterName || ""}
                              onChange={e => updateEffect(idx, { 
                                ...effect, 
                                trigger: { ...effect.trigger, params: { ...effect.trigger.params, filterName: e.target.value } } 
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
                              placeholder="Ex: Cyber"
                            />
                          </div>
                        </div>
                      )}

                      {effect.trigger.type === TriggerType.ON_ATTACK && (
                        <div className="pl-4 border-l-2 border-amber-500/30 space-y-3 pt-2 animate-in fade-in slide-in-from-left-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Attack Scenario</label>
                            <select 
                              value={effect.trigger.params?.attackType || "ANY"}
                              onChange={e => updateEffect(idx, { 
                                ...effect, 
                                trigger: { 
                                  ...effect.trigger, 
                                  params: { ...effect.trigger.params, attackType: e.target.value } 
                                } 
                              })}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                            >
                              <option value="ANY">Any monster declares attack</option>
                              <option value="SELF">This card declares attack</option>
                              <option value="BEING_ATTACKED">This card is attacked</option>
                              <option value="CONTROLLED">Your monster is attacked</option>
                              <option value="OPPONENT">Enemy monster is attacked</option>
                              <option value="DIRECT">Direct attack</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Restriction */}
                    <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-amber-400 uppercase">
                        <Target className="w-3 h-3" /> State & Summon Restriction
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Active Location</label>
                          <select 
                            value={effect.restriction.locations[0]}
                            onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, locations: [e.target.value as CardLocation] } })}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                          >
                            {Object.values(CardLocation).map(l => <option key={l} value={l}>{l}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Frequency</label>
                          <select 
                            value={effect.restriction.frequency}
                            onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, frequency: e.target.value as FrequencyType } })}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                          >
                            {Object.values(FrequencyType).map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Required Position</label>
                          <select 
                            value={effect.restriction.mustBePosition || ""}
                            onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, mustBePosition: (e.target.value as any) || undefined } })}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                          >
                            <option value="">Any</option>
                            <option value="ATTACK">Attack Mode</option>
                            <option value="DEFENSE">Defense Mode</option>
                            <option value="FACE_UP">Face-up</option>
                            <option value="FACE_DOWN">Face-down</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Summon Restriction</label>
                          <select 
                            value={effect.restriction.summonRestriction || "NONE"}
                            onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, summonRestriction: (e.target.value as any) } })}
                            className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                          >
                            <option value="NONE">None</option>
                            <option value="ONLY_SPECIAL">Cannot be Normal</option>
                            <option value="ONLY_NORMAL">Cannot be Special</option>
                            <option value="CANNOT_SUMMON">Cannot be Summoned</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions (COST & RESOLUTION) */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase">
                      <Coins className="w-3 h-3" /> Costs & Resolutions
                    </div>
                    <div className="flex gap-2 items-center text-xs">
                      <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded">PAY_LP(500)</span>
                      <ArrowRightIcon className="w-3 h-3 text-slate-700" />
                      <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">DRAW(2)</span>
                    </div>
                  </div>
                </div>
              ))}
              {card.effects.length === 0 && (
                <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
                  <Plus className="w-8 h-8 mb-2 opacity-20" />
                  <p className="text-xs uppercase tracking-widest font-bold">No Logic Branches Yet</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ArrowRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
  </svg>
);
