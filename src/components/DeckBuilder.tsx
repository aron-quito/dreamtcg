import React from 'react';
import { 
  Package, 
  Trash2, 
  Search, 
  Filter, 
  Layers, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { CardDefinition, DeckDefinition } from '../types';

interface DeckBuilderProps {
  collection: CardDefinition[];
  deck: DeckDefinition;
  onUpdateDeck: (deck: DeckDefinition) => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ collection, deck, onUpdateDeck }) => {
  const addToDeck = (cardId: string) => {
    onUpdateDeck({
      ...deck,
      mainCards: [...deck.mainCards, cardId]
    });
  };

  const removeFromDeck = (index: number) => {
    const newCards = [...deck.mainCards];
    newCards.splice(index, 1);
    onUpdateDeck({ ...deck, mainCards: newCards });
  };

  const deckSize = deck.mainCards.length;
  const isValid = deckSize >= 30 && deckSize <= 40;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* My Collection */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Package className="w-4 h-4" /> My Vault
          </h3>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input 
                placeholder="Search cards..."
                className="bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-4 text-xs text-slate-300 outline-none focus:border-indigo-500"
              />
            </div>
            <button className="p-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-500">
              <Filter className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {collection.map(card => (
            <div 
              key={card.id}
              onClick={() => addToDeck(card.id)}
              className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 hover:border-indigo-500 cursor-pointer transition-all group relative overflow-hidden"
            >
              <div className="text-[10px] uppercase font-bold text-slate-500 mb-1">{card.type}</div>
              <div className="text-sm font-bold text-slate-200 truncate">{card.name}</div>
              <div className="mt-2 flex items-center justify-between">
                 <span className="text-[10px] font-mono text-indigo-400">ATK {card.atk}</span>
                 <Layers className="w-3 h-3 text-slate-700 group-hover:text-indigo-500 transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Deck */}
      <div className="lg:col-span-5 flex flex-col h-[70vh]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" /> Active Deck
          </h3>
          <div className={`flex items-center gap-2 text-xs font-bold ${isValid ? 'text-emerald-400' : 'text-amber-400'}`}>
            {isValid ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {deckSize} / 40
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <input 
              value={deck.name}
              onChange={e => onUpdateDeck({...deck, name: e.target.value})}
              className="bg-transparent text-lg font-bold text-slate-100 outline-none w-full"
              placeholder="Deck Name..."
            />
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {deck.mainCards.map((cardId, idx) => {
              const card = collection.find(c => c.id === cardId);
              if (!card) return null;
              return (
                <div key={idx} className="flex items-center justify-between p-2 bg-slate-950 rounded-lg border border-slate-800 group">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-slate-600">{idx + 1}</span>
                    <span className="text-sm font-medium text-slate-300">{card.name}</span>
                  </div>
                  <button 
                    onClick={() => removeFromDeck(idx)}
                    className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {deckSize === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center px-8">
                <Layers className="w-12 h-12 mb-4 opacity-10" />
                <p className="text-sm">Your deck is empty. Tap cards in your vault to add them.</p>
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-950 border-t border-slate-800">
            <button 
              disabled={!isValid}
              className={`w-full py-3 rounded-xl font-bold transition-all ${
                isValid ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Export & Test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
