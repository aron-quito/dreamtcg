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

export const renderTriggerText = (trigger: any) => {
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
      const method = params.summonMethod === "SPECIAL" ? "de Modo Especial" : (params.summonMethod === "NORMAL" ? "de Modo Normal" : (params.summonMethod === "FLIP" ? "por Volteo" : ""));
      const name = params.filterName ? ` [${params.filterName}]` : "";
      if (params.summonWho === "SELF") return `Cuando esta carta es Invocada ${method}`.replace(/\s+/g, ' ').trim();
      const who = params.summonWho === "OPPONENT" ? "el oponente" : (params.summonWho === "ANY" ? "cualquier jugador" : "tú");
      const target = params.targetCardType === CardType.MONSTER ? "un monstruo" : "una carta";
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

export const renderRestrictionText = (restr: any) => {
  if (!restr) return '';
  const locs = restr.locations.map((l: any) => LOC_MAP[l] || l).join(", ");
  const freq = FREQ_MAP[restr.frequency] || restr.frequency;
  const pos = restr.mustBePosition ? ` (${POS_MAP[restr.mustBePosition]})` : "";
  let base = ` Solo en ${locs}${pos}. [${freq}]`;

  if (restr.summonRestriction && restr.summonRestriction !== "NONE") {
    const sMap: Record<string, string> = {
      "ONLY_SPECIAL": "No puede ser Invocado de Modo Normal",
      "ONLY_NORMAL": "No puede ser Invocado de Modo Especial"
    };
    base += `. ${sMap[restr.summonRestriction]}`;
  }
  return base;
};

export const renderCostText = (cost: any) => {
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

export const renderResolutionText = (res: any) => {
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

// ─── CARD COMPONENT ─────────────────────────────────────────────────────────

interface CardProps {
  card: CardDefinition;
  className?: string;
  isMiniature?: boolean;
  isUltraMiniature?: boolean;
  isExpanded?: boolean; // kept for API compatibility, no longer drives special logic
  showStatus?: boolean;
}

export const Card: React.FC<CardProps> = ({
  card,
  className = "",
  isMiniature = false,
  isUltraMiniature = false,
  showStatus = false
}) => {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const headerRef = React.useRef<HTMLHeadingElement>(null);

  // High-fidelity initialization: set realistic defaults to prevent the 'tiny card' start.
  const [cardWidth, setCardWidth] = React.useState(
    isUltraMiniature ? 90 : (isMiniature ? 130 : 350)
  );

  const [textScale, setTextScale] = React.useState(1);
  const textRef = React.useRef<HTMLDivElement>(null);

  const isMonster = card.type === CardType.MONSTER;
  const attrStyle = ATTRIBUTE_STYLES[card.attribute || "DARK"];

  // Single stable observer — measures real card width, zero loops.
  React.useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const measure = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 10) setCardWidth(w);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fw = cardWidth; // alias
  const fs = {
    // Optimized ratios for grid-based layout
    name: isUltraMiniature ? fw * 0.16 : (isMiniature ? fw * 0.13 : Math.min(fw * 0.088, 22)),
    attr: isUltraMiniature ? 0 : (isMiniature ? fw * 0.07 : fw * 0.05),
    label: fw * 0.036,
    text: fw * 0.042,
    desc: fw * 0.030,
    footer: isMiniature ? fw * 0.10 : fw * 0.07,
  };

  // Synchronous header scaling to prevent text overflow
  React.useLayoutEffect(() => {
    const hEl = headerRef.current;
    if (!hEl || !hEl.parentElement) return;
    let n = isUltraMiniature ? fw * 0.16 : (isMiniature ? fw * 0.13 : fw * 0.088);
    hEl.style.fontSize = `${n}px`;
    while (hEl.scrollWidth > hEl.parentElement.clientWidth && n > 6) {
      n -= 0.5;
      hEl.style.fontSize = `${n}px`;
    }
  }, [cardWidth, card.name]);

  // ─── EFFECT BOX SUB-COMPONENT ──────────────────────────────────────────────
  // Each box manages its own local scale for perfect precision
  const EffectBox: React.FC<{ 
    eff: any; 
    index: number; 
    total: number;
    baseFs: any;
  }> = ({ eff, index, total, baseFs }) => {
    const boxRef = React.useRef<HTMLDivElement>(null);
    const contentRef = React.useRef<HTMLDivElement>(null);
    const [localScale, setLocalScale] = React.useState(1);
    
    React.useLayoutEffect(() => {
      const outer = boxRef.current;
      const inner = contentRef.current;
      if (!outer || !inner) return;
      
      // If inner content height is greater than outer container height, we must shrink
      if (inner.scrollHeight > outer.clientHeight && localScale > 0.3) {
        setLocalScale(prev => prev - 0.05);
      }
    }, [localScale, eff, cardWidth]);

    const s = localScale;
    const fsLocal = {
      label: baseFs.label * s,
      text:  baseFs.text * s,
    };

    const gridClass = total === 1 ? "col-span-2 row-span-2" : 
                     (total === 2 ? "col-span-1 row-span-2" : 
                     (total === 3 && index === 2 ? "col-span-2 row-span-1" : "col-span-1 row-span-1"));

    return (
      <div 
        ref={boxRef}
        className={`relative group transition-all bg-slate-950/20 hover:bg-slate-900/40 border border-white/5 rounded-md overflow-hidden flex ${gridClass}`}
      >
        {/* Left Side Dot Indicator Strip */}
        <div 
          className="bg-white/5 border-r border-white/5 flex flex-col items-center justify-center gap-[8%] shrink-0"
          style={{ width: `${fw * 0.05}px` }}
        >
          {Array.from({ length: index + 1 }).map((_, i) => (
            <div 
              key={i} 
              className="aspect-square bg-indigo-500/40 rounded-full shadow-[0_0_5px_rgba(99,102,241,0.5)] group-hover:bg-indigo-400 transition-colors" 
              style={{ width: `${fw * 0.012}px` }}
            />
          ))}
        </div>

        {/* Content Area — Using a wrapper for precise measurement */}
        <div className="flex-1 relative overflow-hidden">
          <div 
            ref={contentRef} 
            className="absolute inset-0 flex flex-col justify-center p-[6%] gap-[3%] min-w-0"
          >
            <div className="text-slate-300 leading-tight" style={{ fontSize: `${fsLocal.text}px` }}>
              <span className="text-indigo-400 font-bold uppercase tracking-tighter" style={{ fontSize: `${fsLocal.label}px` }}>Act: </span>
              {renderTriggerText(eff.trigger)}
            </div>
            <div className="text-slate-300 leading-tight" style={{ fontSize: `${fsLocal.text}px` }}>
              <span className="text-amber-500 font-bold uppercase tracking-tighter" style={{ fontSize: `${fsLocal.label}px` }}>Cnd: </span>
              {renderRestrictionText(eff.restriction)}
            </div>
            {eff.costs.length > 0 && (
              <div className="text-red-400/90 leading-tight" style={{ fontSize: `${fsLocal.text}px` }}>
                <span className="text-red-500/80 font-bold uppercase tracking-tighter" style={{ fontSize: `${fsLocal.label}px` }}>Cst: </span>
                {eff.costs.map((c: any) => renderCostText(c)).join(', ')}
              </div>
            )}
            {eff.resolutions.length > 0 && (
              <div className="text-emerald-400 leading-tight" style={{ fontSize: `${fsLocal.text}px` }}>
                <span className="text-emerald-500 font-bold uppercase tracking-tighter" style={{ fontSize: `${fsLocal.label}px` }}>Res: </span>
                {eff.resolutions.map((r: any) => renderResolutionText(r)).join(', ')}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      ref={rootRef}
      className={`relative overflow-hidden flex flex-col aspect-[63/88] cursor-default transition-all duration-500 border-2 rounded-[3.5%] shadow-2xl ${className}
        ${isMonster
          ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-slate-700/50'
          : 'bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950 border-teal-800/50'
        }`}
      style={{
        padding: (isMiniature || isUltraMiniature) ? '2%' : '4.2%',
        minWidth: isUltraMiniature ? '60px' : (isMiniature ? '100px' : '260px'),
        minHeight: isUltraMiniature ? '84px' : (isMiniature ? '140px' : '363px')
      }}
    >
      {/* Top accent bar */}
      <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r 
        ${isMonster ? 'from-amber-600 via-yellow-500 to-amber-600' : 'from-teal-500 via-emerald-400 to-teal-500'}`}
      />

      {/* Header: name + attribute */}
      <div className={`flex justify-between items-center ${isUltraMiniature ? 'mb-0' : (isMiniature ? 'mb-[1%]' : 'mb-[2%]')} relative z-10 shrink-0`}>
        <h2
          ref={headerRef}
          className={`font-black uppercase tracking-tight truncate ${isMonster ? 'text-white' : 'text-teal-50'}`}
          style={{ fontSize: `${fs.name}px` }}
        >
          {card.name || "UNNAMED CARD"}
        </h2>
        {!isUltraMiniature && (
          <div
            className={`px-1.5 py-0.5 border rounded-lg font-black uppercase shrink-0 ${attrStyle.bg} ${attrStyle.text} ${attrStyle.border}`}
            style={{ fontSize: `${fs.attr}px` }}
          >
            {isMiniature ? card.attribute?.slice(0, 3) : card.attribute}
          </div>
        )}
      </div>

      {/* Art frame — Fixed Standard Proportion */}
      <div className={`w-full bg-slate-950 rounded-sm border border-slate-800/50 relative flex items-center justify-center overflow-hidden shrink-0 
        ${isUltraMiniature ? 'flex-1 mt-0' : (isMiniature ? 'flex-1 mt-1' : 'aspect-video mt-[2%]')}`}>
        {card.image ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
              style={{ height: `${(isUltraMiniature || isMiniature) ? 125 : 200}%`, aspectRatio: '600 / 450' }}
            >
              <img
                src={card.image} alt={card.name}
                className="w-full h-full object-contain"
                style={{
                  transform: (() => {
                    const adj = isUltraMiniature ? card.mini2Adjustments : (isMiniature ? card.mini1Adjustments : card.mainAdjustments);
                    return `translate(${adj?.x || 0}%, ${adj?.y || 0}%) scale(${adj?.zoom || 1})`;
                  })(),
                  transformOrigin: 'center center'
                }}
              />
            </div>
          </div>
        ) : (
          <Package className={`${isUltraMiniature ? 'w-3 h-3' : (isMiniature ? 'w-4 h-4' : 'w-10 h-10')} text-slate-900 opacity-40`} />
        )}
        {isMonster && !isUltraMiniature && (
          <div className={`absolute top-1.5 right-1.5 aspect-square bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 rounded-full border-2 border-amber-900/50 flex items-center justify-center shadow-[0_4px_10px_rgba(0,0,0,0.5),inset_0_1px_2px_rgba(255,255,255,0.6)] z-20 text-black font-black
            ${isMiniature ? 'w-5 h-5 text-[9px]' : 'w-9 h-9 text-base'}`}
          >
            {Math.max(1, card.level || 0)}
          </div>
        )}
      </div>

      {/* Text panel — CUBIC GRID SYSTEM */}
      {!isMiniature && !isUltraMiniature && (
        <div className="mt-[4%] flex-1 flex flex-col bg-transparent rounded-sm border border-white/5 overflow-hidden relative min-h-0 p-[4%]">
          {card.description && (
            <div className="px-[4%] mb-[3%] border-b border-white/5 pb-[2%] shrink-0">
               <p className="text-slate-500 italic leading-tight opacity-80" style={{ fontSize: `${fs.desc}px` }}>
                  {card.description}
               </p>
            </div>
          )}
          
          <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-[4%] min-h-0">
            {card.effects.length > 0 ? (
              card.effects.map((eff, i) => (
                <EffectBox 
                  key={i} 
                  eff={eff} 
                  index={i} 
                  total={card.effects.length} 
                  baseFs={fs} 
                />
              ))
            ) : (
              /* Phantom Lines for empty cards */
              <div className="col-span-2 row-span-2 flex flex-col justify-center space-y-[8%] opacity-5 px-[10%]">
                <div className="h-[2px] w-full bg-white/20 rounded-full" />
                <div className="h-[2px] w-[90%] bg-white/20 rounded-full" />
                <div className="h-[2px] w-[95%] bg-white/20 rounded-full" />
                <div className="h-[2px] w-[40%] bg-white/20 rounded-full" />
                <div className="h-[2px] w-[85%] bg-white/20 rounded-full" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer: ATK / DEF / status */}
      {!isUltraMiniature && (
        <div className={`flex items-center font-mono border-t border-slate-800/50 mt-auto pt-1 text-slate-300 shrink-0 ${isMonster ? 'justify-between' : 'justify-center'}`}>
          {isMonster && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold uppercase" style={{ fontSize: `calc(${fs.label} * 0.7)` }}>Atk</span>
              <span className="text-white font-black tracking-widest" style={{ fontSize: `${fs.footer}px` }}>{card.atk ?? 0}</span>
            </div>
          )}
          {showStatus && (
            <div className={`flex items-center gap-2 ${isMonster ? 'px-2' : ''}`}>
              <div className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${card.isPublic ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-slate-700 border border-slate-500'}`} />
              <div className={`w-2 h-2 rounded-full shadow-[0_0_8px] ${card.limit === 0 ? 'bg-red-500 shadow-red-500/50' :
                  card.limit === 1 ? 'bg-amber-500 shadow-amber-500/50' :
                    card.limit === 2 ? 'bg-blue-500 shadow-blue-500/50' :
                      'bg-emerald-500 shadow-emerald-500/50'}`}
              />
            </div>
          )}
          {isMonster && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 font-bold uppercase" style={{ fontSize: `calc(${fs.label} * 0.7)` }}>Def</span>
              <span className="text-white font-black tracking-widest" style={{ fontSize: `${fs.footer}px` }}>{card.def ?? 0}</span>
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
