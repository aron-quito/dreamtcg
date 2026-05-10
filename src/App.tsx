/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Dna, 
  Layers, 
  Gamepad2, 
  PlusCircle,
  LayoutDashboard,
  Menu,
  X
} from 'lucide-react';
import { CardBuilder } from './components/CardBuilder';
import { DeckBuilder } from './components/DeckBuilder';
import { TestMode } from './components/TestMode';
import { 
  CardType, 
  CardAttribute, 
  TriggerType, 
  FrequencyType, 
  CardLocation,
  CardDefinition,
  DeckDefinition,
  GameState
} from './types';

// Initial Mock Data
const INITIAL_COLLECTION: CardDefinition[] = [
  {
    id: 'base_01',
    name: 'Dream Weaver',
    type: CardType.MONSTER,
    level: 4,
    atk: 1800,
    def: 1200,
    attribute: CardAttribute.LIGHT,
    description: 'When summoned, draw 2 cards by paying 500 LP.',
    isCustom: false,
    effects: [
      {
        id: 'eff_01',
        name: 'Visionary Reach',
        restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.ONCE_PER_TURN },
        trigger: { type: TriggerType.ON_SUMMON },
        costs: [{ action: 'PAY_LP', params: { n: 500 } }],
        resolutions: [{ action: 'DRAW', params: { n: 2 } }]
      }
    ]
  },
  {
    id: 'base_02',
    name: 'Nightmare Shade',
    type: CardType.MONSTER,
    level: 4,
    atk: 1500,
    def: 1500,
    attribute: CardAttribute.DARK,
    description: 'Any time: Banish 1 card from opponent GY.',
    isCustom: false,
    effects: [
      {
        id: 'eff_02',
        name: 'Shadow Banish',
        restriction: { locations: [CardLocation.MONSTER_ZONE], frequency: FrequencyType.UNLIMITED },
        trigger: { type: TriggerType.ANY_TIME },
        costs: [],
        resolutions: [{ action: 'BANISH_CARD', params: { target: 'OPPONENT_GY' } }]
      }
    ]
  }
];

const INITIAL_GAME_STATE: GameState = {
  players: [
    { id: 'p1', name: 'Player 1', lp: 8000, deck: [], hand: [], monsterZones: [null, null, null], spellZones: [null, null, null], gy: [], extraDeck: [] },
    { id: 'p2', name: 'Player 2', lp: 8000, deck: [], hand: [], monsterZones: [null, null, null], spellZones: [null, null, null], gy: [], extraDeck: [] }
  ],
  turn: 1,
  activePlayerIndex: 0,
  chain: []
};

type Module = 'BUILDER' | 'DECK' | 'TEST';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('BUILDER');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collection, setCollection] = useState<CardDefinition[]>(INITIAL_COLLECTION);
  const [activeDeck, setActiveDeck] = useState<DeckDefinition>({
    id: 'deck_01',
    name: 'My Starter Deck',
    mainCards: ['base_01', 'base_01', 'base_02'],
    extraCards: []
  });

  // Fetch collection on mount
  React.useEffect(() => {
    fetch('http://localhost:3001/api/cards')
      .then(res => res.json())
      .then(data => setCollection(data))
      .catch(err => console.error("Failed to load collection:", err));
  }, []);

  const handleSaveCard = async (card: CardDefinition) => {
    try {
      const response = await fetch('http://localhost:3001/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card)
      });

      if (response.ok) {
        setCollection(prev => {
          const exists = prev.findIndex(c => c.id === card.id);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = card;
            return next;
          }
          return [...prev, card];
        });
        setActiveModule('DECK');
      }
    } catch (error) {
      console.error("Failed to save card:", error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation */}
      <div 
        className={`fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60] lg:hidden transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMenuOpen(false)}
      />
      
      <nav className={`fixed left-0 top-0 bottom-0 w-20 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-8 gap-8 z-[70] transition-transform duration-300 lg:translate-x-0 ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20 mb-4">
          <Dna className="w-8 h-8 text-white" />
        </div>
        
        <div className="flex flex-col gap-4">
          <NavItem 
            active={activeModule === 'BUILDER'} 
            onClick={() => { setActiveModule('BUILDER'); setIsMenuOpen(false); }}
            icon={<PlusCircle className="w-6 h-6" />}
            label="Builder"
          />
          <NavItem 
            active={activeModule === 'DECK'} 
            onClick={() => { setActiveModule('DECK'); setIsMenuOpen(false); }}
            icon={<Layers className="w-6 h-6" />}
            label="Decks"
          />
          <NavItem 
            active={activeModule === 'TEST'} 
            onClick={() => { setActiveModule('TEST'); setIsMenuOpen(false); }}
            icon={<Gamepad2 className="w-6 h-6" />}
            label="Sandbox"
          />
        </div>

        <div className="mt-auto">
           <LayoutDashboard className="w-6 h-6 text-slate-600 hover:text-slate-400 cursor-pointer transition-colors" />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="lg:pl-20 min-h-screen">
        <header className="px-4 md:px-8 py-6 border-b border-slate-900 flex justify-between items-center bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 bg-slate-900 border border-slate-800 rounded-lg lg:hidden text-slate-400 hover:text-white"
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
            <div>
            <h1 className="text-xl font-bold tracking-tight">
              {activeModule === 'BUILDER' && "Custom Card Builder"}
              {activeModule === 'DECK' && "Deck Management"}
              {activeModule === 'TEST' && "Simulation Sandbox"}
            </h1>
            <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mt-0.5">
              DreamsTCG Engine v0.1
            </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono text-slate-400">
               Collection: {collection.length} Cards
             </div>
          </div>
        </header>

        <section className="p-8 max-w-[1400px] mx-auto">
          {activeModule === 'BUILDER' && (
            <CardBuilder onSave={handleSaveCard} />
          )}
          {activeModule === 'DECK' && (
            <DeckBuilder 
              collection={collection} 
              deck={activeDeck} 
              onUpdateDeck={setActiveDeck} 
            />
          )}
          {activeModule === 'TEST' && (
            <TestMode 
              initialState={INITIAL_GAME_STATE} 
              cards={collection} 
            />
          )}
        </section>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`relative group p-3 rounded-xl transition-all ${
        active ? 'bg-indigo-600/10 text-indigo-400 shadow-[inset_0_0_12px_rgba(79,70,229,0.1)]' : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {icon}
      <span className="absolute left-full ml-4 px-2 py-1 bg-slate-800 text-white text-[10px] uppercase font-bold rounded opacity-0 group-hover:opacity-100 translate-x-[-10px] group-hover:translate-x-0 transition-all pointer-events-none whitespace-nowrap z-[100]">
        {label}
      </span>
    </button>
  );
}

