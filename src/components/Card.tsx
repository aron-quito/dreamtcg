import React from 'react';
import { Package } from 'lucide-react';
import { CardDefinition, CardType, TriggerType, CardLocation, FrequencyType, CardEffect } from '../types';

// --- HELPER TRANSLATIONS ---

const LOC_MAP: Record<string, string> = {
  [CardLocation.HAND]: "la Mano",
  [CardLocation.DECK]: "el Deck",
  [CardLocation.MONSTER_ZONE]: "el Campo",
  [CardLocation.SPELL_ZONE]: "la Zona de Hechizos",
  [CardLocation.GY]: "el Cementerio",
  [CardLocation.REMOVED]: "el Destierro"
};

const FREQ_MAP: Record<string, string> = {
  [FrequencyType.UNLIMITED]: "Sin límite",
  [FrequencyType.ONCE_PER_TURN]: "1 vez por turno",
  [FrequencyType.ONCE_PER_DUEL]: "1 vez por duelo",
  [FrequencyType.CONTINUOUS]: "Efecto Permanente"
};

const POS_MAP: Record<string, string> = {
  "ATTACK": "en Posición de Ataque",
  "DEFENSE": "en Posición de Defensa",
  "FACE_UP": "Boca Arriba",
  "FACE_DOWN": "Boca Abajo"
};

const ATTR_MAP: Record<string, string> = {
  "DARK": "OSCURIDAD", "LIGHT": "LUZ", "EARTH": "TIERRA", 
  "WATER": "AGUA", "FIRE": "FUEGO", "WIND": "VIENTO"
};

const ATTRIBUTE_STYLES: Record<string, { bg: string, text: string, border: string }> = {
  "DARK": { bg: "bg-purple-950/40", text: "text-purple-400", border: "border-purple-500/50" },
  "LIGHT": { bg: "bg-yellow-950/40", text: "text-yellow-200", border: "border-yellow-400/50" },
  "FIRE": { bg: "bg-red-950/40", text: "text-orange-400", border: "border-orange-500/50" },
  "WATER": { bg: "bg-blue-950/40", text: "text-blue-400", border: "border-blue-500/50" },
  "EARTH": { bg: "bg-amber-950/40", text: "text-amber-600", border: "border-amber-800/50" },
  "WIND": { bg: "bg-emerald-950/40", text: "text-green-400", border: "border-green-500/50" },
};

const renderFilterText = (filter: any, n: number) => {
  if (!filter) return "carta(s)";
  let targetStr = "carta";
  if (filter.targetType === "MONSTER") targetStr = "monstruo";
  if (filter.targetType === "SPELL") targetStr = "carta de Hechizo";

  const details = [];
  if (filter.cardName) details.push(`"${filter.cardName}"`);
  if (filter.attribute && filter.attribute !== "ANY") details.push(`de atributo ${ATTR_MAP[filter.attribute] || filter.attribute}`);
  if (filter.minAtk) details.push(`con ${filter.minAtk}+ ATK`);
  if (filter.maxAtk) details.push(`con ${filter.maxAtk}- ATK`);
  if (filter.minLevel) details.push(`de Nivel ${filter.minLevel}+`);
  if (filter.maxLevel) details.push(`de Nivel ${filter.maxLevel}-`);

  return `${targetStr}${n > 1 ? "s" : ""} ${details.join(" ")}`.trim();
};

const renderTriggerText = (trigger: any) => {
  const params = trigger.params || {};
  switch (trigger.type) {
    case TriggerType.ANY_TIME: return "Cualquier momento (Efecto Rápido)";
    case TriggerType.ON_ACTIVATION: {
      const who = params.activationWho === "OPPONENT" ? "el Oponente" : (params.activationWho === "ANY" ? "cualquier jugador" : "tú");
      const target = params.targetCardType === CardType.MONSTER ? "un efecto de Monstruo" : (params.targetCardType === CardType.SPELL ? "una carta de Hechizo" : "una carta");
      const name = params.filterName ? ` [${params.filterName}]` : "";
      return `Cuando ${who} activa${who === "tú" ? "s" : ""} ${target}${name}`;
    }
    case TriggerType.ON_SUMMON: {
      const who = params.summonWho === "OPPONENT" ? "el oponente" : (params.summonWho === "ANY" ? "cualquier jugador" : "tú");
      const method = params.summonMethod === "SPECIAL" ? "de Modo Especial" : (params.summonMethod === "NORMAL" ? "de Modo Normal" : (params.summonMethod === "FLIP" ? "por Volteo" : ""));
      const target = params.targetCardType === CardType.MONSTER ? "un monstruo" : "una carta";
      const name = params.filterName ? ` [${params.filterName}]` : "";
      if (params.summonWho === "ANY") return `Al ser Invocad${target === "un monstruo" ? "o" : "a"} ${method} ${target} ${name}`;
      return `Cuando ${who} Invoca${who === "tú" ? "s" : ""} ${method} ${target} ${name}`;
    }
    case TriggerType.ON_DRAW: {
      const who = params.drawWho === "OPPONENT" ? "el oponente" : "tú";
      const method = params.drawMethod === "EFFECT" ? "por efecto" : (params.drawMethod === "PHASE" ? "en Draw Phase" : "");
      return `Cuando ${who} rob${who === "tú" ? "as" : "a"} una carta ${method}${params.filterName ? ` [${params.filterName}]` : ""}`;
    }
    case TriggerType.ON_ATTACK: {
      switch (params.attackType) {
        case "SELF": return "Cuando esta carta declara un ataque";
        case "BEING_ATTACKED": return "Cuando esta carta es atacada";
        case "CONTROLLED": return "Cuando un monstruo que controlas es atacado";
        case "OPPONENT": return "Cuando un monstruo enemigo es atacado";
        case "DIRECT": return "Cuando se declara un ataque directo";
        case "ANY": return "Cuando cualquier monstruo declara un ataque";
        default: return "Cuando se declara un ataque";
      }
    }
    case TriggerType.ON_SEND_TO_GY: {
      const from = params.sendFrom === "HAND" ? "desde la mano" : (params.sendFrom === "DECK" ? "desde el Deck" : (params.sendFrom === "FIELD" ? "desde el Campo" : ""));
      const method = params.sendMethod === "BATTLE" ? "por batalla" : (params.sendMethod === "EFFECT" ? "por efecto" : (params.sendMethod === "COST" ? "como costo" : ""));
      if (params.isSelf) return `Cuando esta carta es enviada al Cementerio ${from} ${method}`.replace(/\s+/g, ' ').trim();
      
      const who = params.sendWho === "OPPONENT" ? "el oponente" : (params.sendWho === "ANY" ? "cualquier jugador" : "tú");
      const target = params.targetCardType === CardType.MONSTER ? "un monstruo" : "una carta";
      return `Cuando ${who} ${who === "tú" ? "envías" : "envía"} ${target}${params.filterName ? ` [${params.filterName}]` : ""} al Cementerio ${from} ${method}`.replace(/\s+/g, ' ').trim();
    }
    default: return trigger.type;
  }
};

const renderRestrictionText = (restr: any) => {
  if (!restr) return '';
  const locs = restr.locations.map((l: any) => LOC_MAP[l] || l).join(", ");
  const freq = FREQ_MAP[restr.frequency] || restr.frequency;
  const pos = restr.mustBePosition ? ` (${POS_MAP[restr.mustBePosition]})` : "";
  let base = ` Solo en ${locs}${pos}. [${freq}]`;

  if (restr.summonRestriction && restr.summonRestriction !== "NONE") {
    const sMap: Record<string, string> = {
      "ONLY_SPECIAL": "No puede ser Invocado de Modo Normal",
      "ONLY_NORMAL": "No puede ser Invocado de Modo Especial",
      "CANNOT_SUMMON": "No puede ser Invocado"
    };
    base += `. ${sMap[restr.summonRestriction]}`;
  }
  return base;
};

const renderCostText = (cost: any) => {
  const n = cost.params.n || 1;
  const filterText = renderFilterText(cost.params.filter, n);
  switch (cost.action) {
    case "DISCARD": return `Descarta ${n} ${filterText}`;
    case "DESTROY_OWN": return `Destruye ${n} ${filterText} que controles`;
    case "PAY_LP": return `Paga ${n} LP`;
    case "BANISH_OWN": return `Destierra ${n} ${filterText} de tu posesión`;
    case "SEND_TO_GY": return `Envía ${n} ${filterText} al Cementerio`;
    case "TRIBUTE": return `Sacrifica ${n} ${filterText}`;
    case "REVEAL_HAND": return `Revela ${n} ${filterText} en tu mano`;
    default: return `${cost.action}(${n})`;
  }
};

const renderResolutionText = (res: any) => {
  const n = res.params.n || 1;
  const filterText = renderFilterText(res.params.filter, n);
  switch (res.action) {
    case "DRAW": return `Roba ${n} carta(s)`;
    case "DESTROY_ENEMY": return `Destuye ${n} ${filterText} del oponente`;
    case "ADD_TO_HAND": return `Añade ${n} ${filterText} del Deck a tu mano`;
    case "DEAL_DAMAGE": return `Inflige ${n} puntos de daño al oponente`;
    case "HEAL_LP": return `Recupera ${n} LP`;
    case "SUMMON_FROM_DECK": return `Invoca ${n} ${filterText} desde el Deck`;
    case "BANISH_ENEMY": return `Destierra ${n} ${filterText} del oponente`;
    default: return `${res.action}(${n})`;
  }
};

interface CardProps {
  card: CardDefinition;
  className?: string;
  isMiniature?: boolean;
  isUltraMiniature?: boolean;
  showStatus?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, className = "", isMiniature = false, isUltraMiniature = false, showStatus = false }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLHeadingElement>(null);
  const [fontSize, setFontSize] = React.useState(10);
  const [nameFontSize, setNameFontSize] = React.useState(isUltraMiniature ? 8 : 14);

  const isMonster = card.type === CardType.MONSTER;
  const attrStyle = ATTRIBUTE_STYLES[card.attribute || "DARK"];

  React.useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el || !el.parentElement) return;

    const updateFontSize = () => {
      const hEl = headerRef.current;
      if (hEl && hEl.parentElement) {
        let nSize = isUltraMiniature ? 8 : (isMiniature ? 10 : 14);
        hEl.style.fontSize = `${nSize}px`;
        while (hEl.scrollWidth > hEl.parentElement.clientWidth && nSize > 6) {
          nSize -= 0.5;
          hEl.style.fontSize = `${nSize}px`;
        }
        setNameFontSize(nSize);
      }

      if (!isMiniature && !isUltraMiniature) {
        const parentRect = el.parentElement!.getBoundingClientRect();
        const availableHeight = parentRect.height - 24; 
        if (availableHeight <= 0) return;

        let currentSize = 10;
        el.style.setProperty('--card-fs', `${currentSize}px`);
        let iterations = 0;
        while (el.scrollHeight > availableHeight && currentSize > 3 && iterations < 50) {
          currentSize -= 0.2;
          el.style.setProperty('--card-fs', `${currentSize}px`);
          iterations++;
        }
        setFontSize(currentSize);
      }
    };

    updateFontSize();
    window.addEventListener('resize', updateFontSize);
    return () => window.removeEventListener('resize', updateFontSize);
  }, [card.effects, card.description, card.name, card.type, isMiniature, isUltraMiniature]);

  return (
    <div 
      className={`relative overflow-hidden flex flex-col aspect-[63/88] cursor-default transition-all duration-500 border-2 rounded-[3.5%] shadow-2xl ${className}
        ${isMonster 
          ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700/50' 
          : 'bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 border-teal-800/50'
        }`}
      style={{ padding: (isMiniature || isUltraMiniature) ? '2%' : '4.2%' }}
    >
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r 
        ${isMonster ? 'from-amber-600 via-yellow-500 to-amber-600' : 'from-teal-500 via-emerald-400 to-teal-500'}`} 
      />
      
      <div className={`flex justify-between items-center ${isUltraMiniature ? 'mb-0' : (isMiniature ? 'mb-[1%]' : 'mb-[2%]')} relative z-10 shrink-0`}>
        <h2 
          ref={headerRef}
          className={`font-black uppercase italic tracking-tighter truncate
            ${isMonster ? 'text-white' : 'text-teal-50'}`}
          style={{ fontSize: `${nameFontSize}px` }}
        >
          {card.name || "UNNAMED CARD"}
        </h2>
        {!isUltraMiniature && (
          <div className={`px-1.5 py-0.5 border rounded-lg font-black uppercase transition-all duration-500 shrink-0
            ${isMiniature ? 'text-[6px]' : 'text-[10px]'}
            ${attrStyle.bg} ${attrStyle.text} ${attrStyle.border}`}>
            {isMiniature ? card.attribute?.slice(0, 3) : card.attribute}
          </div>
        )}
      </div>

      <div className={`w-full bg-slate-950 rounded-sm border border-slate-800/50 relative flex items-center justify-center overflow-hidden shrink-0 
        ${isUltraMiniature ? 'flex-1 mt-0' : (isMiniature ? 'flex-1 mt-1' : 'aspect-video mt-[2%]')}`}>
         {card.image ? (
           <img 
             src={card.image} 
             alt={card.name} 
             className="w-full h-full object-cover transition-none" 
             style={{
               transform: (() => {
                 const adj = isUltraMiniature 
                   ? card.mini2Adjustments 
                   : (isMiniature ? card.mini1Adjustments : card.mainAdjustments);
                 return `translate(${adj?.x || 0}%, ${adj?.y || 0}%) scale(${adj?.zoom || 1})`;
               })(),
               transformOrigin: 'center center'
             }}
           />
         ) : (
           <Package className={`${isUltraMiniature ? 'w-3 h-3' : (isMiniature ? 'w-4 h-4' : 'w-10 h-10')} text-slate-900 opacity-40`} />
         )}
         
         {isMonster && !isUltraMiniature && (
            <div className={`absolute top-1.5 right-1.5 aspect-square bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 rounded-full border-2 border-amber-900/50 flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)] z-20
              ${isMiniature ? 'w-5 h-5 text-[9px]' : 'w-9 h-9 text-base'}
              text-black font-black`}
            >
              {Math.max(1, card.level || 0)}
            </div>
          )}
      </div>

      {!isMiniature && !isUltraMiniature && (
        <div className="mt-[4%] flex-1 bg-slate-950/40 rounded-sm p-3 border border-slate-800/50 overflow-hidden flex flex-col relative min-h-0">
          <div 
            ref={containerRef}
            className="h-full w-full overflow-hidden pr-1"
            style={{ 
              fontSize: 'var(--card-fs, 10px)',
              '--card-fs': `${fontSize}px` 
            } as React.CSSProperties}
          >
            {card.description && (
              <p className="text-slate-500 italic leading-tight mb-3 opacity-80" style={{ fontSize: 'calc(var(--card-fs) * 0.9)' }}>
                {card.description}
              </p>
            )}
            
            <div className="space-y-4">
              {card.effects.map((eff, i) => (
                <div key={i} className="space-y-1.5 border-l border-indigo-500/30 pl-2">
                  <div className="text-indigo-400 font-black uppercase tracking-wider" style={{ fontSize: 'calc(var(--card-fs) * 0.9)' }}>
                    Efecto {i + 1}:
                  </div>
                  <div className="text-slate-300 leading-relaxed" style={{ fontSize: 'var(--card-fs)' }}>
                    <span className="text-indigo-400 font-bold uppercase tracking-wider" style={{ fontSize: 'calc(var(--card-fs) * 0.8)' }}>Activación:</span> {renderTriggerText(eff.trigger)}
                  </div>
                  <div className="text-slate-300 leading-relaxed" style={{ fontSize: 'var(--card-fs)' }}>
                    <span className="text-amber-500 font-bold uppercase tracking-wider" style={{ fontSize: 'calc(var(--card-fs) * 0.8)' }}>Condición:</span> {renderRestrictionText(eff.restriction)}
                  </div>
                  {eff.costs.length > 0 && (
                    <div className="text-red-400/90 leading-relaxed" style={{ fontSize: 'var(--card-fs)' }}>
                      <span className="text-red-500/80 font-bold uppercase tracking-wider" style={{ fontSize: 'calc(var(--card-fs) * 0.8)' }}>Costo:</span> {eff.costs.map(c => renderCostText(c)).join(', ')}
                    </div>
                  )}
                  {eff.resolutions.length > 0 && (
                    <div className="text-emerald-400 leading-relaxed" style={{ fontSize: 'var(--card-fs)' }}>
                      <span className="text-emerald-500 font-bold uppercase tracking-wider" style={{ fontSize: 'calc(var(--card-fs) * 0.8)' }}>Resultado:</span> {eff.resolutions.map(r => renderResolutionText(r)).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!isUltraMiniature && (
        <div className={`flex justify-between items-center font-mono border-t border-slate-800/50 mt-auto pt-1 text-slate-300 shrink-0 relative
          ${!isMonster ? 'justify-center' : ''}`}>
          {isMonster && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold text-[6px] uppercase">Atk</span>
              <span className={`text-white font-black tracking-widest ${isMiniature ? 'text-[8px]' : 'text-sm'}`}>{card.atk ?? 0}</span>
            </div>
          )}
          
          {showStatus && (
            <div className={`flex items-center gap-2 ${isMonster ? 'px-2' : ''}`}>
              <div 
                className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                  card.isPublic 
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] ring-1 ring-emerald-400/20' 
                    : 'bg-slate-700 border border-slate-500'
                }`} 
              />
              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${
                card.limit === 0 ? 'bg-red-500 shadow-red-500/50' : 
                card.limit === 1 ? 'bg-amber-500 shadow-amber-500/50' : 
                card.limit === 2 ? 'bg-blue-500 shadow-blue-500/50' : 
                'bg-emerald-500 shadow-emerald-500/50'
              }`} />
            </div>
          )}

          {isMonster && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold text-[6px] uppercase">Def</span>
              <span className={`text-white font-black tracking-widest ${isMiniature ? 'text-[8px]' : 'text-sm'}`}>{card.def ?? 0}</span>
            </div>
          )}
        </div>
      )}

      {!isUltraMiniature && (
        <div className="absolute bottom-0.5 left-3 font-mono text-[4px] uppercase tracking-[0.2em] text-slate-600 opacity-40 select-none pointer-events-none">
          {card.id.slice(0, 12).replace(/-/g, '')}
        </div>
      )}
    </div>
  );
};
