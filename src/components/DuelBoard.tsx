import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  Zap, 
  RefreshCw, 
  X,
  Layers,
  Sword,
  Shield,
  Sparkles,
  Heart,
  Clock,
  ArrowRight,
  Maximize2,
  Search,
  History,
  Trash2,
  Dna,
  Loader2,
  ChevronRight,
  Flame
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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
  const hand = shuffled.slice(0, 4); // START WITH 4 CARDS
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

interface DuelBoardProps {
  cards: any[];
  decks: any[];
  roomId: string;
  userEmail: string;
  isSpectator?: boolean;
  onExit: () => void;
}

// We extend GameState locally to include logs for synchronization
interface SyncedGameState extends GameState {
  logs?: Array<{ id: number; msg: string; type: string }>;
  winnerEmail?: string | null;
}

export const DuelBoard: React.FC<DuelBoardProps> = ({ cards, decks, roomId, userEmail, isSpectator, onExit }) => {
  // --- SYNC STATE ---
  const [game, setGame] = useState<SyncedGameState | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [showPortal, setShowPortal] = useState(true);

  // --- UI STATE ---
  const [selectedHandInstanceId, setSelectedHandInstanceId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'SUMMON' | 'SET' | null>(null);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [summoningMode, setSummoningMode] = useState<{ type: 'SUMMON' | 'SET' | 'ACTIVATE', instanceId: string } | null>(null);
  const [inspectedInstanceId, setInspectedInstanceId] = useState<string | null>(null);
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(false);
  const [isCardPopupOpen, setIsCardPopupOpen] = useState(false);
  const [isInspectorPanelOpen, setIsInspectorPanelOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [duelResult, setDuelResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  
  const isInitRef = useRef(false);

  const getCardDefByInstance = useCallback((instanceId: string | null) => {
    if (!instanceId) return null;
    const cardId = instanceId.split('_')[0];
    return cards.find(c => c.id === cardId) || null;
  }, [cards]);

  const updateServerGame = async (nextState: SyncedGameState) => {
    try {
      await fetch('http://127.0.0.1:3001/api/rooms/game/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, gameState: nextState, email: userEmail })
      });
    } catch (e) {}
  };

  const addSyncedLog = (msg: string, type: string = 'info') => {
    if (!game) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    if (!nextGame.logs) nextGame.logs = [];
    nextGame.logs.push({ id: Date.now(), msg, type });
    if (nextGame.logs.length > 20) nextGame.logs.shift();
    setGame(nextGame);
    updateServerGame(nextGame);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // SYNC LOOP
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:3001/api/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setRoom(data);

          if (data.game_state) {
            const nextGame = JSON.parse(data.game_state) as SyncedGameState;
            setGame(nextGame);

            // Sync Duel Result (Robust detection)
            if (nextGame.winnerEmail) {
              if (isSpectator) {
                // Find winner name
                const winner = nextGame.players.find(p => p.email?.toLowerCase().trim() === nextGame.winnerEmail?.toLowerCase().trim());
                setDuelResult(winner ? `VICTORY: ${winner.name}` : 'DUEL FINISHED');
              } else if (userEmail) {
                const isWinner = nextGame.winnerEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();
                setDuelResult(isWinner ? 'VICTORY' : 'DEFEAT');
              }
            }
          } else if (data.host_email === userEmail && !isInitRef.current) {
            isInitRef.current = true;
            
            // FILTRAR CARTAS QUE NO EXISTEN EN LA COLECCION
            const filterDeck = (deckId: string | null) => {
              const deck = decks.find(d => d.id === deckId);
              if (!deck) return [];
              return deck.mainCards.filter(cid => cards.some(c => c.id === cid));
            };

            const hostCards = filterDeck(data.host_deck_id);
            const guestCards = filterDeck(data.guest_deck_id);
            
            const initialGame: SyncedGameState = {
              players: [
                createPlayerState('p1', data.p1_name || 'Player 1', data.player1_email, hostCards),
                createPlayerState('p2', data.p2_name || 'Player 2', data.player2_email, guestCards)
              ],
              turn: 1,
              phase: GamePhase.DREAM,
              activePlayerIndex: data.turn_order || 0,
              chain: [],
              logs: [{ id: Date.now(), msg: "Duel Started", type: 'system' }]
            };
            await updateServerGame(initialGame);
            setGame(initialGame);
          }
        }
      } catch (e) {}
    };

    const interval = setInterval(fetchRoom, 2000);
    fetchRoom();
    return () => clearInterval(interval);
  }, [roomId, userEmail, decks]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => setGameTime(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (showPortal && game) {
      const timer = setTimeout(() => setShowPortal(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [showPortal, game]);

  // PERSPECTIVE
  const isOwner = room?.host_email === userEmail;
  const isP1 = room?.player1_email === userEmail;
  const isP2 = room?.player2_email === userEmail;

  // If spectator, we default to seeing Player 0 as "Me" (P1) and Player 1 as "Opponent" (P2)
  const myIndex = isSpectator ? 0 : (isP1 ? 0 : 1);
  const oppIndex = isSpectator ? 1 : (isP1 ? 1 : 0);
  
  const me = game?.players && game.players[myIndex] ? game.players[myIndex] : null;
  const opponent = game?.players && game.players[oppIndex] ? game.players[oppIndex] : null;
  const isMyTurn = !isSpectator && game?.activePlayerIndex === (isP1 ? 0 : 1);

  // ACTIONS
  const nextPhase = () => {
    if (!isMyTurn || !game) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const currentPhase = nextGame.phase;
    let next: GamePhase;
    
    switch (currentPhase) {
      case GamePhase.DREAM: next = GamePhase.DRAW; break;
      case GamePhase.DRAW: next = GamePhase.MAIN; break;
      case GamePhase.MAIN: next = GamePhase.BATTLE; break;
      case GamePhase.BATTLE: next = GamePhase.END; break;
      case GamePhase.END: 
        next = GamePhase.DREAM;
        nextGame.activePlayerIndex = nextGame.activePlayerIndex === 0 ? 1 : 0;
        if (nextGame.activePlayerIndex === 0) nextGame.turn++;
        break;
      default: next = GamePhase.DREAM;
    }
    nextGame.phase = next;
    
    if (next === GamePhase.DRAW) {
      const p = nextGame.players[nextGame.activePlayerIndex];
      if (p.deck.length > 0) p.hand.push(p.deck.pop()!);
    }

    if (!nextGame.logs) nextGame.logs = [];
    nextGame.logs.push({ id: Date.now(), msg: `Phase: ${next}`, type: 'system' });

    setGame(nextGame);
    updateServerGame(nextGame);
  };

  const placeCard = (zoneType: 'MONSTER' | 'SPELL', slotIndex: number) => {
    if (!isMyTurn || !game || !summoningMode || !me) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const p = nextGame.players[myIndex];
    const zones = zoneType === 'MONSTER' ? p.monsterZones : p.spellZones;
    
    if (zones[slotIndex]) return;
    
    const hIdx = p.hand.indexOf(summoningMode.instanceId);
    if (hIdx === -1) return;

    p.hand.splice(hIdx, 1);
    zones[slotIndex] = summoningMode.instanceId;
    p.cardPositions[summoningMode.instanceId] = summoningMode.type === 'SET' ? "DEFENSE" : "ATTACK";
    p.cardVisibilities[summoningMode.instanceId] = summoningMode.type === 'SET' ? "FACE_DOWN" : "FACE_UP";

    const cardDef = getCardDefByInstance(summoningMode.instanceId);
    if (!nextGame.logs) nextGame.logs = [];
    nextGame.logs.push({ id: Date.now(), msg: `${p.name} ${summoningMode.type === 'SUMMON' ? 'Summoned' : 'Set'} ${cardDef?.name}`, type: 'action' });

    setGame(nextGame);
    updateServerGame(nextGame);
    setSummoningMode(null);
  };

  const handleCardClick = (instanceId: string) => {
    setInspectedInstanceId(instanceId);
    setIsInspectorPanelOpen(true);
    if (me?.hand.includes(instanceId) && !isSpectator) {
      const isSame = instanceId === selectedHandInstanceId;
      setSelectedHandInstanceId(isSame ? null : instanceId);
      setSummoningMode(null);
    }
  };

  if (!game || !me || !opponent) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center gap-6 z-[9999]">
        <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
        <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Neural Synchronization...</p>
      </div>
    );
  }

  const inspectedCard = inspectedInstanceId ? getCardDefByInstance(inspectedInstanceId) : null;

  const renderZone = (type: 'MONSTER' | 'SPELL', idx: number, instanceId: string | null, isPlayer: boolean) => {
    const cardDef = instanceId ? getCardDefByInstance(instanceId) : null;
    const isSummonable = isPlayer && !isSpectator && summoningMode && (
      (summoningMode.type === 'SUMMON' && type === 'MONSTER') ||
      (summoningMode.type === 'SET' && type === 'MONSTER') ||
      (summoningMode.type === 'ACTIVATE' && type === 'SPELL') ||
      (summoningMode.type === 'SET' && type === 'SPELL')
    ) && !instanceId;

    const targetPlayer = isPlayer ? me : opponent;
    const position = targetPlayer.cardPositions[instanceId!] || "ATTACK";
    const visibility = targetPlayer.cardVisibilities[instanceId!] || "FACE_UP";
    const isDefense = position === "DEFENSE";
    const isFaceDown = visibility === "FACE_DOWN";

    return (
      <div
        key={`${type}-${idx}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isSummonable) placeCard(type, idx);
          else if (instanceId) handleCardClick(instanceId);
        }}
        className={`w-24 lg:w-32 aspect-square rounded-2xl border-2 transition-all flex items-center justify-center relative cursor-pointer group
          ${instanceId ? 'border-indigo-500/30 bg-slate-800/60 shadow-2xl scale-[1.02]' : (isSummonable ? 'border-indigo-500 bg-indigo-500/10 animate-pulse' : 'border-slate-800/40 bg-slate-900/40 hover:bg-slate-800/40')}
        `}
      >
        {!instanceId ? (
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{type[0]}-{idx+1}</span>
        ) : (
          <div className={`h-[85%] aspect-[63/88] relative transition-transform duration-500 ${isDefense ? 'rotate-90 scale-90' : 'rotate-0'}`}>
            {isFaceDown && !isPlayer ? (
              <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-slate-700 flex items-center justify-center shadow-2xl">
                 <Sparkles className="w-6 h-6 text-indigo-500/10" />
              </div>
            ) : (
              cardDef && <Card card={cardDef} isUltraMiniature className="w-full h-full shadow-2xl" />
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-100 select-none" 
      onClick={() => { setSelectedHandInstanceId(null); setSummoningMode(null); }}
    >
      {/* SPECTATOR BANNER */}
      {isSpectator && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[400] flex items-center gap-3 px-6 py-2 bg-amber-500/10 border border-amber-500/20 backdrop-blur-md rounded-full shadow-2xl">
           <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse shadow-[0_0_10px_#f59e0b]" />
           <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 italic">Live Spectator Mode</span>
        </div>
      )}

      <AnimatePresence>
        {showPortal && (
          <motion.div exit={{ opacity: 0 }} className="fixed inset-0 z-[1000] bg-slate-950 flex items-center justify-center">
             <h2 className="text-4xl font-black italic tracking-[0.5em] text-white animate-pulse uppercase">Duel Matrix</h2>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP BAR: Opponent Info */}
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 px-6 py-4 rounded-3xl z-[60] shadow-xl min-w-[200px]">
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">{opponent.name}</span>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-black text-white font-mono tracking-tighter">{opponent.lp}</span>
          <Heart className="w-6 h-6 text-rose-500" />
        </div>
      </div>

      {/* TOP LEFT: Turn & Time */}
      <div className="absolute top-4 left-4 flex items-center gap-6 bg-slate-900/60 backdrop-blur-md border border-slate-800/50 px-6 py-3 rounded-2xl z-[60] shadow-xl">
         <div className="flex items-center gap-3">
           <RefreshCw className="w-4 h-4 text-amber-500" />
           <span className="text-xs font-black text-amber-400 font-mono uppercase">T-{game.turn}</span>
         </div>
         <div className="w-px h-4 bg-slate-800" />
         <div className="flex items-center gap-3">
           <Clock className="w-4 h-4 text-emerald-400" />
           <span className="text-xs font-black text-emerald-400 font-mono">{formatTime(gameTime)}</span>
         </div>
      </div>

      {/* MAIN BOARD */}
      <main 
        onClick={() => {
          setSelectedHandInstanceId(null);
          setSummoningMode(null);
        }}
        className="flex-1 relative flex flex-col items-center justify-center gap-10 p-4 pt-20 pb-32"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.08)_0,transparent_75%)] pointer-events-none" />
        
        {/* OPPONENT SIDE */}
        <div className="flex flex-col items-center gap-6">
           <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-16 z-40">
             <div className="bg-slate-900/80 backdrop-blur-xl border border-white/5 border-t-0 rounded-b-[3rem] h-full w-full flex items-center justify-center relative">
               {opponent.hand.map((instanceId, idx) => {
                 const handSize = opponent.hand.length;
                 const areaWidth = 500; 
                 const cardWidth = 90;
                 const spacing = handSize > 1 ? Math.min(cardWidth + 10, (areaWidth - cardWidth) / (handSize - 1)) : 0;
                 const totalWidth = (handSize - 1) * spacing + cardWidth;
                 const startX = (areaWidth - totalWidth) / 2;
                 const xPos = startX + (idx * spacing) - (areaWidth / 2);

                 return (
                   <motion.div 
                     key={instanceId}
                     layout
                     animate={{ x: xPos, y: -45, opacity: 1, zIndex: 10 + idx }}
                     whileHover={{ y: -10, scale: 1.1, zIndex: 600 }}
                     className="absolute w-24 aspect-[63/88] bg-slate-900 rounded-2xl border border-indigo-500/30 shadow-2xl flex items-center justify-center cursor-help transition-colors hover:border-indigo-400"
                   >
                     <div className="w-full h-full bg-gradient-to-b from-indigo-500/20 to-slate-900 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-indigo-500/40" />
                     </div>
                   </motion.div>
                 );
               })}
             </div>
           </div>

           <div className="mt-16 flex items-center gap-8 scale-90 opacity-80">
           <div className="flex flex-col gap-4">
              <div className="w-20 aspect-square rounded-2xl border-2 border-indigo-500/20 bg-slate-900 flex flex-col items-center justify-center shadow-inner">
                 <Layers className="w-5 h-5 text-indigo-500/40" />
                 <span className="text-[10px] font-black text-indigo-400/60 font-mono">{opponent.deck.length}</span>
              </div>
              <div className="w-20 aspect-square rounded-2xl border border-slate-800/40 bg-slate-900/40 flex flex-col items-center justify-center">
                 <Trash2 className="w-5 h-5 text-slate-500/40" />
                 <span className="text-[10px] font-black text-slate-500/40 font-mono">{opponent.gy.length}</span>
              </div>
           </div>

           <div className="flex flex-col gap-4">
              <div className="flex gap-4">{opponent.spellZones.map((id, i) => renderZone('SPELL', i, id, false)).reverse()}</div>
              <div className="flex gap-4">{opponent.monsterZones.map((id, i) => renderZone('MONSTER', i, id, false)).reverse()}</div>
           </div>

           <div className="flex flex-col gap-4">
              <div className="w-20 aspect-square rounded-2xl border border-amber-500/20 bg-amber-950/5 flex flex-col items-center justify-center">
                 <Dna className="w-5 h-5 text-amber-500/20" />
                 <span className="text-[10px] font-black text-amber-500/20 font-mono">0</span>
              </div>
              <div className="w-20 aspect-square rounded-2xl border border-rose-500/20 bg-rose-950/5 flex flex-col items-center justify-center">
                 <X className="w-5 h-5 text-rose-500/20" />
                 <span className="text-[10px] font-black text-rose-500/20 font-mono">0</span>
              </div>
           </div>
        </div>
      </div>

        <div className="w-full max-w-lg h-px bg-white/5 relative">
          <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500/10" />
          
          <div className="absolute -right-28 top-1/2 -translate-y-1/2 w-28 flex flex-col items-center z-50">
            <button 
              disabled={!isMyTurn} 
              onClick={(e) => { e.stopPropagation(); nextPhase(); }} 
              className={`group relative flex items-center justify-center transition-all ${!isMyTurn ? 'opacity-30 grayscale scale-90' : 'hover:scale-110 active:scale-95'}`}
            >
              <div className="absolute inset-0 bg-indigo-500/10 blur-2xl rounded-full scale-150 animate-pulse" />
              <div className="relative w-24 h-24 bg-slate-900 border-4 border-indigo-500 rounded-full flex flex-col items-center justify-center shadow-2xl">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-0.5">{isMyTurn ? 'MY TURN' : 'WAIT'}</span>
                  <span className="text-[11px] font-black text-white uppercase tracking-tighter leading-none">{game.phase}</span>
                  <ChevronRight className="w-4 h-4 mt-1 text-indigo-500 animate-bounce-x" />
              </div>
            </button>
          </div>
        </div>

        {/* PLAYER SIDE */}
        <div className="flex items-center gap-8">
           <div className="flex flex-col gap-4">
              <div className="w-20 aspect-square rounded-2xl border border-rose-500/30 bg-rose-950/10 flex flex-col items-center justify-center">
                 <X className="w-5 h-5 text-rose-500/40" />
                 <span className="text-[10px] font-black text-rose-500/40 font-mono">{me.removed.length}</span>
              </div>
              <div className="w-20 aspect-square rounded-2xl border border-amber-500/30 bg-amber-950/10 flex flex-col items-center justify-center">
                 <Dna className="w-5 h-5 text-amber-500/40" />
                 <span className="text-[10px] font-black text-amber-500/40 font-mono">{me.extraDeck.length}</span>
              </div>
           </div>

           <div className="flex flex-col gap-4">
              <div className="flex gap-4">{me.monsterZones.map((id, i) => renderZone('MONSTER', i, id, true))}</div>
              <div className="flex gap-4">{me.spellZones.map((id, i) => renderZone('SPELL', i, id, true))}</div>
           </div>

           <div className="flex flex-col gap-4">
              <div className="w-20 aspect-square rounded-2xl border border-slate-700 bg-slate-900/40 flex flex-col items-center justify-center">
                 <Trash2 className="w-5 h-5 text-slate-400" />
                 <span className="text-[10px] font-black text-slate-400 font-mono">{me.gy.length}</span>
              </div>
              <div className="w-20 aspect-square rounded-2xl border-2 border-indigo-500 bg-slate-900 flex flex-col items-center justify-center shadow-[0_0_15px_rgba(79,70,229,0.2)]">
                 <Layers className="w-6 h-6 text-indigo-400" />
                 <span className="text-[10px] font-black text-white font-mono">{me.deck.length}</span>
              </div>
           </div>
        </div>
      </main>

      <div className="absolute bottom-6 left-6 flex flex-col gap-1 bg-slate-900/60 backdrop-blur-md border border-slate-800/60 px-6 py-4 rounded-3xl z-40 shadow-xl min-w-[200px]">
         <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em]">{me.name} LP</span>
         <div className="flex items-center gap-4">
           <Heart className="w-6 h-6 text-rose-500" />
           <span className="text-3xl font-black text-white font-mono tracking-tighter">{me.lp}</span>
         </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl h-16 z-40">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-white/5 rounded-t-[3rem] h-full w-full flex items-center justify-center relative">
          {me.hand.map((instanceId, idx) => {
             const def = getCardDefByInstance(instanceId);
             const isSelected = selectedHandInstanceId === instanceId;
             const isSummoning = summoningMode?.instanceId === instanceId;
             const handSize = me.hand.length;
             const areaWidth = 500; 
             const cardWidth = 90;
             const spacing = handSize > 1 ? Math.min(cardWidth + 10, (areaWidth - cardWidth) / (handSize - 1)) : 0;
             const totalWidth = (handSize - 1) * spacing + cardWidth;
             const startX = (areaWidth - totalWidth) / 2;
             const xPos = startX + (idx * spacing) - (areaWidth / 2);

             return (
               <motion.div
                 key={instanceId}
                 layout
                 animate={{ 
                   x: xPos, 
                   y: isSummoning ? 10 : (isSelected ? -50 : 45), 
                   zIndex: isSelected || isSummoning ? 500 : 10 + idx 
                 }}
                 whileHover={{ y: isSummoning ? 10 : (isSelected ? -50 : 10), scale: 1.1, zIndex: 600 }}
                 onClick={(e) => { 
                   if (isSpectator) return;
                   e.stopPropagation(); 
                   handleCardClick(instanceId); 
                 }}
                 className={`absolute w-24 aspect-[63/88] rounded-2xl border-2 cursor-pointer shadow-2xl transition-colors
                   ${isSelected ? 'border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : 'border-slate-800/50 hover:border-slate-700'}`}
               >
                 {def && (isSpectator ? (
                   <div className="w-full h-full bg-gradient-to-b from-indigo-600 to-slate-900 flex items-center justify-center rounded-2xl border border-indigo-400/30 shadow-inner overflow-hidden">
                      <Sparkles className="w-6 h-6 text-indigo-400/40" />
                   </div>
                 ) : (
                   <Card card={def} isMiniature />
                 ))}
                 
                 <AnimatePresence>
                   {isSelected && !summoningMode && isMyTurn && game.phase === GamePhase.MAIN && (
                     <motion.div 
                       initial={{ opacity: 0, y: 10, scale: 0.8 }}
                       animate={{ opacity: 1, y: -40, scale: 1 }}
                       exit={{ opacity: 0, y: 10, scale: 0.8 }}
                       className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-3 z-[100]"
                     >
                       {def?.type === CardType.MONSTER ? (
                         <>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setSummoningMode({ type: 'SUMMON', instanceId }); }}
                             className="flex flex-col items-center gap-1 group/btn"
                           >
                             <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-indigo-500 transition-colors">
                               <Zap className="w-6 h-6 text-white" />
                             </div>
                             <span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Summon</span>
                           </button>
                           <button 
                             onClick={(e) => { e.stopPropagation(); setSummoningMode({ type: 'SET', instanceId }); }}
                             className="flex flex-col items-center gap-1 group/btn"
                           >
                             <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-slate-600 transition-colors">
                               <Shield className="w-6 h-6 text-white" />
                             </div>
                             <span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Set</span>
                           </button>
                         </>
                       ) : (
                         <button 
                           onClick={(e) => { e.stopPropagation(); setSummoningMode({ type: 'ACTIVATE', instanceId }); }}
                           className="flex flex-col items-center gap-1 group/btn"
                         >
                           <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-emerald-500 transition-colors">
                             <Flame className="w-6 h-6 text-white" />
                           </div>
                           <span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Activate</span>
                         </button>
                       )}
                     </motion.div>
                   )}
                 </AnimatePresence>
               </motion.div>
             );
          })}
        </div>
      </div>

      {/* FLOATING CONTROLS */}
      <div className="absolute bottom-6 right-6 flex items-center gap-2 z-50">
         <button onClick={() => setIsLogsPanelOpen(!isLogsPanelOpen)} className={`p-3 bg-slate-900/80 border rounded-xl shadow-lg transition-all ${isLogsPanelOpen ? 'border-indigo-500 text-indigo-400' : 'border-slate-800 text-slate-500'}`}><History className="w-5 h-5" /></button>
         <button onClick={() => setIsInspectorPanelOpen(!isInspectorPanelOpen)} className={`p-3 bg-slate-900/80 border rounded-xl shadow-lg transition-all ${isInspectorPanelOpen ? 'border-indigo-500 text-indigo-400' : 'border-slate-800 text-slate-500'}`}><Search className="w-5 h-5" /></button>
         <button onClick={() => setShowSettings(true)} className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-amber-500 shadow-lg"><Dna className="w-5 h-5" /></button>
      </div>

      {/* INSPECTOR PANEL */}
      <AnimatePresence>
        {isInspectorPanelOpen && inspectedCard && !isCardPopupOpen && (
          <motion.div initial={{ x: -450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -450, opacity: 0 }} className="absolute top-1/2 -translate-y-1/2 left-6 z-50 pointer-events-none">
            <div className="w-[380px] flex flex-col pointer-events-auto relative">
              <Card card={inspectedCard} className="w-full shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setIsCardPopupOpen(true)} />
              <button onClick={() => setIsInspectorPanelOpen(false)} className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full text-slate-500 hover:text-white border border-slate-700 shadow-lg"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* LOGS PANEL (SHARED) */}
      <AnimatePresence>
        {isLogsPanelOpen && (
          <motion.div 
            initial={{ x: 400, opacity: 0, scale: 0.95 }} 
            animate={{ x: 0, opacity: 1, scale: 1 }} 
            exit={{ x: 400, opacity: 0, scale: 0.95 }} 
            className="absolute top-1/2 -translate-y-1/2 right-6 w-[320px] h-3/5 z-50"
          >
            <div className="w-full h-full bg-slate-950/80 backdrop-blur-2xl border border-indigo-500/20 rounded-[2.5rem] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden relative group">
               <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none" />
               
               {/* Header */}
               <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-slate-900/40 relative">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                     <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">System.Logs</h3>
                  </div>
                  <History className="w-4 h-4 text-slate-600" />
               </div>

               {/* Log List */}
               <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar relative">
                 {game.logs?.map((log, i) => {
                   const isPhase = log.msg.toLowerCase().includes('phase');
                   const isSummon = log.msg.toLowerCase().includes('summon');
                   const isTurn = log.msg.toLowerCase().includes('turn');

                   return (
                     <motion.div 
                       key={log.id} 
                       initial={{ opacity: 0, x: 20 }}
                       animate={{ opacity: 1, x: 0 }}
                       transition={{ delay: i * 0.05 }}
                       className="group/log flex gap-3 text-[10px] font-mono leading-relaxed"
                     >
                       <span className="text-slate-700 shrink-0 select-none">[{i.toString().padStart(3, '0')}]</span>
                       <div className={`flex-1 p-2.5 rounded-xl border transition-all ${
                         isPhase ? 'bg-cyan-500/5 border-cyan-500/20 text-cyan-200' :
                         isSummon ? 'bg-amber-500/5 border-amber-500/20 text-amber-200' :
                         isTurn ? 'bg-indigo-500/10 border-indigo-500/30 text-white font-bold' :
                         'bg-slate-900/50 border-white/5 text-slate-400'
                       }`}>
                         <span className={`${isPhase || isSummon || isTurn ? 'opacity-100' : 'opacity-60'} mr-1`}>&gt;</span>
                         {log.msg}
                       </div>
                     </motion.div>
                   );
                 })}
                 {(!game.logs || game.logs.length === 0) && (
                   <div className="h-full flex flex-col items-center justify-center text-slate-700 opacity-30 italic text-xs">
                      <Clock className="w-8 h-8 mb-2 opacity-20" />
                      Waiting for activity...
                   </div>
                 )}
               </div>

               {/* Footer status */}
               <div className="px-6 py-3 bg-black/40 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Network.Sync: Active</span>
                  <span className="text-[8px] font-black text-emerald-500/50 uppercase tracking-widest">v1.0.4-alpha</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MEGA CARD POPUP */}
      <AnimatePresence>
        {isCardPopupOpen && inspectedCard && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex items-center justify-center p-12 bg-slate-950/98 backdrop-blur-3xl" onClick={() => setIsCardPopupOpen(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={e => e.stopPropagation()} className="bg-slate-900 border-2 border-white/10 rounded-[4rem] w-[90vw] h-[85vh] flex overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)]">
              <div className="w-[600px] h-full p-20 flex items-center justify-center bg-black/40 border-r-2 border-white/10 relative shrink-0">
                 <Card card={inspectedCard} className="w-full max-w-[500px] shadow-2xl" />
                 <button onClick={() => setIsCardPopupOpen(false)} className="absolute top-10 right-10 p-4 bg-red-500/10 hover:bg-red-500 rounded-full text-white/40"><X className="w-8 h-8" /></button>
              </div>
              <div className="flex-1 flex flex-col p-20 gap-8 overflow-y-auto custom-scrollbar">
                 <h2 className="text-5xl font-black text-white uppercase tracking-tighter">{inspectedCard.name}</h2>
                 <p className="text-xl italic text-slate-400 leading-relaxed">{inspectedCard.description}</p>
                 <div className="space-y-6">
                    {inspectedCard.effects.map((eff, i) => (
                      <div key={i} className="p-8 bg-slate-950 border-l-4 border-indigo-500 rounded-r-2xl space-y-3">
                        <p className="text-lg text-white font-bold">{renderTriggerText(eff.trigger)}</p>
                        <p className="text-xl text-emerald-400 font-black">{eff.resolutions.map(r => renderResolutionText(r)).join(", ")}</p>
                      </div>
                    ))}
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
            <div className="bg-slate-900 p-12 rounded-[4rem] border border-white/10 w-[420px] shadow-2xl">
              <h3 className="text-3xl font-black italic text-white mb-10 text-center uppercase tracking-tighter">Tactical Command</h3>
              <div className="space-y-4">
                <button onClick={() => setShowSettings(false)} className="w-full py-5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-bold transition-all">Resume Duel</button>
                {!isSpectator && (
                  <button 
                    onClick={() => {
                      if (!game || !room || !me) return;
                      const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
                      
                      // Correctly identify the winner's email using the seat data
                      const winnerEmail = isP1 ? room.player2_email : room.player1_email;
                      nextGame.winnerEmail = winnerEmail;
                      
                      if (!nextGame.logs) nextGame.logs = [];
                      nextGame.logs.push({ id: Date.now(), msg: `${me.name} has surrendered.`, type: 'action' });
                      
                      setGame(nextGame);
                      updateServerGame(nextGame);
                      setDuelResult('DEFEAT');
                      setShowSettings(false);
                    }} 
                    className="w-full py-5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 rounded-2xl font-bold transition-all"
                  >
                    Surrender Protocols
                  </button>
                )}
                {isSpectator && (
                  <button 
                    onClick={async () => {
                      try {
                        await fetch('http://127.0.0.1:3001/api/rooms/leave', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId, email: userEmail })
                        });
                        onExit();
                      } catch (e) {
                        onExit(); // Exit anyway if API fails
                      }
                    }} 
                    className="w-full py-5 bg-slate-800/50 hover:bg-white hover:text-slate-900 text-slate-400 border border-white/5 rounded-2xl font-bold transition-all uppercase tracking-widest text-[10px]"
                  >
                    Abandon Mission
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
       {/* DUEL RESULT OVERLAYS */}
       <AnimatePresence>
         {duelResult && (
           <motion.div 
             initial={{ opacity: 0 }} 
             animate={{ opacity: 1 }} 
             className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/90 backdrop-blur-sm"
           >
             <motion.div 
               initial={{ scale: 0.5, y: 100, opacity: 0 }}
               animate={{ scale: 1, y: 0, opacity: 1 }}
               className="text-center space-y-12"
             >
                <div className="relative">
                   <motion.h2 
                     initial={{ letterSpacing: "0.5em", opacity: 0, scale: 2 }}
                     animate={{ letterSpacing: "1.2em", opacity: 1, scale: 1 }}
                     transition={{ duration: 1.5, ease: "easeOut" }}
                     className={`text-8xl font-black uppercase italic text-center -mr-[1.2em] ${duelResult.includes('VICTORY') ? 'text-indigo-400 drop-shadow-[0_0_30px_rgba(129,140,248,0.5)]' : 'text-rose-600 drop-shadow-[0_0_30px_rgba(225,29,72,0.5)]'}`}
                   >
                     {duelResult}
                   </motion.h2>
                   <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-px ${duelResult === 'VICTORY' ? 'bg-indigo-500/30' : 'bg-rose-500/30'} blur-xl`} />
                </div>

                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1 }}
                  className="bg-slate-900/80 border border-white/10 rounded-[3rem] p-12 max-w-md mx-auto backdrop-blur-3xl shadow-2xl space-y-8"
                >
                   <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Duel Finalized</p>
                      <h4 className="text-2xl font-bold text-white">Summary Statistics</h4>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Turns Played</p>
                         <p className="text-xl font-bold text-white">{game.turn}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <p className="text-[8px] font-black text-slate-500 uppercase mb-1">Final LP</p>
                         <p className="text-xl font-bold text-white">{me.lp}</p>
                      </div>
                   </div>

                   <button 
                     onClick={async () => {
                       try {
                         await fetch('http://127.0.0.1:3001/api/rooms/leave', {
                           method: 'POST',
                           headers: { 'Content-Type': 'application/json' },
                           body: JSON.stringify({ roomId, email: userEmail })
                         });
                       } catch (e) {}
                       
                       // Optional: Clear winner on server so room is fresh
                       if (game && !isSpectator) {
                         const nextGame = { ...game, winnerEmail: null };
                         await updateServerGame(nextGame);
                       }
                       onExit();
                     }}
                     className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-xl shadow-indigo-900/20 transition-all active:scale-95 flex items-center justify-center gap-3"
                   >
                      Return to Lobby
                      <ChevronRight className="w-5 h-5" />
                   </button>
                </motion.div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
};
