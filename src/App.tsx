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
  DeckDefinition
} from './types';
import { ConfirmModal } from './components/ConfirmModal';

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



type Module = 'BUILDER' | 'DECK' | 'TEST';

export default function App() {
  const [activeModule, setActiveModule] = useState<Module>('BUILDER');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collection, setCollection] = useState<CardDefinition[]>(INITIAL_COLLECTION);
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [activeDeck, setActiveDeck] = useState<DeckDefinition>({
    id: 'deck_default',
    name: 'New Deck',
    mainCards: [],
    extraCards: []
  });

  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant: 'danger' | 'warning' | 'info';
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);

  const closeModal = () => setModalConfig(prev => prev ? { ...prev, isOpen: false } : null);

  // Fetch initial data
  React.useEffect(() => {
    // Fetch Cards
    fetch('http://localhost:3001/api/cards')
      .then(res => res.json())
      .then(data => setCollection(data))
      .catch(err => console.error("Failed to load collection:", err));

    // Fetch Decks
    fetch('http://localhost:3001/api/decks')
      .then(res => res.json())
      .then(data => {
        setDecks(data);
        if (data.length > 0) setActiveDeck(data[0]);
      })
      .catch(err => console.error("Failed to load decks:", err));
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
      }
    } catch (error) {
      console.error("Failed to save card:", error);
    }
  };

  const handleDeleteCard = async (id: string) => {
    const cardToDelete = collection.find(c => c.id === id);
    if (!cardToDelete) return;

    setModalConfig({
      isOpen: true,
      title: "Delete Card",
      message: `Are you sure you want to PERMANENTLY DELETE the card "${cardToDelete.name}"? This will remove it from all decks.`,
      confirmText: "Delete Card",
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/cards/${id}`, {
            method: 'DELETE'
          });
          if (response.ok) {
            setCollection(prev => prev.filter(c => c.id !== id));
          }
        } catch (error) {
          console.error("Failed to delete card:", error);
        }
        closeModal();
      }
    });
  };

  const isDeckDirty = (deck: DeckDefinition) => {
    const savedDeck = decks.find(d => d.id === deck.id);
    if (!savedDeck) return deck.mainCards.length > 0; // New unsaved deck
    return JSON.stringify(deck.mainCards) !== JSON.stringify(savedDeck.mainCards) || deck.name !== savedDeck.name;
  };

  const confirmUnsavedChanges = async (onProceed: () => void) => {
    if (isDeckDirty(activeDeck)) {
      setModalConfig({
        isOpen: true,
        title: "Unsaved Changes",
        message: `The deck "${activeDeck.name}" has changes. Do you want to save them before leaving?`,
        confirmText: "Save & Continue",
        cancelText: "Discard Changes",
        variant: 'warning',
        onConfirm: async () => {
          await handleSaveDeck(activeDeck);
          closeModal();
          onProceed();
        },
        onCancel: () => {
          closeModal();
          onProceed();
        }
      });
    } else {
      onProceed();
    }
  };

  const handleSaveDeck = async (deck: DeckDefinition) => {
    try {
      const response = await fetch('http://localhost:3001/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deck)
      });

      if (response.ok) {
        setDecks(prev => {
          const exists = prev.findIndex(d => d.id === deck.id);
          if (exists >= 0) {
            const next = [...prev];
            next[exists] = deck;
            return next;
          }
          return [...prev, deck];
        });
      }
    } catch (error) {
      console.error("Failed to save deck:", error);
    }
  };

  const handleDeleteDeck = async (id: string) => {
    const deckToDelete = decks.find(d => d.id === id) || activeDeck;
    
    setModalConfig({
      isOpen: true,
      title: "Delete Deck",
      message: `⚠️ Are you sure you want to PERMANENTLY DELETE the deck "${deckToDelete.name}"? This action cannot be undone.`,
      confirmText: "Delete Permanently",
      variant: 'danger',
      onConfirm: async () => {
        try {
          const response = await fetch(`http://localhost:3001/api/decks/${id}`, {
            method: 'DELETE'
          });

          if (response.ok) {
            setDecks(prev => prev.filter(d => d.id !== id));
            if (activeDeck.id === id) {
              const newDeck = { id: crypto.randomUUID(), name: 'New Deck', mainCards: [], extraCards: [] };
              setActiveDeck(newDeck);
            }
          }
        } catch (error) {
          console.error("Failed to delete deck:", error);
        }
        closeModal();
      }
    });
  };

  const handleCreateDeck = () => {
    confirmUnsavedChanges(() => {
      const newDeck = { id: crypto.randomUUID(), name: 'New Deck', mainCards: [], extraCards: [] };
      setActiveDeck(newDeck);
    });
  };

  const handleSelectDeck = (deck: DeckDefinition) => {
    if (activeDeck.id === deck.id) return;
    confirmUnsavedChanges(() => {
      setActiveDeck(deck);
    });
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
            <CardBuilder 
              collection={collection} 
              onSave={handleSaveCard} 
              onDelete={handleDeleteCard}
            />
          )}
          {activeModule === 'DECK' && (
            <DeckBuilder 
              collection={collection} 
              decks={decks}
              currentDeck={activeDeck} 
              onUpdateDeck={setActiveDeck}
              onSaveDeck={handleSaveDeck}
              onDeleteDeck={handleDeleteDeck}
              onCreateDeck={handleCreateDeck}
              onSelectDeck={handleSelectDeck}
              hasUnsavedChanges={isDeckDirty(activeDeck)}
            />
          )}
          {activeModule === 'TEST' && (
            <TestMode 
              cards={collection}
              decks={decks}
            />
          )}
        </section>
      </main>

      {modalConfig && (
        <ConfirmModal 
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          message={modalConfig.message}
          confirmText={modalConfig.confirmText}
          cancelText={modalConfig.cancelText}
          variant={modalConfig.variant}
          onConfirm={modalConfig.onConfirm}
          onCancel={modalConfig.onCancel || closeModal}
          onClose={closeModal}
        />
      )}
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

