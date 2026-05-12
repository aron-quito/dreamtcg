/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { Home } from './components/Home';
import { Auth } from './components/Auth';
import { DuelLobby } from './components/DuelLobby';
import { DuelRoom } from './components/DuelRoom';
import { RPSPhase } from './components/RPSPhase';
import { DuelBoard } from './components/DuelBoard';

interface UserData {
  name: string;
  email: string;
}

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



type Module = 'HOME' | 'BUILDER' | 'DECK' | 'TEST' | 'SHOP' | 'DUEL_LOBBY' | 'DUEL_ROOM' | 'DUEL_RPS';

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [collection, setCollection] = useState<CardDefinition[]>(INITIAL_COLLECTION);
  const [decks, setDecks] = useState<DeckDefinition[]>([]);
  const [activeDeck, setActiveDeck] = useState<DeckDefinition>({
    id: 'deck_default',
    name: 'New Deck',
    mainCards: [],
    extraCards: []
  });
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [activeModule, setActiveModule] = useState<'HOME' | 'BUILDER' | 'DECK' | 'SHOP' | 'TEST' | 'DUEL_LOBBY' | 'DUEL_ROOM' | 'DUEL_RPS'>('HOME');

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

  // Reconnection Logic
  useEffect(() => {
    if (user) {
      const checkActiveRoom = async () => {
        try {
          const res = await fetch(`http://127.0.0.1:3001/api/rooms/active?email=${user.email}`);
          if (res.ok) {
            const roomData = await res.json();
            if (roomData) {
              if (roomData.status === 'DUELING' || roomData.status === 'RPS') {
                // RECONNECT TO MATCH
                setCurrentRoomId(roomData.id);
                const isSpec = roomData.spectator1_email === user.email || roomData.spectator2_email === user.email;
                setIsSpectator(isSpec);
                setActiveModule(roomData.status === 'DUELING' ? 'TEST' : 'DUEL_RPS');
              } else if (roomData.status === 'LOBBY') {
                // AUTO-LEAVE ON REFRESH (as requested)
                await fetch('http://127.0.0.1:3001/api/rooms/leave', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ roomId: roomData.id, email: user.email })
                });
              }
            }
          }
        } catch (e) {}
      };
      checkActiveRoom();
    }
  }, [user]);

  // Presence Heartbeat
  useEffect(() => {
    if (user) {
      const interval = setInterval(async () => {
        try {
          await fetch('http://127.0.0.1:3001/api/users/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
          });
        } catch (e) {}
      }, 30000); // 30s heartbeats
      return () => clearInterval(interval);
    }
  }, [user]);

  // Fetch initial data
  React.useEffect(() => {
    if (!user) return;

    // Fetch Cards
    fetch(`http://localhost:3001/api/cards?userEmail=${user.email}`)
      .then(res => res.json())
      .then(data => setCollection(data))
      .catch(err => console.error("Failed to load collection:", err));

    // Fetch Decks
    fetch(`http://localhost:3001/api/decks?userEmail=${user.email}`)
      .then(res => res.json())
      .then(data => {
        setDecks(data);
        if (data.length > 0) setActiveDeck(data[0]);
      })
      .catch(err => console.error("Failed to load decks:", err));
  }, [user]);

  const handleSaveCard = async (card: CardDefinition) => {
    if (!user) return;
    try {
      const response = await fetch('http://localhost:3001/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card, userEmail: user.email })
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
    if (!user) return;
    try {
      const response = await fetch('http://localhost:3001/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deck, userEmail: user.email })
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

  if (!user) {
    return <Auth onLogin={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* Sidebar Navigation Removed - Replaced by Back Button in Header */}

      {/* Main Content Area */}
      <main className="min-h-screen transition-all duration-500">
        {activeModule !== 'HOME' && (
          <header className="px-4 md:px-8 py-6 border-b border-slate-900 flex justify-between items-center bg-slate-950/50 backdrop-blur-xl sticky top-0 z-40">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveModule('HOME')}
                className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all group shadow-lg"
              >
                <div className="p-1 rounded-lg bg-slate-800 group-hover:bg-indigo-600 transition-colors">
                  <LayoutDashboard className="w-4 h-4 text-white" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">Back to Menu</span>
              </button>
              <div className="h-8 w-[1px] bg-slate-800 mx-1" />
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
        )}

        <section className={`${activeModule === 'HOME' ? 'p-0 max-w-none' : 'p-8 max-w-[1400px]'} mx-auto`}>
          {activeModule === 'HOME' && (
            <Home 
              onNavigate={setActiveModule}
              cardCount={collection.length}
              deckCount={decks.length}
              userName={user.name}
              onLogout={() => setUser(null)}
              onNavigateDuel={() => setActiveModule('DUEL_LOBBY')}
            />
          )}
          {activeModule === 'BUILDER' && (
            <CardBuilder 
              collection={collection} 
              onSave={handleSaveCard} 
              onDelete={handleDeleteCard}
              onNavigateToDeck={() => setActiveModule('DECK')}
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
              onNavigateToBuilder={() => setActiveModule('BUILDER')}
              hasUnsavedChanges={isDeckDirty(activeDeck)}
            />
          )}
          {activeModule === 'TEST' && currentRoomId && (
            <DuelBoard 
              cards={collection}
              decks={decks}
              roomId={currentRoomId}
              userEmail={user.email}
              isSpectator={isSpectator}
              onExit={() => { setCurrentRoomId(null); setIsSpectator(false); setActiveModule('DUEL_LOBBY'); }}
            />
          )}
          {activeModule === 'DUEL_LOBBY' && (
            <DuelLobby 
              userEmail={user.email}
              onRoomCreated={(id) => { setCurrentRoomId(id); setIsSpectator(false); setActiveModule('DUEL_ROOM'); }}
              onRoomJoined={(id, isSpec) => { setCurrentRoomId(id); setIsSpectator(!!isSpec); setActiveModule('DUEL_ROOM'); }}
              onBack={() => setActiveModule('HOME')}
            />
          )}
          {activeModule === 'DUEL_ROOM' && currentRoomId && (
            <DuelRoom 
              roomId={currentRoomId}
              userEmail={user.email}
              userDecks={decks}
              isSpectator={isSpectator}
              onRoleChanged={(isSpec) => setIsSpectator(isSpec)}
              onStartDuel={() => setActiveModule('DUEL_RPS')}
              onExit={() => { setCurrentRoomId(null); setIsSpectator(false); setActiveModule('DUEL_LOBBY'); }}
            />
          )}
          {activeModule === 'DUEL_RPS' && currentRoomId && (
            <RPSPhase 
              roomId={currentRoomId}
              userEmail={user.email}
              isSpectator={isSpectator}
              onFinished={() => setActiveModule('TEST')}
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
