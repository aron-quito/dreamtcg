import React from 'react';
import { 
  Package, 
  Trash2, 
  Search, 
  Plus,
  Minus,
  Info,
  Zap,
  Swords,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  ListFilter,
  ArrowDownAz
} from 'lucide-react';
import { CardDefinition, DeckDefinition, CardType, CardAttribute, PhysicalCard } from '../types';
import { Card } from './Card';
import { API_BASE } from '../config';

interface DeckBuilderProps {
  collection: CardDefinition[];
  decks: DeckDefinition[];
  currentDeck: DeckDefinition;
  onUpdateDeck: (deck: DeckDefinition) => void;
  onSaveDeck: (deck: DeckDefinition) => void;
  onDeleteDeck: (id: string) => void;
  onCreateDeck: () => void;
  onSelectDeck: (deck: DeckDefinition) => void;

  hasUnsavedChanges?: boolean;
  physicalCards: PhysicalCard[];
  onRefreshPhysicalCards: () => void;
  userCoins: number;
  userEmail: string;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ 
  collection, 
  decks, 
  currentDeck, 
  onUpdateDeck, 
  onSaveDeck, 
  onDeleteDeck, 
  onCreateDeck,
  onSelectDeck,

  hasUnsavedChanges = false,
  physicalCards,
  onRefreshPhysicalCards,
  userCoins,
  userEmail
}) => {
  const [selectedCard, setSelectedCard] = React.useState<CardDefinition | null>(collection.find(c => c.isPublic) || null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<CardType | 'ALL'>('ALL');
  const [filterAttribute, setFilterAttribute] = React.useState<CardAttribute | 'ALL'>('ALL');
  const [sortType, setSortType] = React.useState<'NAME' | 'LEVEL' | 'ATK'>('NAME');
  const [showUnowned, setShowUnowned] = React.useState(false);
  const [showCopiesModal, setShowCopiesModal] = React.useState(false);

  // Auto-optimize deck when it changes or when physicalCards load
  React.useEffect(() => {
    if (!currentDeck) return;
    const optimized = optimizeDeck(currentDeck.mainCards);
    if (JSON.stringify(optimized) !== JSON.stringify(currentDeck.mainCards)) {
      onUpdateDeck({ ...currentDeck, mainCards: optimized });
    }
  }, [physicalCards, currentDeck?.mainCards]);



  const optimizeDeck = (cardIds: string[]) => {
    // Only preserve valid physical IDs or valid molds. 
    // We do NOT auto-swap anymore so manual deselection works.
    return cardIds;
  };

  const addToDeck = (card: CardDefinition) => {
    if (card.isPublic === false) return;
    
    // Count how many copies of this template are already in the deck
    const currentCount = currentDeck.mainCards.filter(id => {
      const templateId = physicalCards.find(p => p.id === id)?.templateId || id;
      return templateId === card.id;
    }).length;
    
    const limit = card.limit ?? 3;
    if (limit === 0 || currentCount >= limit) return;

    // Auto-select best available physical copy
    const availableCopies = physicalCards.filter(pc => pc.templateId === card.id && !currentDeck.mainCards.includes(pc.id));
    const rarityRank: Record<string, number> = { 'ULTRA': 4, 'EPIC': 3, 'SPECIAL': 2, 'NORMAL': 1 };
    availableCopies.sort((a, b) => (rarityRank[b.quality] || 0) - (rarityRank[a.quality] || 0));

    const idToAdd = availableCopies.length > 0 ? availableCopies[0].id : card.id;

    onUpdateDeck({
      ...currentDeck,
      mainCards: [...currentDeck.mainCards, idToAdd]
    });
  };

  const removeFromDeck = (index: number) => {
    const newCards = [...currentDeck.mainCards];
    newCards.splice(index, 1);
    onUpdateDeck({ ...currentDeck, mainCards: newCards });
  };

  const sortDeck = () => {
    const sortedIds = [...currentDeck.mainCards].sort((aId, bId) => {
      const getTemplateId = (id: string) => physicalCards.find(p => p.id === id)?.templateId || id;
      const cardA = collection.find(c => c.id === getTemplateId(aId));
      const cardB = collection.find(c => c.id === getTemplateId(bId));
      if (!cardA || !cardB) return 0;
      if (cardA.type !== cardB.type) return cardA.type === CardType.MONSTER ? -1 : 1;
      return cardA.name.localeCompare(cardB.name);
    });
    onUpdateDeck({ ...currentDeck, mainCards: sortedIds });
  };

  const publicCollection = React.useMemo(() => 
    collection.filter(c => c.isPublic === true), 
  [collection]);

  const filteredCollection = React.useMemo(() => {
    const filtered = publicCollection.filter(card => {
      try {
        const matchesSearch = (card?.name || '').toLowerCase().includes((searchQuery || '').toLowerCase());
        const matchesType = filterType === 'ALL' || card?.type === filterType;
        const matchesAttribute = filterAttribute === 'ALL' || card?.attribute === filterAttribute;
        const ownsPhysical = physicalCards.some(pc => pc.templateId === card?.id);
        const matchesOwnership = showUnowned || ownsPhysical;
        return matchesSearch && matchesType && matchesAttribute && matchesOwnership;
      } catch (e) {
        return false;
      }
    });

    return [...filtered].sort((a, b) => {
      if (sortType === 'NAME') return (a?.name || '').localeCompare(b?.name || '');
      if (sortType === 'LEVEL') return (b?.level || 0) - (a?.level || 0);
      if (sortType === 'ATK') return (b?.atk || 0) - (a?.atk || 0);
      return 0;
    });
  }, [publicCollection, searchQuery, filterType, filterAttribute, sortType, showUnowned, physicalCards]);

  const mainDeckCardsInfo = currentDeck.mainCards.map(id => {
    const pc = physicalCards.find(p => p.id === id);
    const templateId = pc ? pc.templateId : id;
    const def = collection.find(c => c.id === templateId);
    return { id, def, isPhysical: !!pc, physicalCard: pc };
  }).filter(info => info.def !== undefined);

  const isValid = mainDeckCardsInfo.length >= 30 && mainDeckCardsInfo.length <= 60 
    && mainDeckCardsInfo.every(info => info.isPhysical && info.physicalCard!.durability > 0);

  return (
    <div className="flex-1 w-full min-h-0 flex flex-col lg:flex-row gap-6 h-full overflow-hidden p-2 select-none">
      
      {/* LEFT PANEL: Card Detail & Operations */}
      <div className="hidden xl:flex flex-col w-[400px] shrink-0 animate-in fade-in slide-in-from-left-4">
        <div className="h-full space-y-4 flex flex-col items-center bg-slate-900/40 border border-slate-800 p-6 rounded-[2rem] backdrop-blur-xl overflow-y-auto custom-scrollbar-wide">
          
          {selectedCard ? (
            <div className="w-full space-y-6 flex-1 flex flex-col">
              <div className="flex flex-col items-center">
                <Card card={selectedCard} className="w-full max-w-[380px] shadow-2xl mt-2" />
                
                {/* Limit & Current Count Info & Actions */}
                <div className="mt-4 flex items-center justify-between bg-slate-950/80 border border-slate-800/50 px-4 py-3 rounded-2xl w-full">
                  <button 
                    onClick={() => {
                      const idx = currentDeck.mainCards.findLastIndex(id => {
                        const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                        return tId === selectedCard.id;
                      });
                      if (idx !== -1) removeFromDeck(idx);
                    }}
                    disabled={!currentDeck.mainCards.some(id => {
                      const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                      return tId === selectedCard.id;
                    })}
                    className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white flex items-center justify-center transition-all active:scale-95 border border-slate-700 shrink-0"
                    title="Remove Copy"
                  >
                    <Minus className="w-5 h-5" />
                  </button>

                  <div className="flex items-center gap-4">
                     <div className="flex flex-col items-center">
                       <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">In Deck</span>
                       <span className="text-xl font-black text-indigo-400">
                         {currentDeck.mainCards.filter(id => {
                           const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                           return tId === selectedCard.id;
                         }).length}
                       </span>
                     </div>
                     <div className="w-px h-8 bg-slate-800" />
                     <div className="flex flex-col items-center">
                       <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Limit</span>
                       <span className={`text-xl font-black ${selectedCard.limit === 0 ? 'text-red-500' : 'text-slate-200'}`}>
                         {selectedCard.limit ?? 3}
                       </span>
                     </div>
                  </div>

                  <button 
                    onClick={() => addToDeck(selectedCard)}
                    disabled={(currentDeck.mainCards.filter(id => {
                      const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                      return tId === selectedCard.id;
                    }).length >= (selectedCard.limit ?? 3)) || selectedCard.limit === 0}
                    className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white flex items-center justify-center transition-all active:scale-95 shadow-lg shadow-indigo-900/20 shrink-0"
                    title="Add Copy"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Physical Copies Summary */}
              {selectedCard && (
                <div className="mt-auto pt-4 flex flex-col w-full">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your Copies</span>
                    <button 
                      onClick={() => setShowCopiesModal(true)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-widest"
                    >
                      (View all your copies)
                    </button>
                  </div>
                  <div className="flex justify-center gap-4">
                    {Array.from({ length: selectedCard.limit ?? 3 }).map((_, i) => {
                      const copiesInDeck = currentDeck.mainCards.filter(id => {
                        const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                        return tId === selectedCard.id;
                      });
                      
                      const copyId = copiesInDeck[i];
                      const isProxyInSlot = copyId === selectedCard.id;
                      const isPhysicalInSlot = copyId && copyId !== selectedCard.id;
                      
                      let content = null;
                      
                      if (isPhysicalInSlot) {
                        const pc = physicalCards.find(p => p.id === copyId);
                        if (pc) {
                          const colorMap = {
                            'ULTRA': 'bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.5)]',
                            'EPIC': 'bg-orange-400 shadow-[0_0_10px_rgba(251,146,60,0.5)]',
                            'SPECIAL': 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]',
                            'NORMAL': 'bg-indigo-400 shadow-[0_0_10px_rgba(129,140,248,0.5)]'
                          };
                          const colorClass = colorMap[pc.quality as keyof typeof colorMap] || colorMap['NORMAL'];
                          content = (
                            <>
                              <div className={`w-5 h-5 rounded-full ${colorClass}`} />
                              <span className="text-[10px] font-bold text-slate-300">
                                {pc.quality === 'ULTRA' ? '∞' : `${pc.durability}/${pc.maxDurability}`}
                              </span>
                            </>
                          );
                        }
                      } else if (isProxyInSlot) {
                        content = (
                           <>
                              <div className="w-5 h-5 rounded-full border-2 border-slate-700 bg-slate-800" />
                              <span className="text-[10px] font-bold text-slate-500">PROXY</span>
                           </>
                        );
                      } else {
                         content = (
                            <>
                               <div className="w-5 h-5 rounded-full border-2 border-slate-800 bg-slate-900/50" />
                               <span className="text-[10px] font-bold text-slate-800">-</span>
                            </>
                         );
                      }
                      
                      return (
                        <div key={i} className="flex flex-col items-center gap-1.5">
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[500px] w-full flex flex-col items-center justify-center text-slate-700 opacity-20 border-2 border-dashed border-slate-800 rounded-[3%]">
              <Info className="w-16 h-16 mb-4" />
              <p className="text-sm font-bold uppercase tracking-widest">Select a Card</p>
            </div>
          )}
        </div>
      </div>

      {/* CENTER PANEL: Deck Grid */}
      <div className="flex-1 flex flex-col bg-slate-950/30 border border-slate-900 rounded-[2rem] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4">
        <div className="px-6 py-4 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md flex flex-wrap gap-4 justify-between items-center z-20 shrink-0">
          <div className="flex items-center gap-6 flex-1 min-w-[300px]">
            <div className="flex items-center gap-1.5 p-1 bg-slate-900/50 rounded-xl border border-slate-800/50">
              <button 
                onClick={onCreateDeck}
                className="p-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                title="Create New Deck"
              >
                <Plus className="w-4 h-4" />
              </button>
              <div className="h-6 w-[1px] bg-slate-800 mx-1" />
              <select 
                value={currentDeck.id}
                onChange={(e) => {
                  const d = decks.find(dk => dk.id === e.target.value);
                  if (d) onSelectDeck(d);
                }}
                className="bg-transparent text-[11px] font-black text-indigo-400 rounded-lg px-2 py-1.5 outline-none cursor-pointer hover:text-indigo-300 transition-colors uppercase tracking-widest"
              >
                {!decks.some(d => d.id === currentDeck.id) && <option value={currentDeck.id} className="bg-slate-900 text-white italic">Unsaved Deck</option>}
                {decks.map(d => <option key={d.id} value={d.id} className="bg-slate-900 text-white">{d.name}</option>)}
              </select>
            </div>

            <div className="relative flex-1 group">
              <input 
                value={currentDeck.name}
                onChange={e => onUpdateDeck({...currentDeck, name: e.target.value})}
                className="bg-transparent text-xl font-black text-white outline-none w-full border-b-2 border-transparent focus:border-indigo-500 transition-all uppercase tracking-tighter placeholder:text-slate-800"
                placeholder="DECK NAME..."
              />
              <div className="absolute -bottom-[2px] left-0 w-0 h-[2px] bg-indigo-500 group-hover:w-full transition-all duration-500 opacity-30" />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onSaveDeck(currentDeck)}
                className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95
                  ${hasUnsavedChanges 
                    ? 'bg-amber-500 text-amber-950 shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse' 
                    : 'bg-emerald-600/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-600/30'
                  }`}
              >
                {hasUnsavedChanges ? (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-slate-950" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {hasUnsavedChanges ? "Save Changes" : "Deck Saved"}
              </button>
              
              <button 
                onClick={sortDeck}
                className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all"
                title="Sort Deck (Monsters > Spells > A-Z)"
              >
                <ArrowDownAz className="w-4 h-4" />
              </button>

              <button 
                onClick={() => onDeleteDeck(currentDeck.id)}
                className="p-2.5 text-slate-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all"
                title="Delete Deck"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="h-10 w-[1px] bg-slate-900" />

            <div className="flex flex-col items-end">
              <span className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isValid ? 'text-emerald-500/50' : 'text-amber-500/50'}`}>
                {isValid ? 'Ready to Duel' : 'Incomplete'}
              </span>
              <div className={`flex items-baseline gap-1 font-black text-2xl tracking-tighter leading-none ${isValid ? 'text-white' : 'text-amber-400'}`}>
                {mainDeckCardsInfo.length}
                <span className="text-xs text-slate-700 tracking-normal font-bold">/ 60</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar-wide relative z-10 bg-slate-950/20 content-start">
          <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
            {mainDeckCardsInfo.map((info, idx) => (
              <div 
                key={`${info.id}-${idx}`}
                onClick={() => setSelectedCard(info.def!)}
                className={`aspect-[63/88] relative group cursor-pointer animate-in zoom-in-95 duration-200 ${!info.isPhysical || info.physicalCard!.durability <= 0 ? 'opacity-40 grayscale' : ''}`}
              >
                <Card card={info.def!} isUltraMiniature className={`group-hover:border-indigo-500 group-hover:-translate-y-1 transition-all ${!info.isPhysical ? 'border-amber-500 border-2' : ''} ${info.isPhysical && info.physicalCard!.durability <= 0 ? 'border-red-500 border-2' : ''}`} />
                {!info.isPhysical && (
                  <div className="absolute top-1 left-1 bg-amber-500 text-amber-950 text-[8px] font-black px-1 py-0.5 rounded shadow">PROXY</div>
                )}
                {info.isPhysical && info.physicalCard!.durability <= 0 && (
                  <div className="absolute top-1 left-1 bg-red-600 text-white text-[8px] font-black px-1 py-0.5 rounded shadow">BROKEN</div>
                )}
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFromDeck(idx); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {[...Array(Math.max(0, 40 - mainDeckCardsInfo.length))].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-[63/88] border border-dashed border-slate-900/10 rounded-lg bg-slate-950/40" />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Collection Browser */}
      <div className="hidden lg:flex flex-col w-[360px] xl:w-[420px] shrink-0 bg-slate-900/40 border border-slate-800 rounded-[2.5rem] backdrop-blur-xl animate-in fade-in slide-in-from-right-4 overflow-hidden">
        <div className="p-4 border-b border-slate-800/50 bg-slate-950/40 shrink-0 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-4 h-4" /> Collection
            </h3>
            <div className="flex items-center gap-2">
              <div className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 font-bold">
                {publicCollection.length} Total
              </div>
            </div>
          </div>
          
          <div className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" />
            <input 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter cards..."
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-slate-200 outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-700"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['ALL', CardType.MONSTER, CardType.SPELL].map(type => (
              <button 
                key={type}
                onClick={() => setFilterType(type as any)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all
                  ${filterType === type ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
              >
                {type === 'ALL' ? 'Everything' : type}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
            <div className="flex items-center gap-2">
              <ListFilter className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Order By</span>
            </div>
            <div className="flex bg-slate-950/50 p-1 rounded-xl border border-slate-800/50">
               {['NAME', 'LEVEL', 'ATK'].map(s => (
                 <button
                   key={s}
                   onClick={() => setSortType(s as any)}
                   className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all shadow-sm
                     ${sortType === s ? 'bg-amber-500 text-slate-950 shadow-amber-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   {s}
                 </button>
               ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest cursor-pointer select-none hover:text-slate-300 transition-colors">
              <input 
                type="checkbox" 
                checked={showUnowned} 
                onChange={e => setShowUnowned(e.target.checked)} 
                className="w-3 h-3 accent-indigo-500 bg-slate-900 border-slate-700 rounded"
              />
              Show Unowned Cards
            </label>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 xl:grid-cols-4 gap-3 content-start custom-scrollbar-wide">
          {filteredCollection.map(card => {
            const ownedCount = physicalCards.filter(pc => pc.templateId === card.id).length;
            const isUnowned = ownedCount === 0;
            const currentCount = currentDeck.mainCards.filter(id => {
              const tId = physicalCards.find(p => p.id === id)?.templateId || id;
              return tId === card.id;
            }).length;
            const limit = card.limit ?? 3;
            const isLimitReached = currentCount >= limit;
            const isBanned = limit === 0;

            return (
              <div 
                key={card.id}
                onClick={() => {
                  if (selectedCard?.id === card.id) {
                    if (!isLimitReached && !isBanned) addToDeck(card);
                  } else {
                    setSelectedCard(card);
                  }
                }}
                className={`aspect-[63/88] relative transition-all duration-300
                  ${selectedCard?.id === card.id ? 'scale-95' : 'hover:scale-105'}
                  ${isUnowned ? 'opacity-30 grayscale' : isBanned || isLimitReached ? 'opacity-50' : 'cursor-pointer'}`}
              >
                <div className={`w-full h-full rounded-[3.5%] overflow-hidden border-2 transition-all duration-300
                  ${selectedCard?.id === card.id 
                    ? 'border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.4)]' 
                    : 'border-transparent hover:border-slate-800/50'}`}>
                  <Card card={card} isMiniature />
                </div>
                
                {/* Limit Badge */}
                <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-md font-black text-[7px] shadow-lg z-20 border
                  ${isBanned ? 'bg-red-600 text-white border-red-400' : 
                    isUnowned ? 'bg-slate-800 text-slate-500 border-slate-700' :
                    'bg-indigo-600 text-white border-indigo-400'}`}>
                  {isBanned ? 'BAN' : `OWNED: ${ownedCount}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Copies Modal */}
      {showCopiesModal && selectedCard && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl relative">
            <button 
              onClick={() => setShowCopiesModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-xl font-black text-white uppercase tracking-widest mb-6 border-b border-slate-800 pb-4">
              All Copies: {selectedCard.name}
            </h2>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar-wide pr-2 space-y-3">
              {physicalCards.filter(pc => pc.templateId === selectedCard.id).length > 0 ? (
                physicalCards.filter(pc => pc.templateId === selectedCard.id).map(pc => {
                  const isInDeck = currentDeck.mainCards.includes(pc.id);
                  return (
                    <div key={pc.id} className="flex justify-between items-center bg-slate-950/50 p-4 rounded-2xl border border-slate-800">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs font-black uppercase tracking-widest ${pc.quality === 'ULTRA' ? 'text-fuchsia-400' : pc.quality === 'EPIC' ? 'text-orange-400' : pc.quality === 'SPECIAL' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                          {pc.quality} {pc.quality === 'ULTRA' && pc.serialNumber ? `(Serial: #${pc.serialNumber}/1000)` : ''}
                        </span>
                        <span className={`text-sm font-bold ${pc.durability === 0 ? 'text-red-500' : 'text-slate-300'}`}>
                          Durability: {pc.quality === 'ULTRA' ? '∞' : `${pc.durability}/${pc.maxDurability}`}
                        </span>
                        <span className="text-xs text-slate-500 font-bold uppercase">
                          Pulled by: {pc.originalOwner} {pc.winCount > 0 ? `• Wins: ${pc.winCount}` : ''}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {isInDeck ? (
                          <button 
                            onClick={() => {
                              const idx = currentDeck.mainCards.indexOf(pc.id);
                              if (idx !== -1) {
                                const newCards = [...currentDeck.mainCards];
                                newCards[idx] = pc.templateId; // Revert to ghost copy
                                onUpdateDeck({ ...currentDeck, mainCards: newCards });
                              }
                            }}
                            className="px-4 py-2 bg-emerald-500/20 hover:bg-red-500/20 text-emerald-400 hover:text-red-400 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-500/30 hover:border-red-500/30 transition-colors flex items-center gap-2"
                          >
                            <span>(O) SELECTED</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => {
                              const proxyIdx = currentDeck.mainCards.indexOf(pc.templateId);
                              if (proxyIdx !== -1) {
                                const newCards = [...currentDeck.mainCards];
                                newCards[proxyIdx] = pc.id;
                                onUpdateDeck({ ...currentDeck, mainCards: newCards });
                              } else {
                                const currentCount = currentDeck.mainCards.filter(id => {
                                  const tId = physicalCards.find(p => p.id === id)?.templateId || id;
                                  return tId === pc.templateId;
                                }).length;
                                
                                if (currentCount < (selectedCard.limit ?? 3) && selectedCard.limit !== 0) {
                                  onUpdateDeck({ ...currentDeck, mainCards: [...currentDeck.mainCards, pc.id] });
                                }
                              }
                            }}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-colors border border-slate-700 flex items-center gap-2"
                          >
                            <span>( ) UNSELECTED</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <p className="font-bold uppercase tracking-widest text-sm">You do not own any copies of this card.</p>
                  <p className="text-xs mt-2 text-slate-600">You are using unlimited proxy copies in your deck.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
