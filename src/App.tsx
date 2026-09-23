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
import { API_BASE } from './config';

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
    level: 1,
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
    level: 1,
    atk: 1500,
    def: 1500,
    attribute: CardAttribute.DARK,
    description: 'Any time: Discard 1 to banish 1 card from opponent GY.',
    isCustom: false,
    effects: [
      {
        id: 'eff_02',
        name: 'Shadow Banish',
        restriction: { locations: [], frequency: FrequencyType.UNLIMITED },
        trigger: { type: TriggerType.ANY_TIME },
        costs: [],
        resolutions: [],
        execute: async (ctx) => {
          const g = JSON.parse(JSON.stringify(ctx.game));
          const p = g.players[ctx.controllerIndex];
          const opp = g.players[1 - ctx.controllerIndex];
          
          if (p.hand.length === 0) return g;
          
          // Cost: Discard 1
          const discardSelection = await ctx.requestSelection(p.hand, 1, "Select 1 card to discard for cost");
          if (discardSelection.length === 0) return g;
          
          const discardId = discardSelection[0];
          p.hand = p.hand.filter((id: string) => id !== discardId);
          p.gy.push(discardId);
          ctx.log(`${p.name} discarded a card for Nightmare Shade's cost.`);
          
          // Resolution: Banish from opponent GY
          if (opp.gy.length === 0) return g;
          
          const banishSelection = await ctx.requestSelection(opp.gy, 1, "Select 1 card from opponent GY to banish");
          if (banishSelection.length === 0) return g;
          
          const banishId = banishSelection[0];
          opp.gy = opp.gy.filter((id: string) => id !== banishId);
          opp.removed.push(banishId);
          ctx.log(`${p.name} banished a card from opponent's GY.`);
          
          return g;
        }
      }
    ]
  },
  {
    id: 'base_03',
    name: 'Pot of Greed',
    type: CardType.SPELL,
    description: 'Any time: Heal 1000 LP and draw 2 cards.',
    isCustom: false,
    effects: [
      {
        id: 'eff_03',
        name: 'Greedy Heal',
        restriction: { locations: [], frequency: FrequencyType.UNLIMITED },
        trigger: { type: TriggerType.ANY_TIME },
        costs: [],
        resolutions: [
          { action: 'RECOVER_LP', params: { amount: 1000 } },
          { action: 'DRAW', params: { n: 2 } }
        ]
      }
    ]
  }
];



type Module = 'HOME' | 'BUILDER' | 'DECK' | 'TEST' | 'SHOP' | 'DUEL_LOBBY' | 'DUEL_ROOM' | 'DUEL_RPS' | 'DUEL_BOARD';

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
  const [activeModule, setActiveModule] = useState<'HOME' | 'DECK' | 'SHOP' | 'TEST' | 'DUEL_LOBBY' | 'DUEL_ROOM' | 'DUEL_RPS' | 'DUEL_BOARD'>('HOME');

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

  console.log("[App Render] Module:", activeModule, "Room:", currentRoomId, "Spec:", isSpectator);

  const closeModal = () => setModalConfig(prev => prev ? { ...prev, isOpen: false } : null);

  // Reconnection Logic
  useEffect(() => {
    if (user) {
      const checkActiveRoom = async () => {
        try {
          const res = await fetch(`${API_BASE}/rooms/active?email=${user.email}`);
          if (res.ok) {
            const roomData = await res.json();
            if (roomData) {
              if (roomData.status === 'DUELING' || roomData.status === 'RPS') {
                // RECONNECT TO MATCH
                setCurrentRoomId(roomData.id);
                const isSpec = roomData.spectator1_email === user.email || roomData.spectator2_email === user.email;
                setIsSpectator(isSpec);
                setActiveModule(roomData.status === 'DUELING' ? 'DUEL_BOARD' : 'DUEL_RPS');
              } else if (roomData.status === 'LOBBY') {
                // Suspended in lobby, do nothing. DuelLobby will show Rejoin button.
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
          await fetch(`${API_BASE}/users/heartbeat`, {
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
    fetch(`${API_BASE}/cards?userEmail=${user.email}`)
      .then(res => res.json())
      .then(data => setCollection(data))
      .catch(err => console.error("Failed to load collection:", err));

    // Fetch Decks
    fetch(`${API_BASE}/decks?userEmail=${user.email}`)
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
      const response = await fetch(`${API_BASE}/cards`, {
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
          const response = await fetch(`${API_BASE}/cards/${id}`, {
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
      const response = await fetch(`${API_BASE}/decks`, {
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
          const response = await fetch(`${API_BASE}/decks/${id}`, {
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
        {activeModule !== 'HOME' && activeModule !== 'DUEL_BOARD' && (
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
                  {activeModule === 'DECK' && "Deck Management"}
                  {activeModule === 'TEST' && "Simulation Sandbox"}
                  {activeModule === 'DUEL_BOARD' && "Active Combat"}
                </h1>
                <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mt-0.5">
                  DreamsTCG Engine v0.1
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
               <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono text-slate-400">
                 {activeModule === 'DUEL_BOARD' ? `Duel: ${currentRoomId}` : `Collection: ${collection.length} Cards`}
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
          {(activeModule === 'TEST' || activeModule === 'DUEL_BOARD') && currentRoomId && (
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
              onFinished={(goFirst) => {
                console.log("RPS Finished, transitioning to DUEL_BOARD. Room:", currentRoomId);
                setActiveModule('DUEL_BOARD');
              }}
            />
          )}
          {/* Debug Fallback */}
          {activeModule === 'DUEL_BOARD' && !currentRoomId && (
            <div className="fixed inset-0 bg-red-900 flex items-center justify-center text-white font-black z-[9999]">
              ERROR: DUEL_BOARD active but currentRoomId is NULL
            </div>
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
