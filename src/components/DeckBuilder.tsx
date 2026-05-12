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
import { CardDefinition, DeckDefinition, CardType, CardAttribute } from '../types';
import { Card } from './Card';

interface DeckBuilderProps {
  collection: CardDefinition[];
  decks: DeckDefinition[];
  currentDeck: DeckDefinition;
  onUpdateDeck: (deck: DeckDefinition) => void;
  onSaveDeck: (deck: DeckDefinition) => void;
  onDeleteDeck: (id: string) => void;
  onCreateDeck: () => void;
  onSelectDeck: (deck: DeckDefinition) => void;
  onNavigateToBuilder?: () => void;
  hasUnsavedChanges?: boolean;
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
  onNavigateToBuilder,
  hasUnsavedChanges = false
}) => {
  const [selectedCard, setSelectedCard] = React.useState<CardDefinition | null>(collection.find(c => c.isPublic) || null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [filterType, setFilterType] = React.useState<CardType | 'ALL'>('ALL');
  const [filterAttribute, setFilterAttribute] = React.useState<CardAttribute | 'ALL'>('ALL');
  const [sortType, setSortType] = React.useState<'NAME' | 'LEVEL' | 'ATK'>('NAME');

  const addToDeck = (card: CardDefinition) => {
    if (card.isPublic === false) return;
    const count = currentDeck.mainCards.filter(id => id === card.id).length;
    const limit = card.limit ?? 3;
    if (limit === 0 || count >= limit) return;

    onUpdateDeck({
      ...currentDeck,
      mainCards: [...currentDeck.mainCards, card.id]
    });
  };

  const removeFromDeck = (index: number) => {
    const newCards = [...currentDeck.mainCards];
    newCards.splice(index, 1);
    onUpdateDeck({ ...currentDeck, mainCards: newCards });
  };

  const sortDeck = () => {
    const sortedIds = [...currentDeck.mainCards].sort((aId, bId) => {
      const cardA = collection.find(c => c.id === aId);
      const cardB = collection.find(c => c.id === bId);
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
      const matchesSearch = card.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'ALL' || card.type === filterType;
      const matchesAttribute = filterAttribute === 'ALL' || card.attribute === filterAttribute;
      return matchesSearch && matchesType && matchesAttribute;
    });

    return [...filtered].sort((a, b) => {
      if (sortType === 'NAME') return a.name.localeCompare(b.name);
      if (sortType === 'LEVEL') return (b.level || 0) - (a.level || 0);
      if (sortType === 'ATK') return (b.atk || 0) - (a.atk || 0);
      return 0;
    });
  }, [publicCollection, searchQuery, filterType, filterAttribute, sortType]);

  const mainDeckCards = currentDeck.mainCards.map(id => collection.find(c => c.id === id)).filter(Boolean) as CardDefinition[];
  const isValid = mainDeckCards.length >= 30 && mainDeckCards.length <= 60;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full overflow-hidden p-2 select-none">
      
      {/* LEFT PANEL: Card Detail & Operations */}
      <div className="hidden xl:flex flex-col w-[400px] shrink-0 animate-in fade-in slide-in-from-left-4">
        <div className="h-full space-y-6 flex flex-col items-center bg-slate-900/40 border border-slate-800 p-8 rounded-[2.5rem] backdrop-blur-xl overflow-y-auto custom-scrollbar">
          <div className="w-full text-center">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Card Operations</h3>
          </div>
          
          {selectedCard ? (
            <div className="w-full space-y-6 flex-1 flex flex-col">
              <div className="flex flex-col items-center">
                <Card card={selectedCard} className="w-full max-w-[320px] shadow-2xl" />
                
                {/* Limit & Current Count Info */}
                <div className="mt-4 flex items-center gap-4 bg-slate-950/80 border border-slate-800/50 px-6 py-3 rounded-2xl">
                   <div className="flex flex-col items-center">
                     <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">In Deck</span>
                     <span className="text-xl font-black text-indigo-400">
                       {currentDeck.mainCards.filter(id => id === selectedCard.id).length}
                     </span>
                   </div>
                   <div className="w-px h-8 bg-slate-800" />
                   <div className="flex flex-col items-center">
                     <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Legal Limit</span>
                     <span className={`text-xl font-black ${selectedCard.limit === 0 ? 'text-red-500' : 'text-slate-200'}`}>
                       {selectedCard.limit ?? 3}
                     </span>
                   </div>
                </div>
              </div>

              {/* Main Deck Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => addToDeck(selectedCard)}
                  disabled={(currentDeck.mainCards.filter(id => id === selectedCard.id).length >= (selectedCard.limit ?? 3)) || selectedCard.limit === 0}
                  className="py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Add Copy
                </button>
                <button 
                  onClick={() => {
                    const idx = currentDeck.mainCards.indexOf(selectedCard.id);
                    if (idx !== -1) removeFromDeck(idx);
                  }}
                  disabled={!currentDeck.mainCards.includes(selectedCard.id)}
                  className="py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 border border-slate-700 flex items-center justify-center gap-2"
                >
                  <Minus className="w-4 h-4" /> Remove
                </button>
              </div>

              {/* Economy Actions (Future) */}
              <div className="mt-auto pt-6 border-t border-slate-800/50 space-y-3">
                <div className="flex items-center gap-2 mb-1 px-2">
                  <Zap className="w-3 h-3 text-amber-500" />
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Marketplace</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button className="py-3 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-500 border border-emerald-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2">
                    <Swords className="w-3 h-3" /> Buy Card
                  </button>
                  <button className="py-3 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2">
                    <Trash2 className="w-3 h-3" /> Sell Card
                  </button>
                </div>
                <p className="text-[8px] text-slate-600 text-center italic uppercase opacity-50">Economy features coming in future patch</p>
              </div>
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
      <div className="flex-1 flex flex-col bg-slate-950/30 border border-slate-900 rounded-[2.5rem] overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-4">
        <div className="px-6 py-4 border-b border-slate-900 bg-slate-950/40 backdrop-blur-md flex flex-wrap gap-6 justify-between items-center z-20">
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
                {mainDeckCards.length}
                <span className="text-xs text-slate-700 tracking-normal font-bold">/ 60</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/20 content-start">
          <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
            {mainDeckCards.map((card, idx) => (
              <div 
                key={`${card.id}-${idx}`}
                onClick={() => setSelectedCard(card)}
                className="aspect-[63/88] relative group cursor-pointer animate-in zoom-in-95 duration-200"
              >
                <Card card={card} isUltraMiniature className="group-hover:border-indigo-500 group-hover:-translate-y-1 transition-all" />
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFromDeck(idx); }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {[...Array(Math.max(0, 40 - mainDeckCards.length))].map((_, i) => (
              <div key={`empty-${i}`} className="aspect-[63/88] border border-dashed border-slate-900/10 rounded-lg bg-slate-950/40" />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL: Collection Search */}
      <div className="w-full lg:w-[320px] 2xl:w-[400px] shrink-0 flex flex-col bg-slate-900 border border-slate-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-4">
        <div className="p-6 border-b border-slate-800 bg-slate-950/30 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Package className="w-4 h-4" /> Collection
            </h3>
            <div className="flex items-center gap-2">
              {onNavigateToBuilder && (
                <button 
                  onClick={onNavigateToBuilder}
                  className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-lg transition-all group"
                  title="Go to Card Builder"
                >
                  <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" />
                </button>
              )}
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
        </div>

        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 2xl:grid-cols-3 gap-3 content-start custom-scrollbar">
          {filteredCollection.map(card => {
            const currentCount = currentDeck.mainCards.filter(id => id === card.id).length;
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
                  ${isBanned || isLimitReached ? 'opacity-40 grayscale' : 'cursor-pointer'}`}
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
                    isLimitReached ? 'bg-slate-700 text-slate-300 border-slate-500' : 
                    'bg-indigo-600 text-white border-indigo-400'}`}>
                  {isBanned ? 'BAN' : `${currentCount}/${limit}`}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
