import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Zap, 
  RefreshCw, 
  MessageSquare,
  Play,
  X,
  Layers,
  Sword,
  Shield,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Hand,
  RotateCcw,
  Heart,
  Flame,
  Eye,
  Info,
  PlusCircle,
  Clock,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Maximize2,
  Minimize2,
  Search,
  History,
  Trash2,
  Trophy,
  Dna
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GameState, 
  CardDefinition, 
  CardType,
  TriggerType,
  DeckDefinition,
  PlayerState,
  GamePhase
} from '../types';
import { CardEngine } from '../engine/controller';
import { 
  Card, 
  renderTriggerText, 
  renderRestrictionText, 
  renderCostText, 
  renderResolutionText 
} from './Card';

// --- HELPERS ---

const generateInstanceId = (cardId: string) => `${cardId}_${Math.random().toString(36).substr(2, 9)}`;

const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const createPlayerState = (id: string, name: string, email: string, deckCardIds: string[]): PlayerState => {
  const instanceIds = deckCardIds.map(cid => generateInstanceId(cid));
  const shuffled = shuffle(instanceIds);
  const hand = shuffled.slice(0, 4);
  const deck = shuffled.slice(4);
  return {
    id,
    name,
    email,
    lp: 8000,
    deck,
    hand,
    monsterZones: [null, null, null],
    spellZones: [null, null, null],
    cardPositions: {},
    cardVisibilities: {},
    gy: [],
    removed: [],
    extraDeck: []
  };
};

const createGameState = (deckCardIds: string[]): GameState => ({
  players: [
    createPlayerState('p1', 'Player 1', 'test@example.com', deckCardIds),
    createPlayerState('p2', 'Opponent', 'ai@example.com', [])
  ],
  turn: 1,
  phase: GamePhase.DREAM,
  activePlayerIndex: 0,
  chain: []
});

interface TestModeProps {
  cards: CardDefinition[];
  decks: DeckDefinition[];
}

export const TestMode: React.FC<TestModeProps> = ({ cards, decks }) => {
  // --- STATE ---
  const [phase, setPhase] = useState<'SELECT_DECK' | 'PLAYING'>('SELECT_DECK');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [selectedHandInstanceId, setSelectedHandInstanceId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'SUMMON' | 'SET' | null>(null);
  const [inspectedInstanceId, setInspectedInstanceId] = useState<string | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  
  const engineRef = useRef<CardEngine | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const getCardDefByInstance = useCallback((instanceId: string) => {
    const cardId = instanceId.split('_')[0];
    return cards.find(c => c.id === cardId);
  }, [cards]);

  const addLog = useCallback((msg: string, type: string = 'info') => {
    setLogs(prev => [...prev.slice(-19), { id: Date.now(), msg, type }]);
  }, []);

  const startGame = (deck: DeckDefinition) => {
    const initial = createGameState(deck.mainCards);
    setGameState(initial);
    setPhase('PLAYING');
    addLog(`🎮 Match Started with deck: ${deck.name}`, 'system');
  };

  const placeCard = (zoneType: 'MONSTER' | 'SPELL', slotIndex: number) => {
    if (!gameState || !selectedHandInstanceId) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const p = newState.players[0];
    const zones = zoneType === 'MONSTER' ? p.monsterZones : p.spellZones;
    
    if (zones[slotIndex]) return;

    const hIdx = p.hand.indexOf(selectedHandInstanceId);
    if (hIdx === -1) return;

    p.hand.splice(hIdx, 1);
    zones[slotIndex] = selectedHandInstanceId;
    p.cardPositions[selectedHandInstanceId] = pendingAction === 'SET' ? "DEFENSE" : "ATTACK";
    p.cardVisibilities[selectedHandInstanceId] = pendingAction === 'SET' ? "FACE_DOWN" : "FACE_UP";

    setGameState(newState);
    setSelectedHandInstanceId(null);
    setPendingAction(null);
  };

  if (phase === 'SELECT_DECK') {
    return (
      <div className="p-12 flex flex-col items-center">
        <h2 className="text-3xl font-black text-white mb-8">LOCAL SANDBOX (REFERENCE)</h2>
        <div className="grid grid-cols-3 gap-4">
          {decks.map(d => (
            <button key={d.id} onClick={() => startGame(d)} className="p-6 bg-slate-900 border border-white/10 rounded-2xl hover:border-indigo-500 transition-all text-left">
              <h3 className="font-bold text-white">{d.name}</h3>
              <p className="text-[10px] text-slate-500 uppercase">{d.mainCards.length} Cards</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!gameState) return null;

  return (
    <div className="p-8">
       <button onClick={() => setPhase('SELECT_DECK')} className="mb-4 text-slate-500 hover:text-white uppercase text-[10px] font-black">Back to Selection</button>
       <div className="glass p-12 rounded-[3rem] text-center border border-white/5">
          <p className="text-slate-500 italic">This is the Local Reference Sandbox.</p>
          <p className="text-indigo-400 font-bold mt-4">Use "Duel" from the main menu for synchronized multiplayer.</p>
       </div>
    </div>
  );
};
