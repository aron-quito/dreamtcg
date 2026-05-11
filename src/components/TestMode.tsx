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

const createPlayerState = (id: string, name: string, deckCardIds: string[]): PlayerState => {
  const instanceIds = deckCardIds.map(cid => generateInstanceId(cid));
  const shuffled = shuffle(instanceIds);
  const hand = shuffled.slice(0, 4);
  const deck = shuffled.slice(4);
  return {
    id,
    name,
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
    createPlayerState('p1', 'Player 1', deckCardIds),
    createPlayerState('p2', 'Opponent', [])
  ],
  turn: 1,
  phase: GamePhase.DREAM,
  activePlayerIndex: 0,
  chain: []
});

// --- LOG TYPES ---

type LogEntry = {
  id: number;
  msg: string;
  type: 'info' | 'trigger' | 'action' | 'system';
  timestamp: number;
};

// --- COMPONENT ---

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
  
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(false);
  const [isCardPopupOpen, setIsCardPopupOpen] = useState(false);
  const [isInspectorPanelOpen, setIsInspectorPanelOpen] = useState(true);

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeDeckDef, setActiveDeckDef] = useState<DeckDefinition | null>(null);
  const [gameTime, setGameTime] = useState(0);
  
  const engineRef = useRef<CardEngine | null>(null);
  const logIdRef = useRef(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Timer
  useEffect(() => {
    let interval: any;
    if (phase === 'PLAYING') {
      interval = setInterval(() => setGameTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  // Scroll logs to bottom on new entry
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = useCallback((msg: string, type: LogEntry['type'] = 'info') => {
    logIdRef.current++;
    setLogs(prev => [...prev, { id: logIdRef.current, msg, type, timestamp: Date.now() }]);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // --- DECK SELECTION ---
  const startGame = useCallback((deck: DeckDefinition) => {
    const actualMainCards = deck.mainCards.filter(cid => cards.some(c => c.id === cid));
    if (actualMainCards.length === 0) return;

    const state = createGameState(actualMainCards);
    engineRef.current = new CardEngine(state, cards);
    setGameState(state);
    setActiveDeckDef(deck);
    setPhase('PLAYING');
    setLogs([]);
    setSelectedHandInstanceId(null);
    setInspectedInstanceId(state.players[0].hand[0] || null);
    setGameTime(0);
    logIdRef.current = 0;

    addLog(`▶ Game started: ${deck.name}`, 'system');
  }, [cards, addLog]);

  // --- RESET ---
  const resetGame = useCallback(() => {
    if (!activeDeckDef) return;
    startGame(activeDeckDef);
    addLog('🔄 Game reset.', 'system');
  }, [activeDeckDef, startGame, addLog]);

  const backToSelect = useCallback(() => {
    setPhase('SELECT_DECK');
    setGameState(null);
    setSelectedHandInstanceId(null);
    setInspectedInstanceId(null);
    setLogs([]);
    engineRef.current = null;
  }, []);

  // --- CARD HELPERS ---
  const getCardDefByInstance = useCallback((instanceId: string): CardDefinition | undefined => {
    const cardId = instanceId.split('_')[0];
    return cards.find(c => c.id === cardId);
  }, [cards]);

   const handleCardClick = (instanceId: string) => {
     setInspectedInstanceId(instanceId);
     setIsInspectorPanelOpen(true);
     const player = gameState?.players[0];
     if (player?.hand.includes(instanceId)) {
       const isSame = instanceId === selectedHandInstanceId;
       setSelectedHandInstanceId(isSame ? null : instanceId);
       setPendingAction(null); // Reset pending action on new selection
     }
   };

  // --- CARD PLACEMENT ---
  const placeCard = useCallback((zoneType: 'MONSTER' | 'SPELL', slotIndex: number) => {
    if (!gameState || !selectedHandInstanceId || !pendingAction) return;

    const cardDef = getCardDefByInstance(selectedHandInstanceId);
    if (!cardDef) return;

    if (zoneType === 'MONSTER' && cardDef.type !== CardType.MONSTER) return;
    if (zoneType === 'SPELL' && cardDef.type !== CardType.SPELL) return;

    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newState.players[0];

    const zones = zoneType === 'MONSTER' ? player.monsterZones : player.spellZones;
    if (zones[slotIndex] !== null) return;

    const handIndex = player.hand.indexOf(selectedHandInstanceId);
    if (handIndex === -1) return;

    player.hand.splice(handIndex, 1);
    zones[slotIndex] = selectedHandInstanceId;
    
    // Use pendingAction
    player.cardPositions[selectedHandInstanceId] = pendingAction === 'SET' ? "DEFENSE" : "ATTACK";
    player.cardVisibilities[selectedHandInstanceId] = pendingAction === 'SET' ? "FACE_DOWN" : "FACE_UP";

    setGameState(newState);
    setSelectedHandInstanceId(null);
    setPendingAction(null);

    if (zoneType === 'MONSTER') {
      addLog(`⚔️ Summoned ${cardDef.name}`, 'action');
      if (engineRef.current) {
        (engineRef.current as any).state = newState;
        engineRef.current.emit(TriggerType.ON_SUMMON).then(() => {
          setGameState({ ...engineRef.current!.getState() });
          addLog(`✅ ON_SUMMON resolved.`, 'info');
        });
      }
    } else {
      addLog(`✨ Activated ${cardDef.name}`, 'action');
      if (engineRef.current) {
        (engineRef.current as any).state = newState;
        engineRef.current.emit(TriggerType.ON_ACTIVATION).then(() => {
          setGameState({ ...engineRef.current!.getState() });
          addLog(`✅ ON_ACTIVATION resolved.`, 'info');
        });
      }
    }
  }, [gameState, selectedHandInstanceId, pendingAction, getCardDefByInstance, addLog]);

  // DEPRECATED handleHandAction - we now use placeCard with pendingAction

  const drawCard = useCallback(() => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      const player = newState.players[newState.activePlayerIndex];
      if (player.deck.length === 0) {
        addLog(`❌ ${player.name} has no cards left in deck!`, 'system');
        return prev;
      }
      const cardId = player.deck.pop()!;
      player.hand.push(cardId);
      const def = getCardDefByInstance(cardId);
      addLog(`🎴 ${player.name} drew ${def?.name || 'a card'}`, 'action');
      if (engineRef.current) (engineRef.current as any).state = newState;
      return newState;
    });
  }, [getCardDefByInstance, addLog]);

  const nextPhase = useCallback(() => {
    setGameState(prev => {
      if (!prev) return prev;
      const newState = JSON.parse(JSON.stringify(prev)) as GameState;
      const currentPhase = newState.phase;
      let next: GamePhase;
      let logMsg = "";

      switch (currentPhase) {
        case GamePhase.DREAM: 
          next = GamePhase.DRAW; 
          logMsg = "Entering Draw Phase";
          break;
        case GamePhase.DRAW: 
          next = GamePhase.MAIN; 
          logMsg = "Entering Main Phase";
          break;
        case GamePhase.MAIN: 
          next = GamePhase.BATTLE; 
          logMsg = "Entering Battle Phase";
          break;
        case GamePhase.BATTLE: 
          next = GamePhase.END; 
          logMsg = "Entering End Phase";
          break;
        case GamePhase.END: 
          next = GamePhase.DREAM;
          newState.activePlayerIndex = newState.activePlayerIndex === 0 ? 1 : 0;
          if (newState.activePlayerIndex === 0) newState.turn++;
          logMsg = `Turn ${newState.turn} - ${newState.players[newState.activePlayerIndex].name}'s Turn`;
          break;
        default: next = GamePhase.DREAM;
      }

      newState.phase = next;
      addLog(`⏱️ ${logMsg}`, 'system');

      // Immediate Auto-draw logic if entering DRAW phase
      if (next === GamePhase.DRAW) {
        const player = newState.players[newState.activePlayerIndex];
        if (player.deck.length > 0) {
          const cardId = player.deck.pop()!;
          player.hand.push(cardId);
          const def = getCardDefByInstance(cardId);
          addLog(`🎴 ${player.name} drew ${def?.name || 'a card'}`, 'action');
        } else {
          addLog(`❌ ${player.name} has no cards left!`, 'system');
        }
      }

      if (engineRef.current) (engineRef.current as any).state = newState;
      return newState;
    });
  }, [getCardDefByInstance, addLog]);

  // ============================================
  // RENDER: DECK SELECTION
  // ============================================
  if (phase === 'SELECT_DECK') {
    const validatedDecks = decks.map(d => ({
      ...d,
      actualCards: d.mainCards.filter(cid => cards.some(c => c.id === cid))
    })).filter(d => d.actualCards.length > 0);

    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="p-4 bg-indigo-600/20 rounded-full inline-block mb-2">
            <Layers className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Select a Deck</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full px-4">
          {validatedDecks.map(deck => (
            <button
              key={deck.id}
              onClick={() => setSelectedDeckId(deck.id)}
              className={`p-6 border rounded-2xl text-left transition-all ${
                selectedDeckId === deck.id ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
              }`}
            >
              <h3 className="font-black text-white uppercase truncate">{deck.name}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{deck.actualCards.length} Cards</p>
            </button>
          ))}
        </div>
        {selectedDeckId && (
          <button onClick={() => startGame(decks.find(d => d.id === selectedDeckId)!)} className="px-12 py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-sm tracking-widest hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-900/20">
            Start Simulation
          </button>
        )}
      </div>
    );
  }

  // ============================================
  // RENDER: GAME BOARD
  // ============================================
  if (!gameState) return null;
  const player = gameState.players[0];
  const opponent = gameState.players[1];
  const inspectedCard = inspectedInstanceId ? getCardDefByInstance(inspectedInstanceId) : null;

  const renderZone = (type: 'MONSTER' | 'SPELL', idx: number, instanceId: string | null, isPlayer: boolean) => {
    const cardDef = instanceId ? getCardDefByInstance(instanceId) : null;
    const canPlace = isPlayer && !instanceId && pendingAction && getCardDefByInstance(selectedHandInstanceId!)?.type === (type === 'MONSTER' ? CardType.MONSTER : CardType.SPELL);

    const position = isPlayer ? player.cardPositions[instanceId!] : opponent.cardPositions[instanceId!];
    const visibility = isPlayer ? player.cardVisibilities[instanceId!] : opponent.cardVisibilities[instanceId!];
    const isDefense = position === "DEFENSE";
    const isFaceDown = visibility === "FACE_DOWN";

    const togglePosition = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!isPlayer || !instanceId) return;
      const newState = { ...gameState };
      const p = newState.players[0];
      p.cardPositions[instanceId] = p.cardPositions[instanceId] === "ATTACK" ? "DEFENSE" : "ATTACK";
      setGameState(newState);
      addLog(`🔄 ${cardDef?.name} changed to ${p.cardPositions[instanceId]}`, 'system');
    };

    return (
      <div
        key={`${type}-${idx}`}
        onClick={(e) => {
          e.stopPropagation();
          if (canPlace) placeCard(type, idx);
          else if (instanceId) handleCardClick(instanceId);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          togglePosition(e);
        }}
        className={`w-28 lg:w-36 aspect-square rounded-2xl border-2 transition-all flex items-center justify-center relative cursor-pointer group overflow-hidden
          ${instanceId ? 'border-indigo-500/20 bg-slate-900/40 hover:border-indigo-500 shadow-xl' : (canPlace ? 'border-indigo-500 bg-indigo-500/10 animate-pulse shadow-indigo-500/20 shadow-lg' : 'border-slate-800/30 bg-slate-950/10 hover:bg-slate-900/20')}
        `}
      >
        {!instanceId ? (
          <span className="text-[8px] font-black text-slate-800 uppercase tracking-widest opacity-40">{type[0]}-{idx+1}</span>
        ) : (
          <div className={`h-[85%] aspect-[63/88] relative group transition-transform duration-500 ${isDefense ? 'rotate-90 scale-90' : 'rotate-0'}`}>
            {/* The base card (UltraMini) */}
            {isFaceDown ? (
              <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-slate-700 relative overflow-hidden shadow-2xl">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.2)_0,transparent_70%)]" />
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-indigo-500/30" />
                 </div>
              </div>
            ) : (
              <Card card={cardDef!} isUltraMiniature className="w-full h-full shadow-2xl" />
            )}
            
            {/* Master Duel Style Overlays */}
            {cardDef!.type === CardType.MONSTER && !isFaceDown && (
              <>
                {/* Floating Level — Minimalist Model */}
                <div className={`absolute -top-1 -right-1 z-20 flex items-center justify-center w-7 h-7 transition-transform duration-500 ${isDefense ? '-rotate-90' : ''}`}>
                  <div className="absolute inset-0 bg-black/90 blur-lg rounded-full scale-125" />
                  <div className="relative w-full h-full bg-slate-950/80 backdrop-blur-xl rounded-full border border-white/20 flex items-center justify-center text-amber-500 font-black tracking-tighter text-[11px] shadow-2xl">
                    {cardDef!.level || 1}
                  </div>
                </div>

                {/* Floating Stats at the bottom — Wide & High Contrast */}
                <div className={`absolute -bottom-1 left-0 right-0 z-10 flex flex-col items-center pointer-events-none transition-transform duration-500 ${isDefense ? '-rotate-90' : ''}`}>
                  {/* Shadow Shelf for contrast */}
                  <div className="absolute inset-x-[-10%] bottom-[-10%] h-[120%] bg-black/60 blur-md rounded-full" />
                  
                  <div className="relative flex items-center justify-center w-full text-white font-black italic tracking-tighter drop-shadow-[0_2px_4px_rgba(0,0,0,1)] px-1">
                    <span className={`text-lg leading-none transition-opacity ${isDefense ? 'opacity-30' : 'opacity-100'}`}>{cardDef!.atk ?? 0}</span>
                    <span className="text-xs opacity-20 mx-1">/</span>
                    <span className={`text-lg leading-none transition-opacity ${!isDefense ? 'opacity-30' : 'opacity-100'}`}>{cardDef!.def ?? 0}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="relative h-[calc(100vh-160px)] w-full overflow-hidden animate-in fade-in duration-700 select-none bg-slate-950"
      onClick={() => {
        setSelectedHandInstanceId(null);
        setPendingAction(null);
      }}
    >
      
      {/* MAIN GAME CONTAINER */}
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 overflow-hidden pt-20 pb-20"
        onClick={(e) => {
          // If we click the background of the board, cancel selection
          if (e.target === e.currentTarget) {
            setSelectedHandInstanceId(null);
            setPendingAction(null);
          }
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.06)_0,transparent_70%)] pointer-events-none" />
        
        {/* Opponent Info (Top Right) */}
        <div className="absolute top-4 right-4 flex flex-col items-end gap-3 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 px-6 py-4 rounded-3xl z-[60] shadow-xl min-w-[180px]">
          <div className="flex flex-col items-end w-full">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Opponent</span>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter">{opponent.lp}</span>
              <Heart className="w-6 h-6 text-rose-500" />
            </div>
          </div>
        </div>

        {/* Turn & Time (Top Left Row) */}
        <div className="absolute top-4 left-4 flex items-center gap-6 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 px-6 py-3 rounded-2xl z-[60] shadow-xl">
           <div className="flex items-center gap-3">
             <RefreshCw className="w-4 h-4 text-amber-500" />
             <span className="text-xs font-black text-amber-400 font-mono tracking-tighter uppercase">Turn {gameState.turn}</span>
           </div>
           <div className="w-px h-4 bg-slate-800" />
           <div className="flex items-center gap-3">
             <Clock className="w-4 h-4 text-emerald-400" />
             <span className="text-xs font-black text-emerald-400 font-mono tracking-tighter">{formatTime(gameTime)}</span>
           </div>
        </div>

        {/* Floating Controls (Bottom Right Row) */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 z-50">
           <button onClick={resetGame} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-amber-500 hover:bg-amber-500/10 transition-all shadow-lg" title="Reset">
              <RotateCcw className="w-5 h-5" />
           </button>
           <button onClick={() => setIsLogsPanelOpen(!isLogsPanelOpen)} className={`p-3 bg-slate-900/80 border rounded-xl transition-all shadow-lg ${isLogsPanelOpen ? 'border-indigo-500 text-indigo-400' : 'border-slate-800 text-slate-500'}`} title="Logs">
              <History className="w-5 h-5" />
           </button>
           <button 
              onClick={() => setIsInspectorPanelOpen(!isInspectorPanelOpen)} 
              className={`p-3 bg-slate-900/80 border rounded-xl transition-all shadow-lg ${isInspectorPanelOpen ? 'border-indigo-500 text-indigo-400' : 'border-slate-800 text-slate-500'}`} 
              title="Toggle Inspector"
            >
              <Search className="w-5 h-5" />
           </button>
           <button onClick={backToSelect} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-rose-400 hover:bg-rose-500/10 transition-all shadow-lg" title="Exit">
              <X className="w-5 h-5" />
           </button>
        </div>

        {/* Floating Left Inspector Panel */}
        <AnimatePresence>
          {isInspectorPanelOpen && inspectedCard && !isCardPopupOpen && (
            <motion.div 
              initial={{ x: -450, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -450, opacity: 0 }}
              className="absolute top-20 left-4 w-[300px] bottom-40 z-50 pointer-events-none"
            >
              <div className="w-full h-full bg-transparent flex flex-col pointer-events-auto relative overflow-visible p-0">
                <div 
                   className="flex-1 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99] relative"
                   onClick={() => setIsCardPopupOpen(true)}
                 >
                   <div className="w-full h-full flex items-center justify-center overflow-visible relative">
                     <Card card={inspectedCard} className="h-full shadow-[0_40px_100px_rgba(0,0,0,0.9)]" />
                     
                     <button 
                       onClick={(e) => { e.stopPropagation(); setIsInspectorPanelOpen(false); }}
                       className="absolute -top-4 -right-4 p-3 bg-red-500/10 hover:bg-red-500 rounded-full text-white/40 hover:text-white transition-all z-30 shadow-2xl border border-red-500/30 backdrop-blur-xl group"
                     >
                       <X className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
                     </button>
                   </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Right Logs Panel */}
        <AnimatePresence>
          {isLogsPanelOpen && (
            <motion.div 
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              className="absolute top-20 right-0 w-[280px] bottom-16 z-50 pointer-events-none"
            >
              <div className="w-full h-full bg-slate-900/90 backdrop-blur-3xl border-l border-slate-800/60 rounded-l-[2.5rem] p-6 flex flex-col pointer-events-auto shadow-[-20px_0_60px_rgba(0,0,0,0.8)] relative overflow-hidden">
                <button 
                  onClick={() => setIsLogsPanelOpen(false)}
                  className="absolute top-6 right-6 p-2 bg-slate-800/30 rounded-xl text-slate-500 hover:text-white transition-all z-20"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-3 mb-6">
                   <History className="w-5 h-5 text-indigo-400" />
                   <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Engine Activity</h3>
                </div>

                <div className="flex-1 bg-slate-950/40 border border-slate-800/30 rounded-[2rem] p-5 overflow-hidden flex flex-col shadow-inner">
                   <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
                     {logs.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-30">
                          <MessageSquare className="w-10 h-10 mb-4" />
                          <span className="text-[10px] font-black uppercase tracking-[0.3em]">No Activity</span>
                        </div>
                      ) : (
                        logs.map(log => (
                          <div key={log.id} className={`p-4 rounded-2xl border text-[10px] font-mono leading-relaxed transition-all ${
                            log.type === 'trigger' ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' :
                            log.type === 'action' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300' :
                            log.type === 'system' ? 'bg-amber-500/5 border-amber-500/20 text-amber-200' :
                            'bg-slate-950 border-slate-800/50 text-slate-500'
                          }`}>
                            <span className="opacity-30 mr-2">[{formatTime(Math.floor((log.timestamp - (logs[0]?.timestamp || 0))/1000))}]</span>
                            {log.msg}
                          </div>
                        ))
                      )}
                      <div ref={logsEndRef} />
                   </div>
                </div>

                <button 
                  onClick={() => setLogs([])}
                  className="mt-6 w-full py-2.5 bg-slate-800 hover:bg-rose-900/20 border border-slate-700 hover:border-rose-500/30 text-slate-500 hover:text-rose-400 rounded-xl text-[8px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Purge Logs
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="w-full max-w-xl flex items-center gap-6 px-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-slate-700 opacity-40" />
          <Zap className="w-6 h-6 text-indigo-500/20" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-800 to-slate-700 opacity-40" />
        </div>

        {/* FIELD LAYOUT */}
        <div className="flex flex-col gap-14 items-center scale-95 lg:scale-100 relative">
           
           {/* PHASE ORB (Master Duel Style) - DOCKED IN RIGHT COLUMN GAP */}
           <div className="absolute right-0 top-1/2 -translate-y-1/2 w-24 flex flex-col items-center gap-4 z-50">
              <button 
                onClick={(e) => { e.stopPropagation(); nextPhase(); }}
                className="group relative flex items-center justify-center"
              >
                 <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full scale-150 animate-pulse" />
                 <div className="relative w-24 h-24 bg-slate-900 border-4 border-indigo-500 rounded-full flex flex-col items-center justify-center shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:scale-105 hover:border-indigo-400 transition-all cursor-pointer">
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">
                      {gameState.players[gameState.activePlayerIndex].name === 'Player 1' ? 'MY TURN' : 'OPPONENT'}
                    </span>
                    <span className="text-[11px] font-black text-white uppercase tracking-tighter leading-none">
                      {gameState.phase}
                    </span>
                    
                    {/* Integrated Indicators */}
                    <div className="mt-2 flex gap-1 justify-center">
                       {Object.values(GamePhase).map(p => (
                         <div 
                           key={p} 
                           className={`w-1 h-1 rounded-full transition-all duration-500 ${gameState.phase === p ? 'bg-indigo-500 scale-125 shadow-[0_0_8px_rgba(79,70,229,0.8)]' : 'bg-slate-700'}`} 
                         />
                       ))}
                    </div>

                    <div className="mt-1 text-indigo-500">
                       <ChevronRight className="w-4 h-4 animate-bounce-x" />
                    </div>
                 </div>
              </button>
           </div>

           {/* OPPONENT SIDE */}
           <div className="flex items-center gap-10">
              {/* Opponent Left Column (Opponent view: Right side -> Deck Top, GY Bottom) */}
              <div className="flex flex-col gap-4">
                 {/* Opponent DECK (Top-L for Player) */}
                 <div className="w-24 aspect-square rounded-2xl border-2 border-indigo-500/20 bg-slate-900/60 flex flex-col items-center justify-center gap-1 shadow-inner opacity-60">
                    <Layers className="w-6 h-6 text-indigo-500/60" />
                    <span className="text-[10px] font-black text-indigo-400 font-mono">{opponent.deck.length}</span>
                 </div>
                 {/* Opponent GY (Bottom-L for Player) */}
                 <div className="w-24 aspect-square rounded-2xl border border-slate-800/40 bg-slate-900/40 flex flex-col items-center justify-center gap-1 opacity-60">
                    <Trash2 className="w-5 h-5 text-slate-500" />
                    <span className="text-[10px] font-black text-slate-500 font-mono">{opponent.gy.length}</span>
                 </div>
              </div>

              {/* Opponent Main Zones */}
              <div className="flex flex-col gap-4">
                 <div className="flex gap-4">
                   {opponent.spellZones.map((id, i) => renderZone('SPELL', i, id, false)).reverse()}
                 </div>
                 <div className="flex gap-4">
                   {opponent.monsterZones.map((id, i) => renderZone('MONSTER', i, id, false)).reverse()}
                 </div>
              </div>

              {/* Opponent Right Column (Opponent view: Left side -> Extra Top, Banned Bottom) */}
              <div className="flex flex-col gap-4 items-center justify-start">
                 {/* Opponent EXTRA */}
                 <div className="w-24 aspect-square rounded-2xl border border-amber-900/20 bg-amber-950/10 flex flex-col items-center justify-center gap-1 opacity-60">
                    <Sparkles className="w-5 h-5 text-amber-500/40" />
                    <span className="text-[10px] font-black text-amber-500/40 font-mono">{opponent.extraDeck.length}</span>
                 </div>
                 {/* Opponent BANNED */}
                 <div className="w-24 h-24 aspect-square rounded-2xl border border-rose-900/20 bg-rose-950/10 flex flex-col items-center justify-center gap-1 opacity-60">
                    <X className="w-5 h-5 text-rose-500/40" />
                    <span className="text-[10px] font-black text-rose-500/40 font-mono">{opponent.removed.length}</span>
                 </div>
              </div>
           </div>

           {/* PLAYER SIDE */}
           <div className="flex items-center gap-10">
              {/* Player Left Column (Banned Top, Extra Bottom) */}
              <div className="flex flex-col gap-4">
                 {/* BANNED (Top-L) */}
                 <div className="w-24 aspect-square rounded-2xl border border-rose-900/30 bg-rose-950/20 flex flex-col items-center justify-center gap-1">
                    <X className="w-6 h-6 text-rose-500/60" />
                    <span className="text-[10px] font-black text-rose-500/60 font-mono">{player.removed.length}</span>
                 </div>
                 {/* EXTRA (Bottom-L) */}
                 <div className="w-24 aspect-square rounded-2xl border border-amber-900/30 bg-amber-950/20 flex flex-col items-center justify-center gap-1">
                    <Sparkles className="w-6 h-6 text-amber-500/60" />
                    <span className="text-[10px] font-black text-amber-500/60 font-mono">{player.extraDeck.length}</span>
                 </div>
              </div>

              {/* Player Main Zones */}
              <div className="flex flex-col gap-4">
                 <div className="flex gap-4">
                   {player.monsterZones.map((id, i) => renderZone('MONSTER', i, id, true))}
                 </div>
                 <div className="flex gap-4">
                   {player.spellZones.map((id, i) => renderZone('SPELL', i, id, true))}
                 </div>
              </div>

              {/* Player Right Column (GY Top, Deck Bottom) */}
              <div className="flex flex-col gap-4">
                 {/* GY (Top-R) */}
                 <div className="w-24 aspect-square rounded-2xl border border-slate-700 bg-slate-900/60 flex flex-col items-center justify-center gap-1">
                    <Trash2 className="w-6 h-6 text-slate-400" />
                    <span className="text-[10px] font-black text-slate-300 font-mono">{player.gy.length}</span>
                 </div>
                 {/* DECK (Bottom-R) */}
                 <div className="w-24 aspect-square rounded-2xl border-2 border-indigo-500 bg-slate-900 flex flex-col items-center justify-center gap-1 shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                    <Layers className="w-7 h-7 text-indigo-400" />
                    <span className="text-[10px] font-black text-white font-mono">{player.deck.length}</span>
                 </div>
              </div>
           </div>

        </div>

        {/* Player Info (Bottom Left) */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-3 bg-slate-900/60 backdrop-blur-md border border-slate-800/60 px-6 py-4 rounded-3xl z-40 shadow-xl min-w-[180px]">
           <div className="flex flex-col">
             <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Player LP</span>
             <div className="flex items-center gap-4">
               <Heart className="w-6 h-6 text-rose-500" />
               <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter">{player.lp}</span>
             </div>
           </div>
        </div>

        {/* Hand Bar */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-t-[2.5rem] h-16 w-full flex items-center justify-center relative shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
            {player.hand.map((instanceId, idx) => {
               const def = getCardDefByInstance(instanceId);
               const isSelected = selectedHandInstanceId === instanceId;
               
               const handSize = player.hand.length;
               const areaWidth = 600; 
               const cardWidth = 100;
               
               const spacing = handSize > 1 
                 ? Math.min(cardWidth + 10, (areaWidth - cardWidth) / (handSize - 1))
                 : 0;
               
               const totalWidth = (handSize - 1) * spacing + cardWidth;
               const startX = (areaWidth - totalWidth) / 2;
               const xPos = startX + (idx * spacing) - (areaWidth / 2);

               const mid = (handSize - 1) / 2;
               const rotation = (idx - mid) * 3;
               const fanY = Math.abs(idx - mid) * 4;

               return (
                 <motion.div
                   key={instanceId}
                   layout
                   initial={{ x: xPos, y: 80, opacity: 0 }}
                   animate={{ 
                     x: xPos,
                     y: 48 + fanY,
                     rotate: rotation,
                     opacity: 1,
                     zIndex: isSelected ? 500 : 10 + idx,
                     scale: 1
                   }}
                   whileHover={{ 
                     y: isSelected ? 48 + fanY : 8,
                     scale: 1.15,
                     zIndex: 600,
                     transition: { duration: 0.2 }
                   }}
                   onClick={(e) => { e.stopPropagation(); handleCardClick(instanceId); }}
                   className={`absolute w-24 lg:w-28 aspect-[63/88] shrink-0 rounded-2xl border-2 cursor-pointer shadow-2xl transition-colors
                     ${isSelected ? 'border-indigo-500 shadow-[0_20px_50px_rgba(79,70,229,0.5)]' : 'border-slate-800/50 hover:border-slate-600'}`}
                   style={{ transformOrigin: 'bottom center' }}
                 >
                   <Card card={def!} isMiniature />
                   
                   <AnimatePresence>
                     {isSelected && !pendingAction && gameState?.phase === GamePhase.MAIN && (
                       <motion.div 
                         initial={{ opacity: 0, y: 10, x: '-50%' }}
                         animate={{ opacity: 1, y: -40, x: '-50%' }}
                         exit={{ opacity: 0, y: 10, x: '-50%' }}
                         className="absolute -top-32 left-1/2 flex items-center gap-6 z-[300]"
                       >
                          <div className="flex flex-col items-center gap-2 group/btn" onClick={(e) => { e.stopPropagation(); setPendingAction('SUMMON'); }}>
                            <div className="w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center border-4 border-indigo-400 shadow-xl shadow-indigo-900/40 group-hover/btn:scale-110 transition-transform">
                              <Zap className="w-6 h-6 text-white" />
                            </div>
                            <span className="text-[10px] font-black text-white uppercase tracking-widest drop-shadow-md">Summon</span>
                          </div>
                          
                          <div className="flex flex-col items-center gap-2 group/btn" onClick={(e) => { e.stopPropagation(); setPendingAction('SET'); }}>
                            <div className="w-14 h-14 bg-slate-800 rounded-full flex items-center justify-center border-4 border-slate-600 shadow-xl group-hover/btn:scale-110 transition-transform">
                              <Shield className="w-6 h-6 text-slate-300" />
                            </div>
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest drop-shadow-md">Set</span>
                          </div>
                       </motion.div>
                     )}
                   </AnimatePresence>
                 </motion.div>
               );
            })}
          </div>
        </div>
      </div>

      {/* POPUP: MEGA CARD DETAIL (Fully Restored Balance) */}
      <AnimatePresence>
        {isCardPopupOpen && inspectedCard && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-slate-950/95 backdrop-blur-3xl overflow-hidden" 
            onClick={() => setIsCardPopupOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border-2 border-white/10 rounded-[4rem] w-[96vw] h-[92vh] flex overflow-hidden shadow-[0_0_150px_rgba(0,0,0,1)] relative z-[300]"
            >
              {/* LEFT: CARD PREVIEW (Explicit large scale) */}
              <div className="w-[550px] shrink-0 h-full p-20 flex items-center justify-center bg-black/40 border-r-2 border-white/10 relative">
                 <div className="h-full relative flex items-center justify-center overflow-visible">
                   <Card card={inspectedCard} className="h-full w-auto aspect-[63/88] shadow-[0_0_120px_rgba(0,0,0,0.9)]" />
                   
                   <button 
                     onClick={() => setIsCardPopupOpen(false)} 
                     className="absolute -top-12 -right-12 p-5 bg-red-500/10 hover:bg-red-500 rounded-full text-white/40 hover:text-white transition-all z-[310] border border-red-500/30 group shadow-[0_0_40px_rgba(239,68,68,0.2)] backdrop-blur-xl"
                   >
                     <X className="w-10 h-10 group-hover:scale-110 transition-transform duration-300" />
                   </button>
                 </div>
              </div>

              {/* RIGHT: CONTENT (Data Rich) */}
              <div className="flex-1 flex flex-col p-20 gap-10 overflow-hidden bg-gradient-to-br from-slate-900 to-slate-950">
                 <div className="space-y-6 shrink-0">
                    <h2 className="text-6xl font-black text-white uppercase tracking-tighter leading-tight max-w-[90%]">{inspectedCard.name}</h2>
                    <div className="flex flex-wrap items-center gap-3">
                       <div className="px-5 py-2 bg-indigo-500/20 border border-indigo-400/30 rounded-xl flex items-center gap-3">
                          <Dna className="w-5 h-5 text-indigo-400" />
                          <span className="text-sm font-black text-indigo-100 uppercase tracking-widest">{inspectedCard.type}</span>
                       </div>
                       {inspectedCard.type === CardType.MONSTER && (
                         <>
                           <div className="flex items-center gap-3 px-5 py-2 bg-amber-500/20 border border-amber-400/30 rounded-xl">
                              <Zap className="w-5 h-5 text-amber-400" />
                              <span className="text-sm font-black text-amber-100 uppercase tracking-widest">LVL {inspectedCard.level || 1}</span>
                           </div>
                           <div className="flex items-center gap-3 px-5 py-2 bg-rose-500/20 border border-rose-400/30 rounded-xl">
                              <Sword className="w-5 h-5 text-rose-400" />
                              <span className="text-sm font-black text-rose-100 uppercase tracking-widest">ATK {inspectedCard.atk ?? 0}</span>
                           </div>
                           <div className="flex items-center gap-3 px-5 py-2 bg-blue-500/20 border border-blue-400/30 rounded-xl">
                              <Shield className="w-5 h-5 text-blue-400" />
                              <span className="text-sm font-black text-blue-100 uppercase tracking-widest">DEF {inspectedCard.def ?? 0}</span>
                           </div>
                         </>
                       )}
                    </div>
                 </div>

                 {/* TEXT AREA (Clean & Standard) */}
                 <div className="flex-1 bg-black/50 rounded-[4rem] border border-white/10 p-10 overflow-hidden flex flex-col shadow-[inset_0_4px_40px_rgba(0,0,0,0.5)]">
                    <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar space-y-8">
                       {inspectedCard.description && (
                         <p className="text-xl italic font-serif text-slate-400 border-b border-white/10 pb-8 leading-relaxed">
                           {inspectedCard.description}
                         </p>
                       )}

                       <div className="space-y-16 pb-16">
                         {inspectedCard.effects.length === 0 ? (
                           <div className="h-full flex flex-col items-center justify-center text-slate-800 opacity-30 py-32 space-y-8">
                             <div className="w-full max-w-md space-y-4">
                                <div className="h-2 bg-white/5 rounded-full w-full" />
                                <div className="h-2 bg-white/5 rounded-full w-3/4 mx-auto" />
                                <div className="h-2 bg-white/5 rounded-full w-5/6 mx-auto" />
                             </div>
                             <span className="text-sm font-black uppercase tracking-[0.5em]">Sin Efectos Adicionales</span>
                           </div>
                         ) : (
                           inspectedCard.effects.map((eff, i) => (
                             <div key={i} className="space-y-8 border-l-8 border-indigo-500/20 pl-12">
                                <div className="space-y-8">
                                   <div className="space-y-1.5">
                                     <span className="text-indigo-400 font-black text-[10px] uppercase tracking-[0.3em]">Activación:</span>
                                     <p className="text-2xl text-white font-bold leading-tight">{renderTriggerText(eff.trigger)}</p>
                                   </div>
                                   <div className="space-y-1.5">
                                     <span className="text-amber-500 font-black text-[10px] uppercase tracking-[0.3em]">Condición:</span>
                                     <p className="text-lg text-slate-400 leading-relaxed">{renderRestrictionText(eff.restriction)}</p>
                                   </div>
                                   <div className="space-y-1.5">
                                     <span className="text-emerald-500 font-black text-[10px] uppercase tracking-[0.3em]">Resultado:</span>
                                     <div className="space-y-4">
                                       {eff.costs.length > 0 && (
                                         <p className="text-rose-400 text-sm font-bold bg-rose-500/10 px-4 py-2 rounded-xl inline-block border border-rose-500/20">
                                           Costo: {eff.costs.map(c => renderCostText(c)).join(", ")}
                                         </p>
                                       )}
                                       <p className="text-2xl text-emerald-400 font-black leading-snug">
                                         {eff.resolutions.map(r => renderResolutionText(r)).join(", ")}
                                       </p>
                                    </div>
                                  </div>
                                </div>
                             </div>
                           ))
                         )}
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};
