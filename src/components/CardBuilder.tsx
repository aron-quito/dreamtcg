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

const useDynamicFontSize = (card: any) => {
  const [fontSize, setFontSize] = React.useState(10);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Reset font size when ANY part of the card changes, then we shrink if needed
  React.useEffect(() => {
    setFontSize(10);
  }, [card.name, card.description, card.effects, card.type]);

  React.useLayoutEffect(() => {
    const checkOverflow = () => {
      const el = containerRef.current;
      if (!el) return;

      // We use a small buffer (+1) to avoid flickering
      const isOverflowing = el.scrollHeight > el.clientHeight + 1;
      
      if (isOverflowing && fontSize > 4) {
        // Decrease font size iteratively until it fits
        setFontSize(f => f - 0.2);
      }
    };

    // Delay slightly to ensure browser has painted
    const timeoutId = setTimeout(checkOverflow, 10);
    return () => clearTimeout(timeoutId);
  }, [card, fontSize]);

  return { fontSize, containerRef };
};

const COST_OPTIONS = [
  { value: "DISCARD", label: "Discard Card(s)", params: ["n"] },
  { value: "DESTROY_OWN", label: "Destroy Own Card(s)", params: ["n"] },
  { value: "PAY_LP", label: "Pay Life Points", params: ["n"] },
  { value: "BANISH_OWN", label: "Banish Own Card(s)", params: ["n"] },
  { value: "SEND_TO_GY", label: "Send to GY", params: ["n"] },
  { value: "TRIBUTE", label: "Tribute Monster(s)", params: ["n"] },
  { value: "REVEAL_HAND", label: "Reveal Hand Card(s)", params: ["n"] },
];

const RESOLUTION_OPTIONS = [
  { value: "DRAW", label: "Draw Card(s)", params: ["n"] },
  { value: "DESTROY_ENEMY", label: "Destroy Enemy Card(s)", params: ["n"] },
  { value: "ADD_TO_HAND", label: "Add from Deck to Hand", params: ["n"] },
  { value: "DEAL_DAMAGE", label: "Deal Effect Damage", params: ["n"] },
  { value: "HEAL_LP", label: "Heal Life Points", params: ["n"] },
  { value: "SUMMON_FROM_DECK", label: "Summon from Deck", params: ["n"] },
  { value: "BANISH_ENEMY", label: "Banish Enemy Card(s)", params: ["n"] },
];

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

const renderCostText = (cost: any): string => {
  const n = cost.params.n || 1;
  const filter = cost.params.filter || {};
  
  const attrMap: Record<string, string> = {
    "DARK": "OSCURIDAD", "LIGHT": "LUZ", "EARTH": "TIERRA", 
    "WATER": "AGUA", "FIRE": "FUEGO", "WIND": "VIENTO"
  };

  let targetStr = "carta";
  if (filter.targetType === "MONSTER") targetStr = "monstruo";
  if (filter.targetType === "SPELL") targetStr = "carta de Hechizo";

  const details = [];
  if (filter.cardName) details.push(`"${filter.cardName}"`);
  if (filter.attribute && filter.attribute !== "ANY") details.push(`de ${attrMap[filter.attribute] || filter.attribute}`);
  if (filter.minAtk) details.push(`con ${filter.minAtk}+ ATK`);
  if (filter.maxAtk) details.push(`con ${filter.maxAtk}- ATK`);
  if (filter.minLevel) details.push(`de Nivel ${filter.minLevel}+`);
  if (filter.maxLevel) details.push(`de Nivel ${filter.maxLevel}-`);

  const fullTarget = `${targetStr}${n > 1 ? "s" : ""} ${details.join(" ")}`.trim();

  switch (cost.action) {
    case "DISCARD": return `Descarta ${n} ${fullTarget}`;
    case "DESTROY_OWN": return `Destruye ${n} ${fullTarget} que controles`;
    case "PAY_LP": return `Paga ${n} LP`;
    case "BANISH_OWN": return `Destierra ${n} ${fullTarget} de tu posesión`;
    case "SEND_TO_GY": return `Envía ${n} ${fullTarget} al Cementerio`;
    case "TRIBUTE": return `Sacrifica ${n} ${fullTarget}`;
    case "REVEAL_HAND": return `Revela ${n} ${fullTarget} en tu mano`;
    default: return `${cost.action}(${n})`;
  }
};

const renderResolutionText = (res: any): string => {
  const n = res.params.n || 1;
  const filter = res.params.filter || {};
  
  const attrMap: Record<string, string> = {
    "DARK": "OSCURIDAD", "LIGHT": "LUZ", "EARTH": "TIERRA", 
    "WATER": "AGUA", "FIRE": "FUEGO", "WIND": "VIENTO"
  };

  let targetStr = "carta";
  if (filter.targetType === "MONSTER") targetStr = "monstruo";
  if (filter.targetType === "SPELL") targetStr = "carta de Hechizo";

  const details = [];
  if (filter.cardName) details.push(`"${filter.cardName}"`);
  if (filter.attribute && filter.attribute !== "ANY") details.push(`de ${attrMap[filter.attribute] || filter.attribute}`);
  if (filter.minAtk) details.push(`con ${filter.minAtk}+ ATK`);
  if (filter.maxAtk) details.push(`con ${filter.maxAtk}- ATK`);
  if (filter.minLevel) details.push(`de Nivel ${filter.minLevel}+`);
  if (filter.maxLevel) details.push(`de Nivel ${filter.maxLevel}-`);

  const fullTarget = `${targetStr}${n > 1 ? "s" : ""} ${details.join(" ")}`.trim();

  switch (res.action) {
    case "DRAW": return `Roba ${n} carta${n > 1 ? "s" : ""}`;
    case "DESTROY_ENEMY": return `Destruye ${n} ${fullTarget} del oponente`;
    case "ADD_TO_HAND": return `Añade ${n} ${fullTarget} del Deck a tu mano`;
    case "DEAL_DAMAGE": return `Inflige ${n} puntos de daño al oponente`;
    case "HEAL_LP": return `Recupera ${n} LP`;
    case "SUMMON_FROM_DECK": return `Invoca ${n} ${fullTarget} desde el Deck`;
    case "BANISH_ENEMY": return `Destierra ${n} ${fullTarget} del oponente`;
    default: return `${res.action}(${n})`;
  }
};

interface CardBuilderProps {
  onSave: (card: CardDefinition) => void;
  initialCard?: CardDefinition;
}

export const CardBuilder: React.FC<CardBuilderProps> = ({ onSave, initialCard }) => {
  const [card, setCard] = useState<CardDefinition>(initialCard || {
    id: crypto.randomUUID(),
    name: "",
    type: CardType.MONSTER,
    description: "",
    effects: [],
    level: undefined,
    atk: undefined,
    def: undefined,
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

  const { fontSize: effectFontSize, containerRef: effectsContainerRef } = useDynamicFontSize(card);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-4">
      {/* Visual Preview */}
      <div className="space-y-4 flex flex-col items-center">
        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Card Preview (Scale 1.5x)</h3>
        
        {/* Card Container with fixed aspect ratio 63:88 and expanded size */}
        <div 
          className="bg-slate-900 border border-slate-800 rounded-[3%] shadow-2xl relative overflow-hidden flex flex-col"
          style={{ width: '350px', height: '488px', padding: '15px' }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500" />
          
          {/* Header */}
          <div className="flex justify-between items-center mb-1">
            <h4 className="text-lg font-black uppercase tracking-tighter text-white truncate max-w-[80%] drop-shadow-md">
              {card.name || "Unnamed Card"}
            </h4>
            <span className="text-[10px] font-bold bg-slate-800 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded shadow-inner shrink-0">
              {card.attribute}
            </span>
          </div>

          {/* Image Area with Level Badge */}
          <div className="w-full h-[150px] bg-slate-800 rounded-sm mb-3 flex items-center justify-center border border-slate-700/50 shadow-inner overflow-hidden relative shrink-0">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-950/20" />
            <Settings className="w-12 h-12 text-slate-700 opacity-20" />
            
            {/* New Level Badge - Single Circle with Number */}
            {card.type === CardType.MONSTER && (
              <div className="absolute top-2 right-2 flex items-center justify-center">
                <div className="w-8 h-8 bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 rounded-full border-2 border-amber-900 shadow-lg flex items-center justify-center transform hover:scale-110 transition-transform">
                  <span className="text-black font-black text-sm drop-shadow-sm">{card.level || 1}</span>
                </div>
              </div>
            )}
          </div>

          {/* Description & Effects Area with Dynamic Shrink */}
          <div className="flex-1 bg-slate-950/40 rounded-sm p-3 border border-slate-800/50 shadow-inner overflow-hidden flex flex-col">
            <p className="text-[9px] text-slate-500 italic leading-tight border-b border-slate-800/50 pb-2 mb-2">
              {card.description || "Enter card lore..."}
            </p>
            
            {/* Dynamic Effects List with Ref for Shrinking */}
            <div 
              ref={effectsContainerRef}
              className="flex-1 space-y-2 overflow-hidden scrollbar-hide" 
              style={{ fontSize: `${effectFontSize}px` }}
            >
              {card.effects.map((eff, i) => (
                <div key={i} className="space-y-1 animate-in fade-in slide-in-from-bottom-1 border-b border-slate-800/30 last:border-0 pb-2">
                  <div className="text-indigo-400 font-black uppercase tracking-tighter" style={{ fontSize: `${effectFontSize + 1}px` }}>
                    EFECTO {i + 1}:
                  </div>
                  <div className="flex gap-2 items-baseline">
                    <span className="text-slate-500 font-bold uppercase shrink-0" style={{ fontSize: `${effectFontSize - 2}px` }}>Trigger:</span>
                    <span className="text-slate-200 leading-[1.2]">{renderTriggerText(eff.trigger)}</span>
                  </div>
                  <div className="flex gap-2 items-baseline">
                    <span className="text-amber-500/80 font-bold uppercase shrink-0" style={{ fontSize: `${effectFontSize - 2}px` }}>Condition:</span>
                    <span className="text-slate-300 leading-[1.2]">{renderRestrictionText(eff.restriction)}</span>
                  </div>
                  {eff.costs.length > 0 && (
                    <div className="flex gap-2 items-baseline">
                      <span className="text-red-500/80 font-bold uppercase shrink-0" style={{ fontSize: `${effectFontSize - 2}px` }}>Cost:</span>
                      <span className="text-red-100 leading-[1.2]">{eff.costs.map(c => renderCostText(c)).join(", ")}</span>
                    </div>
                  )}
                  {eff.resolutions.length > 0 && (
                    <div className="flex gap-2 items-baseline">
                      <span className="text-emerald-500/80 font-bold uppercase shrink-0" style={{ fontSize: `${effectFontSize - 2}px` }}>Result:</span>
                      <span className="text-emerald-100 leading-[1.2]">{eff.resolutions.map(r => renderResolutionText(r)).join(", ")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom Stats */}
          {card.type === CardType.MONSTER && (
            <div className="flex justify-between items-center font-mono border-t border-slate-800 mt-2 pt-2 text-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-[10px]">ATK /</span>
                <span className="text-white font-black text-lg tracking-widest">{card.atk}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-bold text-[10px]">DEF /</span>
                <span className="text-white font-black text-lg tracking-widest">{card.def}</span>
              </div>
            </div>
          )}
        </div>

        <button 
          onClick={() => onSave(card)}
          className="w-[350px] py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Save className="w-5 h-5" /> Save Card Definition
        </button>
      </div>

      {/* Editor Form */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2 col-span-2">
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
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Attribute</label>
              <select 
                value={card.attribute}
                onChange={e => setCard({...card, attribute: e.target.value as CardAttribute})}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200"
              >
                {Object.values(CardAttribute).map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {card.type === CardType.MONSTER && (
            <div className="grid grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Level</label>
                <input 
                  type="number"
                  value={card.level ?? ""}
                  onChange={e => setCard({...card, level: e.target.value === "" ? undefined : parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 outline-none"
                  min="1" max="12"
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-red-500/50 uppercase">Attack (ATK)</label>
                <input 
                  type="number"
                  value={card.atk ?? ""}
                  onChange={e => setCard({...card, atk: e.target.value === "" ? undefined : parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-red-400 font-bold outline-none focus:border-red-500"
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-indigo-500/50 uppercase">Defense (DEF)</label>
                <input 
                  type="number"
                  value={card.def ?? ""}
                  onChange={e => setCard({...card, def: e.target.value === "" ? undefined : parseInt(e.target.value)})}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-indigo-400 font-bold outline-none focus:border-indigo-500"
                  placeholder="0"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Description / Lore</label>
            <textarea 
              value={card.description}
              onChange={e => setCard({...card, description: e.target.value})}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-400 text-xs min-h-[80px] outline-none focus:border-slate-700"
              placeholder="Enter lore or additional info..."
            />
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

                      {/* Conditional logic for Position and Summon Restrictions */}
                      {![CardLocation.GY, CardLocation.REMOVED, CardLocation.EXTRA_DECK, CardLocation.DECK].includes(effect.restriction.locations[0]) && (
                        <div className="grid grid-cols-2 gap-2 mt-3 animate-in fade-in slide-in-from-top-1">
                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Required Position</label>
                            <select 
                              value={effect.restriction.mustBePosition || ""}
                              onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, mustBePosition: (e.target.value as any) || undefined } })}
                              className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-xs text-slate-300"
                            >
                              <option value="">Any</option>
                              {/* Attack/Defense only make sense in Monster Zone */}
                              {effect.restriction.locations[0] === CardLocation.MONSTER_ZONE && (
                                <>
                                  <option value="ATTACK">Attack Mode</option>
                                  <option value="DEFENSE">Defense Mode</option>
                                </>
                              )}
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
                      )}
                    </div>
                  </div>

                  {/* Actions (COST & RESOLUTION) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
                    {/* Costs Editor */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-red-400 uppercase">
                          <Coins className="w-3 h-3" /> Costs (Mandatory)
                        </div>
                        <button 
                          onClick={() => {
                            const newCosts = [...effect.costs, { action: "PAY_LP", params: { n: 500 } }];
                            updateEffect(idx, { ...effect, costs: newCosts });
                          }}
                          className="text-[9px] bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white px-2 py-1 rounded transition-all"
                        >
                          + Add Cost
                        </button>
                      </div>
                      <div className="space-y-2">
                        {effect.costs.map((cost, cIdx) => (
                          <div key={cIdx} className="space-y-2 animate-in slide-in-from-right-1">
                            <div className="flex gap-2 items-center bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                              <select 
                                value={cost.action}
                                onChange={e => {
                                  const newCosts = [...effect.costs];
                                  newCosts[cIdx] = { ...cost, action: e.target.value };
                                  updateEffect(idx, { ...effect, costs: newCosts });
                                }}
                                className="bg-transparent text-[11px] font-bold text-slate-300 outline-none flex-1"
                              >
                                {COST_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>)}
                              </select>
                              <input 
                                type="number"
                                value={cost.params.n}
                                onChange={e => {
                                  const newCosts = [...effect.costs];
                                  newCosts[cIdx] = { ...cost, params: { ...cost.params, n: parseInt(e.target.value) || 0 } };
                                  updateEffect(idx, { ...effect, costs: newCosts });
                                }}
                                className="w-12 bg-slate-950 border border-slate-800 rounded px-1 text-center text-[11px] text-indigo-400 font-bold"
                              />
                              <button 
                                onClick={() => {
                                  const newCosts = effect.costs.filter((_, i) => i !== cIdx);
                                  updateEffect(idx, { ...effect, costs: newCosts });
                                }}
                                className="text-slate-600 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Filter Sub-Editor */}
                            {cost.action !== "PAY_LP" && (
                              <div className="pl-2 pr-2 pb-2 bg-slate-900/20 rounded-b-lg border-x border-b border-slate-800/50 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Target Type</label>
                                  <select 
                                    value={cost.params.filter?.targetType || ""}
                                    onChange={e => {
                                      const newCosts = [...effect.costs];
                                      newCosts[cIdx] = { ...cost, params: { ...cost.params, filter: { ...cost.params.filter, targetType: e.target.value } } };
                                      updateEffect(idx, { ...effect, costs: newCosts });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                  >
                                    <option value="">Any</option>
                                    <option value="MONSTER">Monster</option>
                                    <option value="SPELL">Spell</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Attribute</label>
                                  <select 
                                    value={cost.params.filter?.attribute || ""}
                                    onChange={e => {
                                      const newCosts = [...effect.costs];
                                      newCosts[cIdx] = { ...cost, params: { ...cost.params, filter: { ...cost.params.filter, attribute: e.target.value } } };
                                      updateEffect(idx, { ...effect, costs: newCosts });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                  >
                                    <option value="">Any</option>
                                    {Object.values(CardAttribute).map(a => <option key={a} value={a}>{a}</option>)}
                                  </select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <input 
                                    placeholder="Filter by Card Name..."
                                    type="text"
                                    value={cost.params.filter?.cardName || ""}
                                    onChange={e => {
                                      const newCosts = [...effect.costs];
                                      newCosts[cIdx] = { ...cost, params: { ...cost.params, filter: { ...cost.params.filter, cardName: e.target.value } } };
                                      updateEffect(idx, { ...effect, costs: newCosts });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400 outline-none focus:border-indigo-500"
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      placeholder="Min ATK"
                                      type="number"
                                      value={cost.params.filter?.minAtk || ""}
                                      onChange={e => {
                                        const newCosts = [...effect.costs];
                                        newCosts[cIdx] = { ...cost, params: { ...cost.params, filter: { ...cost.params.filter, minAtk: parseInt(e.target.value) || undefined } } };
                                        updateEffect(idx, { ...effect, costs: newCosts });
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                    />
                                    <input 
                                      placeholder="Max Level"
                                      type="number"
                                      value={cost.params.filter?.maxLevel || ""}
                                      onChange={e => {
                                        const newCosts = [...effect.costs];
                                        newCosts[cIdx] = { ...cost, params: { ...cost.params, filter: { ...cost.params.filter, maxLevel: parseInt(e.target.value) || undefined } } };
                                        updateEffect(idx, { ...effect, costs: newCosts });
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Resolutions Editor */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-400 uppercase">
                          <PlayCircle className="w-3 h-3" /> Resolutions (Result)
                        </div>
                        <button 
                          onClick={() => {
                            const newRes = [...effect.resolutions, { action: "DRAW", params: { n: 1 } }];
                            updateEffect(idx, { ...effect, resolutions: newRes });
                          }}
                          className="text-[9px] bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white px-2 py-1 rounded transition-all"
                        >
                          + Add Action
                        </button>
                      </div>
                      <div className="space-y-2">
                        {effect.resolutions.map((res, rIdx) => (
                          <div key={rIdx} className="space-y-2 animate-in slide-in-from-right-1">
                            <div className="flex gap-2 items-center bg-slate-900/50 p-2 rounded-lg border border-slate-800">
                              <select 
                                value={res.action}
                                onChange={e => {
                                  const newRes = [...effect.resolutions];
                                  newRes[rIdx] = { ...res, action: e.target.value };
                                  updateEffect(idx, { ...effect, resolutions: newRes });
                                }}
                                className="bg-transparent text-[11px] font-bold text-slate-300 outline-none flex-1"
                              >
                                {RESOLUTION_OPTIONS.map(opt => <option key={opt.value} value={opt.value} className="bg-slate-900">{opt.label}</option>)}
                              </select>
                              <input 
                                type="number"
                                value={res.params.n}
                                onChange={e => {
                                  const newRes = [...effect.resolutions];
                                  newRes[rIdx] = { ...res, params: { ...res.params, n: parseInt(e.target.value) || 0 } };
                                  updateEffect(idx, { ...effect, resolutions: newRes });
                                }}
                                className="w-12 bg-slate-950 border border-slate-800 rounded px-1 text-center text-[11px] text-emerald-400 font-bold"
                              />
                              <button 
                                onClick={() => {
                                  const newRes = effect.resolutions.filter((_, i) => i !== rIdx);
                                  updateEffect(idx, { ...effect, resolutions: newRes });
                                }}
                                className="text-slate-600 hover:text-red-400"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                            {/* Filter Sub-Editor for Resolutions */}
                            {["DESTROY_ENEMY", "ADD_TO_HAND", "SUMMON_FROM_DECK", "BANISH_ENEMY"].includes(res.action) && (
                              <div className="pl-2 pr-2 pb-2 bg-slate-900/20 rounded-b-lg border-x border-b border-slate-800/50 grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Target Type</label>
                                  <select 
                                    value={res.params.filter?.targetType || ""}
                                    onChange={e => {
                                      const newRes = [...effect.resolutions];
                                      newRes[rIdx] = { ...res, params: { ...res.params, filter: { ...res.params.filter, targetType: e.target.value } } };
                                      updateEffect(idx, { ...effect, resolutions: newRes });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                  >
                                    <option value="">Any</option>
                                    <option value="MONSTER">Monster</option>
                                    <option value="SPELL">Spell</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">Attribute</label>
                                  <select 
                                    value={res.params.filter?.attribute || ""}
                                    onChange={e => {
                                      const newRes = [...effect.resolutions];
                                      newRes[rIdx] = { ...res, params: { ...res.params, filter: { ...res.params.filter, attribute: e.target.value } } };
                                      updateEffect(idx, { ...effect, resolutions: newRes });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                  >
                                    <option value="">Any</option>
                                    {Object.values(CardAttribute).map(a => <option key={a} value={a}>{a}</option>)}
                                  </select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                  <input 
                                    placeholder="Filter by Card Name..."
                                    type="text"
                                    value={res.params.filter?.cardName || ""}
                                    onChange={e => {
                                      const newRes = [...effect.resolutions];
                                      newRes[rIdx] = { ...res, params: { ...res.params, filter: { ...res.params.filter, cardName: e.target.value } } };
                                      updateEffect(idx, { ...effect, resolutions: newRes });
                                    }}
                                    className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400 outline-none focus:border-emerald-500"
                                  />
                                  <div className="flex gap-2">
                                    <input 
                                      placeholder="Max ATK"
                                      type="number"
                                      value={res.params.filter?.maxAtk || ""}
                                      onChange={e => {
                                        const newRes = [...effect.resolutions];
                                        newRes[rIdx] = { ...res, params: { ...res.params, filter: { ...res.params.filter, maxAtk: parseInt(e.target.value) || undefined } } };
                                        updateEffect(idx, { ...effect, resolutions: newRes });
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                    />
                                    <input 
                                      placeholder="Min Level"
                                      type="number"
                                      value={res.params.filter?.minLevel || ""}
                                      onChange={e => {
                                        const newRes = [...effect.resolutions];
                                        newRes[rIdx] = { ...res, params: { ...res.params, filter: { ...res.params.filter, minLevel: parseInt(e.target.value) || undefined } } };
                                        updateEffect(idx, { ...effect, resolutions: newRes });
                                      }}
                                      className="flex-1 bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-400"
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
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
