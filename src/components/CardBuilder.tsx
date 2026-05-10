import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Save, 
  Layers,
  Settings, 
  Zap, 
  PlayCircle,
  ChevronLeft,
  ChevronRight,
  Target,
  Swords,
  Shield,
  Type,
  FileText,
  Eye,
  EyeOff,
  Search,
  Check,
  Package,
  X,
  Maximize2,
  Move,
  Crop,
  Activity,
  MapPin,
  Coins,
  Sparkles
} from 'lucide-react';
import { CardDefinition, CardType, CardAttribute, TriggerType, CardLocation, FrequencyType, CardEffect, Trigger } from '../types';
import { Card } from './Card';

const JSONEditor = ({ value, onChange, className, placeholder }: { value: any, onChange: (v: any) => void, className: string, placeholder?: string }) => {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  
  useEffect(() => {
    try {
      if (JSON.stringify(JSON.parse(text)) !== JSON.stringify(value)) {
        setText(JSON.stringify(value, null, 2));
      }
    } catch { }
  }, [value]);

  const handleBlur = () => {
    try {
      onChange(JSON.parse(text));
    } catch (err) {
      setText(JSON.stringify(value, null, 2));
    }
  };

  return (
    <textarea 
      value={text} 
      onChange={e => setText(e.target.value)} 
      onBlur={handleBlur}
      className={className}
      spellCheck={false}
      placeholder={placeholder}
    />
  );
};

const ActionParamsEditor = ({ action, params, onChange }: { action: string, params: any, onChange: (p: any) => void }) => {
  const update = (key: string, value: any) => onChange({ ...params, [key]: value });

  const renderNumber = (label = "Amount (n)") => (
    <div className="flex flex-col gap-1 flex-1 min-w-[80px]">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <input 
        type="number" 
        value={params.n || ''} 
        placeholder="1"
        onChange={e => update('n', parseInt(e.target.value) || undefined)} 
        className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700" 
      />
    </div>
  );

  const renderAdvancedFilter = () => {
    const filter = params.filter || {};
    return (
      <div className="flex flex-col gap-3 w-full bg-slate-950/30 p-3 rounded-lg border border-slate-800/50 mt-2">
        <div className="flex gap-4 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Target Type</span>
            <select 
              value={filter.targetType || 'ANY'} 
              onChange={e => update('filter', { ...filter, targetType: e.target.value === 'ANY' ? undefined : e.target.value })} 
              className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 appearance-none transition-all cursor-pointer"
            >
              <option value="ANY">ANY CARD</option>
              <option value="MONSTER">MONSTER</option>
              <option value="SPELL">SPELL</option>
            </select>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Specific Name</span>
            <input 
              type="text" value={filter.cardName || ''} placeholder="e.g. CYBERSE"
              onChange={e => update('filter', { ...filter, cardName: e.target.value || undefined })} 
              className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Attribute</span>
            <select 
              value={filter.attribute || 'ANY'} 
              onChange={e => update('filter', { ...filter, attribute: e.target.value === 'ANY' ? undefined : e.target.value })} 
              className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 appearance-none transition-all cursor-pointer"
            >
              <option value="ANY">ANY ATTRIBUTE</option>
              <option value="DARK">DARK</option>
              <option value="LIGHT">LIGHT</option>
              <option value="EARTH">EARTH</option>
              <option value="WATER">WATER</option>
              <option value="FIRE">FIRE</option>
              <option value="WIND">WIND</option>
            </select>
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[60px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Min Lvl</span>
            <input type="number" value={filter.minLevel || ''} placeholder="0" onChange={e => update('filter', { ...filter, minLevel: parseInt(e.target.value) || undefined })} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 placeholder:text-slate-700" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[60px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max Lvl</span>
            <input type="number" value={filter.maxLevel || ''} placeholder="12" onChange={e => update('filter', { ...filter, maxLevel: parseInt(e.target.value) || undefined })} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 placeholder:text-slate-700" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[80px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Min ATK</span>
            <input type="number" value={filter.minAtk || ''} placeholder="0" onChange={e => update('filter', { ...filter, minAtk: parseInt(e.target.value) || undefined })} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 placeholder:text-slate-700" />
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[80px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Max ATK</span>
            <input type="number" value={filter.maxAtk || ''} placeholder="9999" onChange={e => update('filter', { ...filter, maxAtk: parseInt(e.target.value) || undefined })} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 placeholder:text-slate-700" />
          </div>
        </div>
      </div>
    );
  };

  if (!action) return <JSONEditor value={params} onChange={onChange} className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-[10px] font-mono text-slate-400 outline-none focus:border-indigo-500 h-20 resize-none custom-scrollbar w-full" />;

  switch (action) {
    case 'PAY_LP':
    case 'HEAL_LP':
    case 'DEAL_DAMAGE':
    case 'DRAW':
      return (
        <div className="flex gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
          {renderNumber()}
        </div>
      );
    case 'DISCARD':
    case 'TRIBUTE':
    case 'DESTROY_OWN':
    case 'BANISH_OWN':
    case 'SEND_TO_GY':
    case 'REVEAL_HAND':
    case 'DESTROY_ENEMY':
    case 'BANISH_ENEMY':
    case 'SUMMON_FROM_DECK':
    case 'ADD_TO_HAND':
      return (
        <div className="flex gap-4 p-3 bg-slate-950/50 rounded-xl border border-slate-800/50 flex-wrap">
          {renderNumber()}
          {renderAdvancedFilter()}
        </div>
      );
    default:
      return <JSONEditor value={params} onChange={onChange} className="bg-slate-900 border border-slate-800/80 rounded-xl p-3 text-[10px] font-mono text-slate-400 outline-none focus:border-indigo-500 h-20 resize-none custom-scrollbar w-full" />;
  }
};

const TriggerParamsEditor = ({ trigger, onChange }: { trigger: Trigger, onChange: (t: Trigger) => void }) => {
  const params = trigger.params || {};
  const update = (key: string, value: any) => onChange({ ...trigger, params: { ...params, [key]: value } });

  const renderSelect = (label: string, key: string, options: string[], defaultVal: string) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <select value={params[key] || defaultVal} onChange={e => update(key, e.target.value)} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 appearance-none transition-all cursor-pointer">
        {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
      </select>
    </div>
  );
  
  const renderInput = (label: string, key: string) => (
    <div className="flex flex-col gap-1 flex-1 min-w-[100px]">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <input type="text" value={params[key] || ''} onChange={e => update(key, e.target.value || undefined)} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 transition-all" />
    </div>
  );

  switch (trigger.type) {
    case TriggerType.ON_ACTIVATION:
      return (
        <div className="flex gap-3 mt-3 flex-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          {renderSelect('Who Activates', 'activationWho', ['ANY', 'YOU', 'OPPONENT'], 'ANY')}
          {renderSelect('Card Type', 'targetCardType', ['ANY', 'MONSTER', 'SPELL'], 'ANY')}
          {renderInput('Filter Name', 'filterName')}
        </div>
      );
    case TriggerType.ON_SUMMON:
      return (
        <div className="flex gap-3 mt-3 flex-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          {renderSelect('Who Summons', 'summonWho', ['ANY', 'YOU', 'OPPONENT'], 'ANY')}
          {renderSelect('Method', 'summonMethod', ['ANY', 'NORMAL', 'SPECIAL', 'FLIP'], 'ANY')}
          {renderSelect('Card Type', 'targetCardType', ['ANY', 'MONSTER', 'SPELL'], 'MONSTER')}
          {renderInput('Filter Name', 'filterName')}
        </div>
      );
    case TriggerType.ON_DRAW:
      return (
        <div className="flex gap-3 mt-3 flex-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          {renderSelect('Who Draws', 'drawWho', ['ANY', 'YOU', 'OPPONENT'], 'ANY')}
          {renderSelect('Method', 'drawMethod', ['ANY', 'PHASE', 'EFFECT'], 'ANY')}
          {renderInput('Filter Name', 'filterName')}
        </div>
      );
    case TriggerType.ON_ATTACK:
      return (
        <div className="flex gap-3 mt-3 flex-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          {renderSelect('Attack Type', 'attackType', ['ANY', 'SELF', 'BEING_ATTACKED', 'CONTROLLED', 'OPPONENT', 'DIRECT'], 'ANY')}
        </div>
      );
    case TriggerType.ON_SEND_TO_GY:
      return (
        <div className="flex gap-3 mt-3 flex-wrap bg-slate-950/40 p-3 rounded-xl border border-slate-800/50">
          {renderSelect('Who Sends', 'sendWho', ['ANY', 'YOU', 'OPPONENT'], 'ANY')}
          {renderSelect('From', 'sendFrom', ['ANY', 'HAND', 'DECK', 'FIELD'], 'ANY')}
          {renderSelect('Method', 'sendMethod', ['ANY', 'BATTLE', 'EFFECT', 'COST'], 'ANY')}
          <div className="flex flex-col gap-1 flex-1 min-w-[80px]">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Is Self?</span>
            <select value={params.isSelf ? 'YES' : 'NO'} onChange={e => update('isSelf', e.target.value === 'YES')} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white font-bold outline-none focus:border-indigo-500 appearance-none transition-all cursor-pointer">
              <option value="NO">NO</option><option value="YES">YES</option>
            </select>
          </div>
          {renderSelect('Card Type', 'targetCardType', ['ANY', 'MONSTER', 'SPELL'], 'ANY')}
          {renderInput('Filter Name', 'filterName')}
        </div>
      );
    default:
      return null;
  }
};

interface CardBuilderProps {
  collection: CardDefinition[];
  onSave: (card: CardDefinition) => void;
  onDelete: (id: string) => void;
}

type AdjustmentType = 'MAIN' | 'MINI1' | 'MINI2';

export const CardBuilder: React.FC<CardBuilderProps> = ({ collection, onSave, onDelete }) => {
  const [view, setView] = useState<'LIST' | 'EDIT'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(collection[0]?.id || null);
  const [activeAdjustmentView, setActiveAdjustmentView] = useState<AdjustmentType | null>(null);

  const [card, setCard] = useState<CardDefinition>({
    id: crypto.randomUUID(),
    name: "",
    type: CardType.MONSTER,
    description: "",
    effects: [],
    level: 1,
    atk: 0,
    def: 0,
    attribute: CardAttribute.DARK,
    isCustom: true,
    isPublic: true,
    limit: 3,
    mainAdjustments: { x: 0, y: 0, zoom: 1 },
    mini1Adjustments: { x: 0, y: 0, zoom: 1 },
    mini2Adjustments: { x: 0, y: 0, zoom: 1 }
  });

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const selectedPreview = collection.find(c => c.id === selectedCardId) || card;

  const handleEdit = (c: CardDefinition) => {
    const cardWithAdjustments = {
      ...c,
      mainAdjustments: c.mainAdjustments || { x: 0, y: 0, zoom: 1 },
      mini1Adjustments: c.mini1Adjustments || { x: 0, y: 0, zoom: 1 },
      mini2Adjustments: c.mini2Adjustments || { x: 0, y: 0, zoom: 1 }
    };
    setCard(cardWithAdjustments);
    setView('EDIT');
  };

  const handleCreateNew = () => {
    setCard({
      id: crypto.randomUUID(),
      name: "",
      type: CardType.MONSTER,
      description: "",
      effects: [],
      level: 1,
      atk: 0,
      def: 0,
      attribute: CardAttribute.DARK,
      isCustom: true,
      isPublic: true,
      limit: 3,
      mainAdjustments: { x: 0, y: 0, zoom: 1 },
      mini1Adjustments: { x: 0, y: 0, zoom: 1 },
      mini2Adjustments: { x: 0, y: 0, zoom: 1 }
    });
    setView('EDIT');
  };

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'image/webp') {
        alert('Por favor, selecciona solo imágenes en formato .webp');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCard({ ...card, image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const updateEffect = (index: number, updated: CardEffect) => {
    const newEffects = [...card.effects];
    newEffects[index] = updated;
    setCard({ ...card, effects: newEffects });
  };

  const removeEffect = (index: number) => {
    setCard({ ...card, effects: card.effects.filter((_, i) => i !== index) });
  };

  const updateAdjustments = (type: AdjustmentType, field: 'x' | 'y' | 'zoom', value: number) => {
    const key = type === 'MAIN' ? 'mainAdjustments' : (type === 'MINI1' ? 'mini1Adjustments' : 'mini2Adjustments');
    setCard({
      ...card,
      [key]: { ...((card as any)[key] || { x: 0, y: 0, zoom: 1 }), [field]: value }
    });
  };

  // --- ADVANCED CROPPER LOCAL STATE ---
  const [tempAdj, setTempAdj] = useState<{x: number, y: number, zoom: number} | null>(null);

  const openAdjustment = (type: AdjustmentType) => {
    setActiveAdjustmentView(type);
    const key = type === 'MAIN' ? 'mainAdjustments' : (type === 'MINI1' ? 'mini1Adjustments' : 'mini2Adjustments');
    setTempAdj(card[key] || { x: 0, y: 0, zoom: 1 });
  };

  const confirmAdjustment = () => {
    if (activeAdjustmentView && tempAdj) {
      const key = activeAdjustmentView === 'MAIN' ? 'mainAdjustments' : (activeAdjustmentView === 'MINI1' ? 'mini1Adjustments' : 'mini2Adjustments');
      setCard({ ...card, [key]: tempAdj });
    }
    setActiveAdjustmentView(null);
  };

  const activeTitle = activeAdjustmentView === 'MAIN' ? "Main Art View" : (activeAdjustmentView === 'MINI1' ? "Collection View" : "Icon/Deck View");

  return (
    <div className="min-h-screen">
      {/* ADJUSTMENT MODAL OVERLAY */}
      {activeAdjustmentView && tempAdj && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
          <div className="bg-slate-900 border border-white/10 w-full max-w-[1200px] rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">
            
            <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                  <Crop className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">{activeTitle}</h3>
                  <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.2em] opacity-80">Zero-Lag Exact WYSIWYG Cropper</p>
                </div>
              </div>
              <button onClick={() => setActiveAdjustmentView(null)} className="p-3 hover:bg-white/10 rounded-full text-slate-400 transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-12 flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-10 lg:gap-20">
               
               {/* THE REAL CROPPER INTERFACE */}
               <div className="flex-1 w-full flex items-center justify-center min-h-[450px]">
                  {/* VIRTUAL CANVAS */}
                  <div className="relative w-[600px] h-[450px] bg-slate-950 rounded-3xl overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] border border-white/5 flex items-center justify-center">
                     
                     {/* The Full Image (Crisp & Large) */}
                     <div className="absolute inset-0">
                         <img 
                           src={card.image} 
                           className="w-full h-full object-contain"
                           style={{
                             transform: `translate(${tempAdj.x}%, ${tempAdj.y}%) scale(${tempAdj.zoom})`,
                             transformOrigin: 'center center'
                           }}
                         />
                     </div>

                     {/* The Viewport Mask (Darkens everything outside) */}
                     <div 
                        className={`relative z-10 border-2 border-indigo-400 shadow-[0_0_0_9999px_rgba(15,23,42,0.85)] pointer-events-none flex items-center justify-center
                          ${activeAdjustmentView === 'MAIN' ? 'w-[400px] h-[225px]' : 'w-[257px] h-[360px]'}
                        `}
                     >
                        {/* Interior Grid */}
                        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                          {[...Array(9)].map((_, i) => <div key={i} className="border border-white/20" />)}
                        </div>
                     </div>
                     
                     {/* Visual Label */}
                     <div className="absolute top-4 left-4 bg-indigo-600 text-white text-[10px] font-black uppercase px-4 py-2 rounded-full shadow-lg z-20 flex items-center gap-2">
                       <Eye className="w-4 h-4" /> Virtual Canvas Cropper
                     </div>
                  </div>
               </div>

               {/* CONTROLS AREA */}
               <div className="w-full lg:w-[400px] shrink-0 flex flex-col justify-center space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/5 h-fit lg:sticky lg:top-0">
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Maximize2 className="w-4 h-4 text-indigo-400" /> Framing Zoom
                        </span>
                        <span className="text-sm font-black text-indigo-400">{(tempAdj.zoom).toFixed(2)}x</span>
                      </div>
                      <input 
                        type="range" min="0.5" max="5" step="0.01"
                        value={tempAdj.zoom}
                        onChange={e => setTempAdj({ ...tempAdj, zoom: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Move className="w-4 h-4 text-indigo-400" /> Horiz Position
                          </span>
                          <span className="text-xs font-black text-white">{tempAdj.x}%</span>
                        </div>
                        <input 
                          type="range" min="-100" max="100" step="1"
                          value={tempAdj.x}
                          onChange={e => setTempAdj({ ...tempAdj, x: parseInt(e.target.value) })}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                            <Move className="w-4 h-4 text-indigo-400" /> Vert Position
                          </span>
                          <span className="text-xs font-black text-white">{tempAdj.y}%</span>
                        </div>
                        <input 
                          type="range" min="-100" max="100" step="1"
                          value={tempAdj.y}
                          onChange={e => setTempAdj({ ...tempAdj, y: parseInt(e.target.value) })}
                          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button 
                      onClick={() => setTempAdj({ x: 0, y: 0, zoom: 1 })}
                      className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                    >
                      Reset
                    </button>
                    <button 
                      onClick={confirmAdjustment}
                      className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-500/20"
                    >
                      Confirm Selection
                    </button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}


      {view === 'LIST' ? (
        <div className="flex flex-col lg:flex-row gap-8 animate-in fade-in duration-500">
          <div className="w-full lg:w-[450px] shrink-0 space-y-6">
            <div className="bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] backdrop-blur-xl flex flex-col items-center sticky top-24">
              <div className="w-full max-w-[320px] mb-8">
                <Card card={selectedPreview} showStatus={true} />
              </div>
              
              <div className="w-full space-y-3">
                <button 
                  onClick={() => handleEdit(selectedPreview)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3"
                >
                  <Settings className="w-4 h-4" /> Modify Card
                </button>
                <button 
                  onClick={() => onDelete(selectedPreview.id)}
                  className="w-full py-4 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 border border-slate-700/50 hover:border-red-500/30 flex items-center justify-center gap-3"
                >
                  <Trash2 className="w-4 h-4" /> Delete Permanently
                </button>
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-6">
            <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tighter uppercase">Card Inventory</h2>
                  <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mt-1">Manage your created entities</p>
                </div>
                <button 
                  onClick={handleCreateNew}
                  className="px-6 py-3 bg-gradient-to-br from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg shadow-emerald-900/30 active:scale-95 flex items-center gap-3"
                >
                  <Plus className="w-4 h-4" /> Create New Card
                </button>
              </div>

              <div className="relative mb-6">
                <input 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-5 pl-14 text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                  placeholder="Search by name, ID or type..."
                />
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-700" />
              </div>

              <div className="flex-1 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 content-start pr-2 custom-scrollbar">
                {collection
                  .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.id.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(c => (
                    <div 
                      key={c.id}
                      onClick={() => setSelectedCardId(c.id)}
                      className={`relative group cursor-pointer transition-all duration-300 rounded-xl 
                        ${selectedCardId === c.id ? 'scale-[0.98]' : 'hover:scale-105'}`}
                    >
                      <div className={`transition-all duration-300 rounded-xl overflow-hidden border-2 
                        ${selectedCardId === c.id ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]' : 'border-slate-800/50 hover:border-slate-600'}`}>
                        <Card card={c} isMiniature showStatus={true} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-0 lg:gap-8 p-0 md:p-6 max-w-[1600px] mx-auto min-h-screen transition-all duration-500 ease-in-out animate-in slide-in-from-right-8 duration-500">
          <div 
            className={`shrink-0 transition-all duration-500 ease-in-out relative border-r lg:border-r-0 border-slate-800 lg:bg-transparent bg-slate-950/50 backdrop-blur-md z-20
              ${isSidebarCollapsed ? 'w-0 lg:w-16 overflow-hidden opacity-0 lg:opacity-100' : 'w-full lg:w-[400px] p-4 lg:p-0'}`}
          >
            <div className={`lg:sticky lg:top-6 space-y-4 flex flex-col items-center ${isSidebarCollapsed ? 'lg:pt-20' : ''}`}>
              {!isSidebarCollapsed ? (
                <>
                  <div className="flex items-center justify-between w-full max-w-[350px] mb-2 px-2">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">Live Editor Preview</h3>
                    <button 
                      onClick={() => setIsSidebarCollapsed(true)}
                      className="p-1.5 hover:bg-slate-800 rounded-full text-slate-500 transition-colors hidden lg:block"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                  <Card card={card} className="w-full max-w-[350px]" showStatus={true} />
                  
                  <div className="mt-6 w-full max-w-[350px] px-2 flex flex-col gap-3">
                    <button 
                      onClick={() => { onSave(card); setView('LIST'); }}
                      className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-indigo-900/20 flex items-center justify-center gap-3"
                    >
                      <Save className="w-5 h-5" /> Save Entity
                    </button>
                    <button 
                      onClick={() => setView('LIST')}
                      className="w-full py-4 bg-slate-800 text-slate-400 hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all"
                    >
                      Cancel Editing
                    </button>
                  </div>
                </>
              ) : (
                <button 
                  onClick={() => setIsSidebarCollapsed(false)}
                  className="p-2 mt-4 bg-slate-800 hover:bg-indigo-600 text-white rounded-full transition-all"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 lg:max-h-screen lg:overflow-y-auto p-4 lg:p-8 space-y-12 custom-scrollbar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="group">
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                    <Type className="w-3 h-3 text-indigo-400" /> Entity Designation
                  </label>
                  <input 
                    value={card.name}
                    onChange={e => setCard({ ...card, name: e.target.value })}
                    className="w-full bg-slate-950/50 border border-slate-800 group-focus-within:border-indigo-500 rounded-2xl p-4 text-white text-xl font-black uppercase tracking-tighter outline-none transition-all placeholder:text-slate-800"
                    placeholder="ENTER CARD NAME..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                      <Target className="w-3 h-3 text-indigo-400" /> Type
                    </label>
                    <select 
                      value={card.type}
                      onChange={e => setCard({ ...card, type: e.target.value as CardType })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value={CardType.MONSTER}>MONSTER</option>
                      <option value={CardType.SPELL}>SPELL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                      <Zap className="w-3 h-3 text-indigo-400" /> Attribute
                    </label>
                    <select 
                      value={card.attribute}
                      onChange={e => setCard({ ...card, attribute: e.target.value as CardAttribute })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                    >
                      {Object.values(CardAttribute).map(attr => (
                        <option key={attr} value={attr}>{attr}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {card.type === CardType.MONSTER && (
                    <>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                          <Layers className="w-3 h-3 text-indigo-400" /> LVL
                        </label>
                        <input 
                          type="number" 
                          value={card.level || ''}
                          placeholder="1"
                          onChange={e => setCard({ ...card, level: parseInt(e.target.value) || undefined })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                          <Swords className="w-3 h-3 text-red-400" /> ATK
                        </label>
                        <input 
                          type="number" 
                          value={card.atk === 0 ? '0' : (card.atk || '')}
                          placeholder="0"
                          onChange={e => setCard({ ...card, atk: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                          <Shield className="w-3 h-3 text-blue-400" /> DEF
                        </label>
                        <input 
                          type="number" 
                          value={card.def === 0 ? '0' : (card.def || '')}
                          placeholder="0"
                          onChange={e => setCard({ ...card, def: e.target.value === '' ? undefined : parseInt(e.target.value) })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all placeholder:text-slate-700"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                      <Eye className="w-3 h-3 text-indigo-400" /> Visibility
                    </label>
                    <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                       <button 
                         onClick={() => setCard({...card, isPublic: true})}
                         className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${card.isPublic ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-900'}`}
                       >
                         Public
                       </button>
                       <button 
                         onClick={() => setCard({...card, isPublic: false})}
                         className={`flex-1 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${!card.isPublic ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-900'}`}
                       >
                         Draft
                       </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                      Legal Limit
                    </label>
                    <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1 gap-1">
                      {[0, 1, 2, 3].map(limit => (
                        <button 
                          key={limit}
                          onClick={() => setCard({...card, limit})}
                          className={`flex-1 py-2 text-[8px] font-black uppercase rounded-lg transition-all 
                            ${card.limit === limit 
                              ? (limit === 0 ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white') 
                              : 'text-slate-600 hover:bg-slate-900'}`}
                        >
                          {limit}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                    <FileText className="w-3 h-3 text-indigo-400" /> Lore / Description
                  </label>
                  <textarea 
                    value={card.description}
                    onChange={e => setCard({ ...card, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-slate-300 text-xs min-h-[140px] outline-none focus:border-indigo-500 transition-all custom-scrollbar"
                    placeholder="Enter card lore or flavor text..."
                  />
                </div>
              </div>

              <div className="space-y-6">

                <div className="bg-slate-950/30 rounded-2xl p-6 border border-slate-800/50 space-y-6">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                      <PlayCircle className="w-3 h-3 text-indigo-400" /> Card Art Asset
                    </label>
                  </div>
                  
                  <div className="flex flex-col gap-6">
                    {card.image ? (
                      <div className="space-y-6">
                        <div className="relative group aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                          <img src={card.image} alt="Art" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                            <label className="p-3 bg-indigo-600 rounded-full text-white cursor-pointer hover:bg-indigo-500 transition-all hover:scale-110">
                              <Plus className="w-6 h-6" />
                              <input type="file" accept="image/webp" onChange={handleImageUpload} className="hidden" />
                            </label>
                            <button 
                              onClick={() => setCard({ ...card, image: undefined })}
                              className="p-3 bg-red-600 rounded-full text-white hover:bg-red-500 transition-all hover:scale-110"
                            >
                              <Trash2 className="w-6 h-6" />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center gap-2 px-1">
                              <Maximize2 className="w-3 h-3 text-indigo-400" />
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Multi-Scale Framing Control</span>
                           </div>
                           
                           <div className="grid grid-cols-3 gap-4">
                              <button 
                                onClick={() => openAdjustment('MAIN')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-800 shadow-inner relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ height: '200%', aspectRatio: '600 / 450' }}>
                                       <img src={card.image} className="w-full h-full object-contain" style={{ transform: `translate(${card.mainAdjustments?.x || 0}%, ${card.mainAdjustments?.y || 0}%) scale(${card.mainAdjustments?.zoom || 1})` }} />
                                    </div>
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Main Card</span>
                              </button>

                              <button 
                                onClick={() => openAdjustment('MINI1')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-[63/88] rounded-lg overflow-hidden border border-slate-800 shadow-inner relative">
                                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ height: '125%', aspectRatio: '600 / 450' }}>
                                       <img src={card.image} className="w-full h-full object-contain" style={{ transform: `translate(${card.mini1Adjustments?.x || 0}%, ${card.mini1Adjustments?.y || 0}%) scale(${card.mini1Adjustments?.zoom || 1})` }} />
                                    </div>
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Collection</span>
                              </button>

                              <button 
                                onClick={() => openAdjustment('MINI2')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-[63/88] rounded-lg overflow-hidden border border-slate-800 shadow-inner p-1">
                                    <div className="w-full h-full rounded border border-slate-800 overflow-hidden relative">
                                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ height: '125%', aspectRatio: '600 / 450' }}>
                                          <img src={card.image} className="w-full h-full object-contain" style={{ transform: `translate(${card.mini2Adjustments?.x || 0}%, ${card.mini2Adjustments?.y || 0}%) scale(${card.mini2Adjustments?.zoom || 1})` }} />
                                       </div>
                                    </div>
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Deck/Icon</span>
                              </button>
                           </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative border-2 border-dashed border-slate-800 rounded-2xl p-12 flex flex-col items-center justify-center gap-3 hover:border-indigo-500/50 transition-all bg-slate-900/20 group">
                        <div className="p-4 bg-slate-900 rounded-full group-hover:bg-indigo-600/20 transition-all">
                          <Plus className="w-8 h-8 text-slate-600 group-hover:text-indigo-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Click to upload .webp art</p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase mt-1">Recommended: 1280x720 (16:9)</p>
                        </div>
                        <input 
                          type="file" 
                          accept="image/webp" 
                          onChange={handleImageUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6 pt-12 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-600/20 rounded-xl text-indigo-400">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white uppercase tracking-tighter">Behavioral Logic (Effect Tree)</h4>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Define how this entity interacts with the world</p>
                  </div>
                </div>
                <button 
                  onClick={addEffect}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-lg shadow-indigo-900/30 active:scale-95 flex items-center gap-3"
                >
                  <Plus className="w-4 h-4" /> Add Logic Branch
                </button>
              </div>

              <div className="space-y-6">
                {card.effects.map((effect, idx) => (
                  <div key={effect.id} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 space-y-8 relative group hover:border-indigo-500/30 transition-all shadow-xl">
                    <div className="absolute top-6 right-6 flex items-center gap-2">
                       <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Node {idx + 1}</span>
                       <button 
                         onClick={() => removeEffect(idx)}
                         className="p-2 bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-400 hover:border-red-500/50 rounded-xl transition-all shadow-xl"
                         title="Remove Effect"
                       >
                         <Trash2 className="w-4 h-4" />
                       </button>
                    </div>

                    {/* EFFECT HEADER */}
                    <div>
                      <input 
                        type="text" 
                        value={effect.name} 
                        onChange={e => updateEffect(idx, { ...effect, name: e.target.value })}
                        className="bg-transparent text-xl md:text-2xl font-black text-white uppercase tracking-tighter outline-none border-b border-transparent focus:border-indigo-500 transition-all w-3/4 pb-1"
                        placeholder="Effect Name"
                      />
                    </div>

                    {/* ROW 1: TRIGGER & STATE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* LEFT: Event Trigger */}
                      <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 space-y-3 shadow-inner">
                        <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                          <Zap className="w-3 h-3" /> Event Trigger
                        </div>
                        <select 
                          value={effect.trigger.type}
                          onChange={e => updateEffect(idx, { ...effect, trigger: { type: e.target.value as TriggerType, params: {} } })}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-bold outline-none focus:border-indigo-500 transition-all cursor-pointer"
                        >
                          {Object.values(TriggerType).map(t => (
                            <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                          ))}
                        </select>
                        <TriggerParamsEditor 
                          trigger={effect.trigger} 
                          onChange={newTrigger => updateEffect(idx, { ...effect, trigger: newTrigger })} 
                        />
                      </div>

                      {/* RIGHT: Frequency + Location stacked */}
                      <div className="flex flex-col gap-4">
                        <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 space-y-3 shadow-inner">
                          <div className="flex items-center gap-2 text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            <Activity className="w-3 h-3" /> Frequency Limit
                          </div>
                          <select 
                            value={effect.restriction.frequency}
                            onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, frequency: e.target.value as FrequencyType } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-bold outline-none focus:border-emerald-500 transition-all"
                          >
                            {Object.values(FrequencyType).map(t => (
                              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>

                        <div className="p-5 bg-slate-950/40 rounded-2xl border border-slate-800/50 space-y-3 shadow-inner flex-1">
                          <div className="flex items-center gap-2 text-[10px] font-black text-amber-400 uppercase tracking-widest">
                            <MapPin className="w-3 h-3" /> Valid Location & State
                          </div>
                          <div className="flex flex-col gap-3">
                            <select 
                              value={effect.restriction.locations[0] || CardLocation.MONSTER_ZONE}
                              onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, locations: [e.target.value as CardLocation] } })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-bold outline-none focus:border-amber-500 transition-all cursor-pointer"
                            >
                              {Object.values(CardLocation).map(t => (
                                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                              ))}
                            </select>
                            
                            <select 
                              value={effect.restriction.mustBePosition || 'ANY'}
                              onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, mustBePosition: e.target.value === 'ANY' ? undefined : e.target.value } })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-bold outline-none focus:border-amber-500 transition-all cursor-pointer"
                            >
                              <option value="ANY">ANY POSITION</option>
                              <option value="FACE_UP">FACE UP</option>
                              <option value="FACE_DOWN">FACE DOWN</option>
                              <option value="ATTACK">ATTACK POS</option>
                              <option value="DEFENSE">DEFENSE POS</option>
                            </select>

                            <select 
                              value={effect.restriction.summonRestriction || 'NONE'}
                              onChange={e => updateEffect(idx, { ...effect, restriction: { ...effect.restriction, summonRestriction: e.target.value === 'NONE' ? undefined : e.target.value } })}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-300 text-xs font-bold outline-none focus:border-amber-500 transition-all cursor-pointer"
                            >
                              <option value="NONE">NO SUMMON RESTRICTION</option>
                              <option value="ONLY_SPECIAL">ONLY SPECIAL SUMMON</option>
                              <option value="ONLY_NORMAL">ONLY NORMAL SUMMON</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ROW 2: COSTS & RESOLUTIONS */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* COSTS */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                           <div className="flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest">
                             <Coins className="w-3 h-3" /> Execution Costs
                           </div>
                           <button 
                             onClick={() => updateEffect(idx, { ...effect, costs: [...effect.costs, { action: 'PAY_LP', params: { n: 500 } }] })}
                             className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                           >
                             <Plus className="w-3 h-3" /> Add Cost
                           </button>
                        </div>
                        {effect.costs.length === 0 ? (
                           <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center py-6 border border-dashed border-slate-800/80 rounded-2xl">No costs required</div>
                        ) : (
                           <div className="space-y-4">
                             {effect.costs.map((cost, cIdx) => (
                               <div key={cIdx} className="flex flex-col gap-3 p-4 bg-slate-950/80 rounded-2xl border border-slate-800/50 group/cost relative shadow-sm">
                                  <button onClick={() => updateEffect(idx, { ...effect, costs: effect.costs.filter((_, i) => i !== cIdx) })} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover/cost:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                  <select 
                                    value={cost.action} 
                                    onChange={e => { const newC = [...effect.costs]; newC[cIdx].action = e.target.value; updateEffect(idx, { ...effect, costs: newC }) }}
                                    className="bg-transparent text-xs font-black text-rose-300 uppercase outline-none w-[80%] cursor-pointer appearance-none"
                                  >
                                    <option value="" disabled>Select Cost Action</option>
                                    {['PAY_LP', 'DISCARD', 'DESTROY_OWN', 'BANISH_OWN', 'SEND_TO_GY', 'TRIBUTE', 'REVEAL_HAND'].map(a => (
                                      <option key={a} value={a} className="bg-slate-900 text-slate-300">{a}</option>
                                    ))}
                                  </select>
                                  <ActionParamsEditor 
                                    action={cost.action}
                                    params={cost.params}
                                    onChange={newParams => { const newC = [...effect.costs]; newC[cIdx].params = newParams; updateEffect(idx, { ...effect, costs: newC }); }}
                                  />
                               </div>
                             ))}
                           </div>
                        )}
                      </div>

                      {/* RESOLUTIONS */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                           <div className="flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                             <Sparkles className="w-3 h-3" /> Effect Resolutions
                           </div>
                           <button 
                             onClick={() => updateEffect(idx, { ...effect, resolutions: [...effect.resolutions, { action: 'DRAW', params: { n: 1 } }] })}
                             className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2"
                           >
                             <Plus className="w-3 h-3" /> Add Resolution
                           </button>
                        </div>
                        {effect.resolutions.length === 0 ? (
                           <div className="text-[9px] font-black text-slate-600 uppercase tracking-widest text-center py-6 border border-dashed border-slate-800/80 rounded-2xl">No resolutions defined</div>
                        ) : (
                           <div className="space-y-4">
                             {effect.resolutions.map((res, rIdx) => (
                               <div key={rIdx} className="flex flex-col gap-3 p-4 bg-slate-950/80 rounded-2xl border border-slate-800/50 group/res relative shadow-sm">
                                  <button onClick={() => updateEffect(idx, { ...effect, resolutions: effect.resolutions.filter((_, i) => i !== rIdx) })} className="absolute top-3 right-3 text-slate-600 hover:text-red-400 opacity-0 group-hover/res:opacity-100 transition-opacity"><X className="w-3 h-3" /></button>
                                  <select 
                                    value={res.action} 
                                    onChange={e => { const newR = [...effect.resolutions]; newR[rIdx].action = e.target.value; updateEffect(idx, { ...effect, resolutions: newR }) }}
                                    className="bg-transparent text-xs font-black text-cyan-300 uppercase outline-none w-[80%] cursor-pointer appearance-none"
                                  >
                                    <option value="" disabled>Select Resolution Action</option>
                                    {['DRAW', 'DESTROY_ENEMY', 'ADD_TO_HAND', 'DEAL_DAMAGE', 'HEAL_LP', 'SUMMON_FROM_DECK', 'BANISH_ENEMY'].map(a => (
                                      <option key={a} value={a} className="bg-slate-900 text-slate-300">{a}</option>
                                    ))}
                                  </select>
                                  <ActionParamsEditor 
                                    action={res.action}
                                    params={res.params}
                                    onChange={newParams => { const newR = [...effect.resolutions]; newR[rIdx].params = newParams; updateEffect(idx, { ...effect, resolutions: newR }); }}
                                  />
                               </div>
                             ))}
                           </div>
                        )}
                      </div>
                    </div>

                  </div>
                ))}
                
                {card.effects.length === 0 && (
                  <div className="py-20 flex flex-col items-center justify-center text-slate-800 border-2 border-dashed border-slate-800/50 rounded-[2.5rem]">
                    <Zap className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-xs font-black uppercase tracking-widest opacity-40">No behavioral nodes defined</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
