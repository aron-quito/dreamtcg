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
  Crop
} from 'lucide-react';
import { CardDefinition, CardType, CardAttribute, TriggerType, CardLocation, FrequencyType, CardEffect } from '../types';
import { Card } from './Card';

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

  // --- NEW ADVANCED CROPPER MODAL ---
  const AdjustmentModal = () => {
    if (!activeAdjustmentView) return null;
    const type = activeAdjustmentView;
    const adj = type === 'MAIN' ? (card.mainAdjustments || { x: 0, y: 0, zoom: 1 }) : 
               (type === 'MINI1' ? (card.mini1Adjustments || { x: 0, y: 0, zoom: 1 }) : 
               (card.mini2Adjustments || { x: 0, y: 0, zoom: 1 }));
    
    const title = type === 'MAIN' ? "Main Art View" : (type === 'MINI1' ? "Collection View" : "Icon/Deck View");

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-2xl animate-in zoom-in-95 duration-300">
        <div className="bg-slate-900 border border-white/10 w-full max-w-3xl rounded-[3rem] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] flex flex-col max-h-[90vh]">
          
          <div className="p-8 border-b border-white/5 flex items-center justify-between bg-white/5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-500 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                <Crop className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">{title}</h3>
                <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.2em] opacity-80">Advanced Art Cropper v2</p>
              </div>
            </div>
            <button onClick={() => setActiveAdjustmentView(null)} className="p-3 hover:bg-white/10 rounded-full text-slate-400 transition-all">
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-10 flex flex-col items-center gap-10">
             
             {/* THE REAL CROPPER INTERFACE */}
             <div className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-white/10 shadow-2xl flex items-center justify-center">
                <div className="relative inline-block">
                  {/* BASE IMAGE (FIXED) */}
                  <img 
                    src={card.image} 
                    alt="Master Art" 
                    className="max-h-[350px] w-auto object-contain opacity-40 grayscale-[0.5] select-none"
                  />
                  
                  {/* MOVABLE VIEWPORT (THE CROP AREA) */}
                  <div 
                    className={`absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.7),0_0_30px_rgba(255,255,255,0.4)] z-10 transition-all duration-75
                      ${type === 'MAIN' ? 'aspect-video' : 'aspect-[63/88]'}
                    `}
                    style={{
                      width: `${100 / (adj.zoom || 1)}%`,
                      left: `${50 + (adj.x || 0) / 2 - (50 / (adj.zoom || 1))}%`,
                      top: `${50 + (adj.y || 0) / 2 - (50 / (adj.zoom || 1)) * (type === 'MAIN' ? 1 : 88/63)}%`,
                      transformOrigin: 'center center'
                    }}
                  >
                    {/* Interior Details */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                      {[...Array(9)].map((_, i) => <div key={i} className="border border-white/20" />)}
                    </div>
                    {/* Viewport Corners */}
                    <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-white" />
                    <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-white" />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-white" />
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-white" />
                  </div>
                </div>
                
                {/* Visual Label */}
                <div className="absolute top-4 left-4 bg-indigo-600 text-white text-[8px] font-black uppercase px-3 py-1.5 rounded-full shadow-lg z-20">
                  Visible Window Area
                </div>
             </div>

             {/* CONTROLS AREA */}
             <div className="w-full max-w-xl space-y-8 bg-white/5 p-8 rounded-[2rem] border border-white/5">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Maximize2 className="w-4 h-4 text-indigo-400" /> Framing Zoom
                      </span>
                      <span className="text-sm font-black text-indigo-400">{(adj.zoom).toFixed(2)}x</span>
                    </div>
                    <input 
                      type="range" min="0.5" max="5" step="0.01"
                      value={adj.zoom}
                      onChange={e => updateAdjustments(type, 'zoom', parseFloat(e.target.value))}
                      className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Move className="w-4 h-4 text-indigo-400" /> Horiz Position
                        </span>
                        <span className="text-xs font-black text-white">{adj.x}%</span>
                      </div>
                      <input 
                        type="range" min="-100" max="100" step="1"
                        value={adj.x}
                        onChange={e => updateAdjustments(type, 'x', parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                          <Move className="w-4 h-4 text-indigo-400" /> Vert Position
                        </span>
                        <span className="text-xs font-black text-white">{adj.y}%</span>
                      </div>
                      <input 
                        type="range" min="-100" max="100" step="1"
                        value={adj.y}
                        onChange={e => updateAdjustments(type, 'y', parseInt(e.target.value))}
                        className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => {
                      updateAdjustments(type, 'x', 0);
                      updateAdjustments(type, 'y', 0);
                      updateAdjustments(type, 'zoom', 1);
                    }}
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all"
                  >
                    Reset
                  </button>
                  <button 
                    onClick={() => setActiveAdjustmentView(null)}
                    className="flex-[2] py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl transition-all shadow-xl shadow-indigo-500/20"
                  >
                    Confirm Selection
                  </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <AdjustmentModal />

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
                          value={card.level || 1}
                          onChange={e => setCard({ ...card, level: parseInt(e.target.value) || 1 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                          <Swords className="w-3 h-3 text-red-400" /> ATK
                        </label>
                        <input 
                          type="number" 
                          value={card.atk || 0}
                          onChange={e => setCard({ ...card, atk: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2 mb-2">
                          <Shield className="w-3 h-3 text-blue-400" /> DEF
                        </label>
                        <input 
                          type="number" 
                          value={card.def || 0}
                          onChange={e => setCard({ ...card, def: parseInt(e.target.value) || 0 })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white text-sm font-black outline-none focus:border-indigo-500 transition-all"
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
              </div>

              <div className="space-y-6">
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
                                onClick={() => setActiveAdjustmentView('MAIN')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-video rounded-lg overflow-hidden border border-slate-800 shadow-inner">
                                    <img src={card.image} className="w-full h-full object-cover" style={{ transform: `translate(${card.mainAdjustments?.x || 0}%, ${card.mainAdjustments?.y || 0}%) scale(${card.mainAdjustments?.zoom || 1})` }} />
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Main Card</span>
                              </button>

                              <button 
                                onClick={() => setActiveAdjustmentView('MINI1')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-[63/88] rounded-lg overflow-hidden border border-slate-800 shadow-inner">
                                    <img src={card.image} className="w-full h-full object-cover" style={{ transform: `translate(${card.mini1Adjustments?.x || 0}%, ${card.mini1Adjustments?.y || 0}%) scale(${card.mini1Adjustments?.zoom || 1})` }} />
                                 </div>
                                 <span className="text-[8px] font-bold text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Collection</span>
                              </button>

                              <button 
                                onClick={() => setActiveAdjustmentView('MINI2')}
                                className="group flex flex-col items-center gap-3 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-indigo-500/50 transition-all"
                              >
                                 <div className="w-full aspect-[63/88] rounded-lg overflow-hidden border border-slate-800 shadow-inner p-1">
                                    <div className="w-full h-full rounded border border-slate-800 overflow-hidden">
                                       <img src={card.image} className="w-full h-full object-cover" style={{ transform: `translate(${card.mini2Adjustments?.x || 0}%, ${card.mini2Adjustments?.y || 0}%) scale(${card.mini2Adjustments?.zoom || 1})` }} />
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

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="p-6 bg-slate-950/40 rounded-2xl border border-slate-800 space-y-4">
                        <div>
                          <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4">
                            <Zap className="w-4 h-4" /> Event Trigger
                          </div>
                          <select 
                            value={effect.trigger.type}
                            onChange={e => updateEffect(idx, { ...effect, trigger: { ...effect.trigger, type: e.target.value as TriggerType, params: {} } })}
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-white text-xs font-bold outline-none focus:border-indigo-500 transition-all"
                          >
                            {Object.values(TriggerType).map(t => (
                              <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </div>
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
