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
  PlayerState
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
    gy: [],
    extraDeck: []
  };
};

const createGameState = (deckCardIds: string[]): GameState => ({
  players: [
    createPlayerState('p1', 'Player 1', deckCardIds),
    createPlayerState('p2', 'Opponent', [])
  ],
  turn: 1,
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
    if (deck.mainCards.length === 0) return;

    const state = createGameState(deck.mainCards);
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
      setSelectedHandInstanceId(instanceId === selectedHandInstanceId ? null : instanceId);
    }
  };

  // --- CARD PLACEMENT ---
  const placeCard = useCallback((zoneType: 'MONSTER' | 'SPELL', slotIndex: number) => {
    if (!gameState || !selectedHandInstanceId) return;

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

    setGameState(newState);
    setSelectedHandInstanceId(null);

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
  }, [gameState, selectedHandInstanceId, getCardDefByInstance, addLog]);

  const drawCard = useCallback(() => {
    if (!gameState) return;
    const newState = JSON.parse(JSON.stringify(gameState)) as GameState;
    const player = newState.players[0];
    if (player.deck.length === 0) return;
    
    const drawn = player.deck.shift()!;
    player.hand.push(drawn);
    setGameState(newState);
    if (engineRef.current) (engineRef.current as any).state = newState;
    addLog(`🃏 Drew card.`, 'action');
  }, [gameState, addLog]);

  // ============================================
  // RENDER: DECK SELECTION
  // ============================================
  if (phase === 'SELECT_DECK') {
    const validDecks = decks.filter(d => d.mainCards.length > 0);
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] gap-8 animate-in fade-in duration-500">
        <div className="text-center space-y-3">
          <div className="p-4 bg-indigo-600/20 rounded-full inline-block mb-2">
            <Layers className="w-10 h-10 text-indigo-400" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Select a Deck</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl w-full px-4">
          {validDecks.map(deck => (
            <button
              key={deck.id}
              onClick={() => setSelectedDeckId(deck.id)}
              className={`p-6 border rounded-2xl text-left transition-all ${
                selectedDeckId === deck.id ? 'border-indigo-500 bg-indigo-950/20' : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
              }`}
            >
              <h3 className="font-black text-white uppercase truncate">{deck.name}</h3>
              <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{deck.mainCards.length} Cards</p>
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
    const canPlace = isPlayer && !instanceId && selectedHandInstanceId && getCardDefByInstance(selectedHandInstanceId)?.type === (type === 'MONSTER' ? CardType.MONSTER : CardType.SPELL);

    return (
      <div
        key={`${type}-${idx}`}
        onClick={() => {
          if (canPlace) placeCard(type, idx);
          else if (instanceId) handleCardClick(instanceId);
        }}
        className={`w-20 lg:w-24 aspect-[63/88] rounded-xl border-2 transition-all flex items-center justify-center relative cursor-pointer
          ${instanceId ? 'border-indigo-500/40 bg-slate-900 hover:border-indigo-500' : (canPlace ? 'border-indigo-500 bg-indigo-500/10 animate-pulse' : 'border-slate-800/40 bg-slate-950/20')}
        `}
      >
        {!instanceId ? (
          <span className="text-[7px] font-black text-slate-800 uppercase tracking-widest">{type[0]}-{idx+1}</span>
        ) : (
          <Card card={cardDef!} isUltraMiniature />
        )}
      </div>
    );
  };

  return (
    <div className="relative h-[calc(100vh-160px)] w-full overflow-hidden animate-in fade-in duration-700 select-none bg-slate-950">
      
      {/* MAIN GAME CONTAINER */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 overflow-hidden pt-20 pb-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.06)_0,transparent_70%)] pointer-events-none" />
        
        {/* Opponent Info (Top Right) */}
        <div className="absolute top-4 right-4 flex items-center gap-6 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 px-6 py-3 rounded-2xl z-[60] shadow-xl">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">Opponent</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-white font-mono leading-none">{opponent.lp}</span>
              <Heart className="w-5 h-5 text-rose-500" />
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
              className="absolute top-16 left-0 w-[350px] bottom-32 z-50 pointer-events-none"
            >
              <div className="w-full h-full bg-transparent flex flex-col pointer-events-auto relative overflow-hidden p-0">
                <button 
                  onClick={() => setIsInspectorPanelOpen(false)}
                  className="absolute top-4 right-4 p-2 bg-slate-900/80 rounded-xl text-slate-500 hover:text-white transition-all z-30 shadow-2xl border border-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
                
                <div 
                   className="flex-1 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                   onClick={() => setIsCardPopupOpen(true)}
                 >
                   <div className="w-full h-full flex items-center justify-center">
                     <Card card={inspectedCard} className="shadow-[0_40px_100px_rgba(0,0,0,0.9)]" />
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
              className="absolute top-20 right-0 w-[340px] bottom-16 z-50 pointer-events-none"
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

        {/* Board Zones */}
        <div className="flex flex-col gap-2 items-center opacity-30">
           <div className="flex gap-2 scale-90 lg:scale-100">
             {[0,1,2].map(i => renderZone('SPELL', i, opponent.spellZones[i], false))}
           </div>
           <div className="flex gap-2 scale-90 lg:scale-100">
             {[0,1,2].map(i => renderZone('MONSTER', i, opponent.monsterZones[i], false))}
           </div>
        </div>

        <div className="w-full max-w-xl flex items-center gap-6 px-10">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-800 to-slate-700 opacity-40" />
          <Zap className="w-6 h-6 text-indigo-500/20" />
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-slate-800 to-slate-700 opacity-40" />
        </div>

        <div className="flex flex-col gap-2 items-center">
           <div className="flex gap-2 scale-90 lg:scale-100">
             {[0,1,2].map(i => renderZone('MONSTER', i, player.monsterZones[i], true))}
           </div>
           <div className="flex gap-2 scale-90 lg:scale-100">
             {[0,1,2].map(i => renderZone('SPELL', i, player.spellZones[i], true))}
           </div>
        </div>

        {/* Player Info (Bottom Left) */}
        <div className="absolute bottom-4 left-4 flex flex-col bg-slate-900/60 backdrop-blur-md border border-slate-800/60 px-6 py-4 rounded-3xl z-40 shadow-xl min-w-[200px]">
           <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mb-1">Player LP</span>
           <div className="flex items-center gap-4">
             <Heart className="w-6 h-6 text-rose-500" />
             <span className="text-3xl font-black text-white font-mono leading-none tracking-tighter">{player.lp}</span>
           </div>
        </div>

        {/* Hand Bar */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 flex items-center gap-4 z-40">
          <div className="bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-t-[2.5rem] h-16 flex-1 px-8 flex items-center gap-2 justify-center relative shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
            {player.hand.map(instanceId => {
               const def = getCardDefByInstance(instanceId);
               const isSelected = selectedHandInstanceId === instanceId;
               return (
                 <motion.div
                   key={instanceId}
                   layout
                   initial={{ y: 32 }}
                   animate={{ y: isSelected ? -32 : 32 }}
                   whileHover={{ y: isSelected ? -32 : 16 }}
                   onClick={() => handleCardClick(instanceId)}
                   className={`w-14 shrink-0 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                     isSelected ? 'border-indigo-500 shadow-[0_20px_50px_rgba(79,70,229,0.7)]' : 'border-transparent'
                   }`}
                 >
                   <Card card={def!} isUltraMiniature />
                 </motion.div>
               );
            })}
            <button onClick={drawCard} className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 hover:text-white hover:border-indigo-500 transition-all ml-4 z-50">
                <PlusCircle className="w-5 h-5" />
            </button>
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
              initial={{ scale: 0.95, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 30 }}
              onClick={e => e.stopPropagation()}
              className="bg-slate-900 border border-white/10 rounded-[3.5rem] w-full max-w-[90vw] h-[85vh] flex gap-12 relative shadow-[0_50px_200px_rgba(0,0,0,1)] p-12 overflow-hidden"
            >
              <button 
                onClick={() => setIsCardPopupOpen(false)} 
                className="absolute top-8 right-8 p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-white transition-all z-50 border border-white/10"
              >
                <X className="w-6 h-6" />
              </button>

              {/* LEFT: CARD PREVIEW */}
              <div className="w-[35%] flex items-center justify-center h-full">
                 <div className="h-full aspect-[63/88]">
                   <Card card={inspectedCard} className="h-full w-full" />
                 </div>
              </div>

              {/* RIGHT: CONTENT */}
              <div className="flex-1 flex flex-col gap-6 h-full overflow-hidden">
                 <div className="space-y-4 shrink-0">
                    <h2 className="text-5xl font-black text-white uppercase tracking-tighter leading-none">{inspectedCard.name}</h2>
                    <div className="flex flex-wrap items-center gap-3">
                       <div className="px-4 py-1.5 bg-indigo-600/20 border border-indigo-400/20 rounded-xl flex items-center gap-3">
                          <Dna className="w-4 h-4 text-indigo-400" />
                          <span className="text-xs font-black text-indigo-200 uppercase tracking-widest">{inspectedCard.type}</span>
                       </div>
                       {inspectedCard.type === CardType.MONSTER && (
                         <>
                           <div className="flex items-center gap-3 px-4 py-1.5 bg-amber-600/20 border border-amber-400/20 rounded-xl">
                              <Zap className="w-4 h-4 text-amber-400" />
                              <span className="text-xs font-black text-amber-200 uppercase tracking-widest">LVL {inspectedCard.level || 1}</span>
                           </div>
                           <div className="flex items-center gap-3 px-4 py-1.5 bg-rose-600/20 border border-rose-400/20 rounded-xl">
                              <Sword className="w-4 h-4 text-rose-400" />
                              <span className="text-xs font-black text-rose-200 uppercase tracking-widest">ATK {inspectedCard.atk ?? 0}</span>
                           </div>
                           <div className="flex items-center gap-3 px-4 py-1.5 bg-blue-600/20 border border-blue-400/20 rounded-xl">
                              <Shield className="w-4 h-4 text-blue-400" />
                              <span className="text-xs font-black text-blue-200 uppercase tracking-widest">DEF {inspectedCard.def ?? 0}</span>
                           </div>
                         </>
                       )}
                    </div>
                 </div>

                 {/* TEXT AREA (Clean & Standard) */}
                 <div className="flex-1 bg-slate-950/40 rounded-[2.5rem] border border-white/5 p-8 overflow-hidden flex flex-col shadow-inner">
                    <div className="flex-1 overflow-y-auto pr-6 custom-scrollbar space-y-8">
                       {inspectedCard.description && (
                         <p className="text-lg italic font-serif text-slate-500 border-b border-white/5 pb-6 leading-relaxed">
                           {inspectedCard.description}
                         </p>
                       )}

                       <div className="space-y-10 pb-8">
                         {inspectedCard.effects.map((eff, i) => (
                           <div key={i} className="space-y-5 border-l-2 border-indigo-500/20 pl-6">
                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <span className="text-indigo-400 font-black text-[9px] uppercase tracking-widest">Activación:</span>
                                  <p className="text-xl text-white font-bold">{renderTriggerText(eff.trigger)}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-amber-500 font-black text-[9px] uppercase tracking-widest">Condición:</span>
                                  <p className="text-base text-slate-400">{renderRestrictionText(eff.restriction)}</p>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-emerald-500 font-black text-[9px] uppercase tracking-widest">Resultado:</span>
                                  <div className="space-y-3">
                                    {eff.costs.length > 0 && (
                                      <p className="text-rose-400 text-sm font-bold bg-rose-500/5 p-2 rounded-lg inline-block">
                                        Costo: {eff.costs.map(c => renderCostText(c)).join(", ")}
                                      </p>
                                    )}
                                    <p className="text-xl text-emerald-400 font-black">
                                      {eff.resolutions.map(r => renderResolutionText(r)).join(", ")}
                                    </p>
                                  </div>
                                </div>
                              </div>
                           </div>
                         ))}
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
