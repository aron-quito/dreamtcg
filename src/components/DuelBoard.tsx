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
  Flame,
  Package,
  Star
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
    lp: 2000,
    deck,
    hand,
    monsterZones: [null, null, null],
    spellZones: [null, null, null],
    cardPositions: {},
    cardVisibilities: {},
    gy: [],
    removed: [],
    extraDeck: [],
    attacksMade: {},
    negatedInstances: []
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
  const [summoningMode, setSummoningMode] = useState<{ type: 'SUMMON' | 'SET' | 'ACTIVATE', instanceId: string, isNegated?: boolean } | null>(null);
  const [inspectedInstanceId, setInspectedInstanceId] = useState<string | null>(null);
  const [isLogsPanelOpen, setIsLogsPanelOpen] = useState(false);
  const [isCardPopupOpen, setIsCardPopupOpen] = useState(false);
  const [isInspectorPanelOpen, setIsInspectorPanelOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [duelResult, setDuelResult] = useState<'VICTORY' | 'DEFEAT' | null>(null);
  // --- TRIBUTE STATE ---
  const [tributeModal, setTributeModal] = useState<{ instanceId: string; required: number } | null>(null);
  const [selectedTributes, setSelectedTributes] = useState<string[]>([]);
  const [isCostConfirmed, setIsCostConfirmed] = useState(false);
  const [viewingZone, setViewingZone] = useState<{ playerIndex: number; location: 'GY' | 'REMOVED' } | null>(null);
  
  // --- BATTLE STATES ---
  const [attackingInstanceId, setAttackingInstanceId] = useState<string | null>(null);
  const [isDirectAttackPrompt, setIsDirectAttackPrompt] = useState(false);
  const [battleAnim, setBattleAnim] = useState<{ 
    attackerId: string; 
    targetId: string | 'DIRECT'; 
    damage: number; 
    result: 'DESTROYED' | 'SURVIVED' | 'DIRECT' 
  } | null>(null);
  
  const lastActionTimeRef = useRef<number>(0);
  const isInitRef = useRef(false);

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

  const getCardDefByInstance = useCallback((instanceId: string | null) => {
    if (!instanceId) return null;
    const cardId = instanceId.split('_')[0];
    return cards.find(c => c.id === cardId) || null;
  }, [cards]);

  const hasAttributeMatch = useCallback((cardDef: CardDefinition | null) => {
    if (!cardDef || !me) return false;
    const fieldAttributes = me.monsterZones
      .filter(id => id !== null)
      .map(id => getCardDefByInstance(id)?.attribute)
      .filter(Boolean);
    return fieldAttributes.includes(cardDef.attribute);
  }, [me, getCardDefByInstance]);

  const updateServerGame = async (nextState: SyncedGameState) => {
    lastActionTimeRef.current = Date.now();
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
            
            // Ignore server sync if we just made a local action (2 sec grace period)
            if (Date.now() - lastActionTimeRef.current < 2500) return;

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
              phase: GamePhase.MAIN,
              activePlayerIndex: data.turn_order || 0,
              firstPlayerIndex: data.turn_order || 0,
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

  // Reset selection on phase change
  useEffect(() => {
    setInspectedInstanceId(null);
    setAttackingInstanceId(null);
    setSummoningMode(null);
  }, [game?.phase]);


  // ACTIONS
  const nextPhase = () => {
    if (!isMyTurn || !game) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const currentPhase = nextGame.phase;
    let next: GamePhase;
    
    switch (currentPhase) {
      case GamePhase.DREAM: next = GamePhase.DRAW; break;
      case GamePhase.DRAW: next = GamePhase.MAIN; break;
      case GamePhase.MAIN: 
        // Only the very first turn of the entire duel (Turn 1) skips the Battle Phase
        if (nextGame.turn === 1) {
          next = GamePhase.END;
        } else {
          next = GamePhase.BATTLE;
        }
        break;
      case GamePhase.BATTLE: next = GamePhase.END; break;
      case GamePhase.END: 
        next = GamePhase.DREAM;
        nextGame.activePlayerIndex = nextGame.activePlayerIndex === 0 ? 1 : 0;
        nextGame.turn++; // Increment turn on every player change
        // Reset attacks for the new active player
        nextGame.players[nextGame.activePlayerIndex].attacksMade = {};
        break;
      default: next = GamePhase.DREAM;
    }
    nextGame.phase = next;
    
    if (next === GamePhase.DRAW) {
      const p = nextGame.players[nextGame.activePlayerIndex];
      if (p.deck.length > 0) {
        p.hand.push(p.deck.pop()!);
      } else {
        // Deck Out!
        nextGame.winnerEmail = nextGame.players[nextGame.activePlayerIndex === 0 ? 1 : 0].email;
        if (!nextGame.logs) nextGame.logs = [];
        nextGame.logs.push({ id: Date.now(), msg: `${p.name} has no cards left in deck! DECK OUT!`, type: 'system' });
      }
    }

    if (!nextGame.logs) nextGame.logs = [];
    nextGame.logs.push({ id: Date.now(), msg: `Phase: ${next}`, type: 'system' });

    setGame(nextGame);
    updateServerGame(nextGame);
  };

  // Calculate tributes (spell cards to discard) needed for a given level
  const getTributesRequired = (level: number): number => {
    return level;
  };

  // Check if a monster card has normal summon restriction
  const isNormalSummonForbidden = (cardDef: any): boolean => {
    return cardDef?.effects?.some((eff: any) =>
      eff.restriction?.summonRestriction === 'ONLY_SPECIAL' ||
      eff.restriction?.summonRestriction === 'CANNOT_SUMMON'
    ) ?? false;
  };

  const placeCard = (zoneType: 'MONSTER' | 'SPELL', slotIndex: number, tributeIds: string[] = [], isNegated: boolean = false) => {
    if (!isMyTurn || !game || !summoningMode || !me) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const p = nextGame.players[myIndex];
    const zones = zoneType === 'MONSTER' ? p.monsterZones : p.spellZones;
    
    if (zones[slotIndex]) return;
    
    // Send tributed cards to GY
    if (tributeIds.length > 0) {
      tributeIds.forEach(tId => {
        const zoneIdx = p.monsterZones.findIndex(z => z === tId);
        if (zoneIdx !== -1) {
          p.monsterZones[zoneIdx] = null;
          delete p.cardPositions[tId];
          delete p.cardVisibilities[tId];
          p.gy = p.gy || [];
          p.gy.push(tId);
        } else {
          const handIdx = p.hand.indexOf(tId);
          if (handIdx !== -1 && tId !== summoningMode.instanceId) {
            p.hand.splice(handIdx, 1);
            p.gy = p.gy || [];
            p.gy.push(tId);
          }
        }
      });
    }
    
    const hIdx = p.hand.indexOf(summoningMode.instanceId);
    if (hIdx === -1) return;

    p.hand.splice(hIdx, 1);
    zones[slotIndex] = summoningMode.instanceId;
    p.cardPositions[summoningMode.instanceId] = summoningMode.type === 'SET' ? "DEFENSE" : "ATTACK";
    p.cardVisibilities[summoningMode.instanceId] = summoningMode.type === 'SET' ? "FACE_DOWN" : "FACE_UP";

    if (isNegated) {
      p.negatedInstances = p.negatedInstances || [];
      p.negatedInstances.push(summoningMode.instanceId);
    }

    const cardDef = getCardDefByInstance(summoningMode.instanceId);
    const discardedNames = tributeIds.map(tid => getCardDefByInstance(tid)?.name).filter(Boolean).join(", ");
    const tributeText = tributeIds.length > 0 ? ` (Discarded: ${discardedNames})` : (isNegated ? ' (Free: Attribute Match)' : '');
    
    if (!nextGame.logs) nextGame.logs = [];
    nextGame.logs.push({ 
      id: Date.now(), 
      msg: `${p.name} ${summoningMode.type === 'SUMMON' ? 'Summoned' : 'Set'} ${cardDef?.name}${tributeText}${isNegated ? ' [NEGATED]' : ''}`, 
      type: 'action' 
    });

    setGame(nextGame);
    updateServerGame(nextGame);
    setSummoningMode(null);
    setTributeModal(null);
    setSelectedTributes([]);
    setIsCostConfirmed(false);
  };

  const executeAttack = async (attackerId: string, targetId: string | 'DIRECT') => {
    if (!game || !me || !opponent) return;
    
    const attackerDef = getCardDefByInstance(attackerId);
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const myState = nextGame.players[myIndex];
    const oppState = nextGame.players[oppIndex];

    if (!myState.attacksMade) myState.attacksMade = {};
    const attacksMade = myState.attacksMade[attackerId] || 0;
    
    // Default limit 1 for now
    if (attacksMade >= 1) {
       setAttackingInstanceId(null);
       return;
    }

    let damage = 0;
    let result: 'DESTROYED' | 'SURVIVED' | 'DIRECT' = 'DIRECT';

    if (targetId === 'DIRECT') {
      damage = attackerDef?.atk || 0;
      oppState.lp = Math.max(0, oppState.lp - damage);
      result = 'DIRECT';
    } else {
      const targetDef = getCardDefByInstance(targetId);
      const targetPos = oppState.cardPositions[targetId] || 'ATTACK';
      
      // REVEAL IF FACE DOWN
      if (oppState.cardVisibilities[targetId] === 'FACE_DOWN') {
        oppState.cardVisibilities[targetId] = 'FACE_UP';
        if (!nextGame.logs) nextGame.logs = [];
        nextGame.logs.push({ id: Date.now(), msg: `Set monster revealed: ${targetDef?.name}`, type: 'system' });
      }
      
      if (targetPos === 'ATTACK') {
        const diff = (attackerDef?.atk || 0) - (targetDef?.atk || 0);
        if (diff > 0) {
          damage = diff;
          oppState.lp = Math.max(0, oppState.lp - damage);
          oppState.monsterZones = oppState.monsterZones.map(id => id === targetId ? null : id);
          oppState.gy.push(targetId);
          result = 'DESTROYED';
        } else if (diff < 0) {
          damage = Math.abs(diff);
          myState.lp = Math.max(0, myState.lp - damage);
          myState.monsterZones = myState.monsterZones.map(id => id === attackerId ? null : id);
          myState.gy.push(attackerId);
          result = 'DESTROYED';
        } else {
          myState.monsterZones = myState.monsterZones.map(id => id === attackerId ? null : id);
          oppState.monsterZones = oppState.monsterZones.map(id => id === targetId ? null : id);
          myState.gy.push(attackerId);
          oppState.gy.push(targetId);
          result = 'DESTROYED';
        }
      } else {
        const diff = (attackerDef?.atk || 0) - (targetDef?.def || 0);
        if (diff > 0) {
          oppState.monsterZones = oppState.monsterZones.map(id => id === targetId ? null : id);
          oppState.gy.push(targetId);
          result = 'DESTROYED';
        } else if (diff < 0) {
          damage = Math.abs(diff);
          myState.lp = Math.max(0, myState.lp - damage);
          result = 'SURVIVED';
        }
      }
    }

    myState.attacksMade[attackerId] = attacksMade + 1;
    setBattleAnim({ attackerId, targetId, damage, result });
    
    setAttackingInstanceId(null);
    updateServerGame(nextGame);

    // DELAY VICTORY/DEFEAT SCREEN TO ALLOW ANIMATION TO PLAY
    setTimeout(() => {
      setBattleAnim(null);
      if (oppState.lp <= 0) {
        setDuelResult('VICTORY');
        // Update winner on server
        const winGame = JSON.parse(JSON.stringify(nextGame)) as SyncedGameState;
        winGame.winnerEmail = me.email;
        updateServerGame(winGame);
      } else if (myState.lp <= 0) {
        setDuelResult('DEFEAT');
        const loseGame = JSON.parse(JSON.stringify(nextGame)) as SyncedGameState;
        loseGame.winnerEmail = opponent.email;
        updateServerGame(loseGame);
      }
    }, 2000);
  };

  const handleCardClick = (instanceId: string) => {
    // --- PHASE: Cost Selection (Summoning with Tribute/Cost) ---
    if (tributeModal) {
      // 1. If cost is already confirmed, clicking any card cancels the process
      if (isCostConfirmed) {
        setSummoningMode(null);
        setTributeModal(null);
        setSelectedTributes([]);
        setIsCostConfirmed(false);
        return;
      }

      // 2. Clicking the card being summoned again cancels the process
      if (instanceId === tributeModal.instanceId) {
        setSummoningMode(null);
        setTributeModal(null);
        setSelectedTributes([]);
        setIsCostConfirmed(false);
        return;
      }

      // 3. Selection of Spells in Hand
      const cardDef = getCardDefByInstance(instanceId);
      const isInHand = me?.hand.includes(instanceId);
      
      if (isInHand) {
        if (selectedTributes.includes(instanceId)) {
          setSelectedTributes(prev => prev.filter(id => id !== instanceId));
        } else if (selectedTributes.length < tributeModal.required) {
          setSelectedTributes(prev => [...prev, instanceId]);
        }
      } else {
        // Clicked anything else -> Cancel
        setSummoningMode(null);
        setTributeModal(null);
        setSelectedTributes([]);
        setSelectedHandInstanceId(null);
        setIsCostConfirmed(false);
      }
      return;
    }

    // --- PHASE: Attack Target Selection ---
    if (attackingInstanceId) {
      if (instanceId === attackingInstanceId) {
        setAttackingInstanceId(null);
        return;
      }
      
      const isOpponentMonster = opponent?.monsterZones.includes(instanceId);
      if (isOpponentMonster) {
        executeAttack(attackingInstanceId, instanceId);
        return;
      } else {
        setAttackingInstanceId(null);
      }
      return;
    }

    // --- PHASE: Target Selection (Summoning without cost or other modes) ---
    if (summoningMode) {
      if (instanceId !== summoningMode.instanceId) {
        setSummoningMode(null);
        setSelectedHandInstanceId(null);
      }
      return;
    }

    // --- PHASE: Normal Inspection / Selection ---
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
    const tributesPaid = !tributeModal || isCostConfirmed;
    const isTributeTarget = false; // No longer tributing from field
    const isSummonable = isPlayer && !isSpectator && summoningMode && tributesPaid && (
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
          if (isTributeTarget) { handleCardClick(instanceId!); return; }
          if (isSummonable) placeCard(type, idx, selectedTributes, summoningMode?.isNegated);
          else if (instanceId) handleCardClick(instanceId);
        }}
        className={`w-24 lg:w-32 aspect-square rounded-2xl border-2 transition-all flex items-center justify-center relative cursor-pointer group
          ${isTributeTarget && selectedTributes.includes(instanceId!) ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-amber-400/20' : ''}
          ${isTributeTarget && !selectedTributes.includes(instanceId!) ? 'border-amber-500/30 bg-amber-500/5 hover:border-amber-400' : ''}
          ${!isTributeTarget && instanceId ? 'border-indigo-500/30 bg-slate-800/60 shadow-2xl scale-[1.02]' : ''}
          ${!isTributeTarget && !instanceId && isSummonable ? 'border-indigo-500 bg-indigo-500/10 animate-pulse' : ''}
          ${!isTributeTarget && !instanceId && !isSummonable ? 'border-slate-800/40 bg-slate-900/40 hover:bg-slate-800/40' : ''}
        `}
      >
        {!instanceId ? (
          <span className="text-[9px] font-black text-slate-700 uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">{type[0]}-{idx+1}</span>
        ) : (
          <>
            <div className={`h-[85%] aspect-[63/88] relative transition-transform duration-500 ${isDefense ? 'rotate-90 scale-90' : 'rotate-0'}`}>
              {isFaceDown && !isPlayer ? (
                <div className="w-full h-full bg-slate-800 rounded-lg border-2 border-slate-700 flex items-center justify-center shadow-2xl">
                   <Sparkles className="w-6 h-6 text-indigo-500/10" />
                </div>
              ) : (
                cardDef && (
                  <div className="relative w-full h-full">
                    <Card card={cardDef} isUltraMiniature className="w-full h-full shadow-2xl" />
                    {targetPlayer.negatedInstances?.includes(instanceId!) && (
                      <div className="absolute inset-0 bg-red-950/40 backdrop-blur-[1px] rounded-lg flex items-center justify-center border-2 border-red-500/50 z-10 pointer-events-none overflow-hidden">
                         <div className="absolute inset-0 flex items-center justify-center opacity-20 rotate-12">
                            <X className="w-20 h-20 text-red-500" />
                         </div>
                         <span className="text-[10px] font-black text-red-500 bg-slate-950/80 px-2 py-0.5 rounded uppercase tracking-tighter shadow-2xl z-20">Negated</span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Level Badge (Top-Right) */}
            {cardDef && type === 'MONSTER' && !isFaceDown && (
              <div className="absolute top-1 right-1 z-30 pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
                 <div className="w-6 h-6 rounded-full bg-slate-950 border-2 border-white/20 flex items-center justify-center shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                    <span className="text-[12px] font-black text-white leading-none tabular-nums italic z-10">{cardDef.level}</span>
                 </div>
              </div>
            )}

            {/* Master Duel Style Stats Overlay (Bottom) */}
            {cardDef && type === 'MONSTER' && !isFaceDown && (
              <div className="absolute inset-x-0 bottom-1 flex flex-col items-center z-30 pointer-events-none px-1">
                <div className="relative w-full flex items-center justify-center">
                  {/* ATK / DEF - Large & Centered */}
                  <div className="flex items-center filter drop-shadow-[0_4px_12px_rgba(0,0,0,1)] translate-y-0">
                    <span className={`text-[20px] lg:text-[24px] font-black tracking-tighter tabular-nums italic transition-all duration-500 ${!isDefense ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'text-slate-500 opacity-40'}`} style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.8)' }}>
                      {cardDef.atk}
                    </span>
                    
                    <span className="text-[12px] text-slate-700 font-bold mx-2 opacity-30 italic self-end mb-1">/</span>
                    
                    <span className={`text-[20px] lg:text-[24px] font-black tracking-tighter tabular-nums italic transition-all duration-500 ${isDefense ? 'text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]' : 'text-slate-500 opacity-40'}`} style={{ WebkitTextStroke: '0.5px rgba(0,0,0,0.8)' }}>
                      {cardDef.def}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Attack Button & Highlights */}
            {instanceId && isPlayer && game.phase === GamePhase.BATTLE && game.activePlayerIndex === myIndex && !attackingInstanceId && instanceId === inspectedInstanceId && (me.attacksMade[instanceId] || 0) < 1 && visibility === 'FACE_UP' && (
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const hasOpponentMonsters = opponent.monsterZones.some(id => id !== null);
                  if (!hasOpponentMonsters) {
                    setAttackingInstanceId(instanceId);
                    setIsDirectAttackPrompt(true);
                  } else {
                    setAttackingInstanceId(instanceId);
                  }
                }}
                className="absolute -top-14 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.4)] transition-all z-[60] flex items-center gap-2 group animate-bounce"
              >
                <Sword className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                <span className="tracking-tighter uppercase italic">Attack</span>
              </button>
            )}

            {attackingInstanceId === instanceId && (
              <div className="absolute inset-0 ring-4 ring-red-500 ring-offset-4 ring-offset-slate-950 rounded-2xl animate-pulse z-40" />
            )}

            {attackingInstanceId && !isPlayer && type === 'MONSTER' && instanceId && (
              <div className="absolute inset-0 bg-red-500/10 border-4 border-red-500/40 rounded-2xl animate-pulse z-40 cursor-crosshair">
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Sword className="w-8 h-8 text-red-500 animate-spin-slow" />
                 </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-slate-950 flex flex-col overflow-hidden font-sans text-slate-100 select-none" 
      onClick={() => { setSelectedHandInstanceId(null); setSummoningMode(null); setTributeModal(null); setSelectedTributes([]); }}
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
          setTributeModal(null);
          setSelectedTributes([]);
          setIsCostConfirmed(false);
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
                             <div 
                 onClick={(e) => { e.stopPropagation(); setViewingZone({ playerIndex: oppIndex, location: 'GY' }); }}
                 className="w-20 aspect-square rounded-2xl border border-slate-800/40 bg-slate-900/40 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/60 transition-colors"
               >

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
                             <div 
                 onClick={(e) => { e.stopPropagation(); setViewingZone({ playerIndex: oppIndex, location: 'REMOVED' }); }}
                 className="w-20 aspect-square rounded-2xl border border-rose-500/20 bg-rose-950/5 flex flex-col items-center justify-center cursor-pointer hover:bg-rose-900/20 transition-colors"
               >

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
                             <div 
                 onClick={(e) => { e.stopPropagation(); setViewingZone({ playerIndex: myIndex, location: 'REMOVED' }); }}
                 className="w-20 aspect-square rounded-2xl border border-rose-500/30 bg-rose-950/10 flex flex-col items-center justify-center cursor-pointer hover:bg-rose-900/20 transition-colors"
               >

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
                             <div 
                 onClick={(e) => { e.stopPropagation(); setViewingZone({ playerIndex: myIndex, location: 'GY' }); }}
                 className="w-20 aspect-square rounded-2xl border border-slate-700 bg-slate-900/40 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-800/60 transition-colors"
               >

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

             const isTributeCandidate = tributeModal && instanceId !== tributeModal.instanceId;
             const isTributeSelected = isTributeCandidate && selectedTributes.includes(instanceId);

             return (
               <motion.div
                 key={instanceId}
                 layout
                 animate={{ 
                   x: xPos, 
                   y: isSummoning ? 10 : (isTributeSelected && !isCostConfirmed ? -30 : (isSelected ? -50 : 45)), 
                   zIndex: isSelected || isSummoning || isTributeSelected ? 500 : 10 + idx 
                 }}
                 whileHover={{ y: isSummoning ? 10 : (isTributeSelected ? -30 : (isSelected ? -50 : 10)), scale: 1.1, zIndex: 600 }}
                 onClick={(e) => { 
                   if (isSpectator) return;
                   e.stopPropagation(); 
                   handleCardClick(instanceId); 
                 }}
                 className={`absolute w-24 aspect-[63/88] rounded-2xl border-2 cursor-pointer shadow-2xl transition-colors
                   ${isTributeSelected ? 'border-amber-400 shadow-[0_0_30px_rgba(245,158,11,0.4)]' : ''}
                   ${isTributeCandidate && !isTributeSelected ? 'border-amber-500/30 hover:border-amber-400' : ''}
                   ${!isTributeCandidate && isSelected ? 'border-indigo-500 shadow-[0_0_30px_rgba(79,70,229,0.4)]' : ''}
                   ${!isTributeCandidate && !isSelected ? 'border-slate-800/50 hover:border-slate-700' : ''}`}
               >
                 {def && (isSpectator ? (
                   <div className="w-full h-full bg-gradient-to-b from-indigo-600 to-slate-900 flex items-center justify-center rounded-2xl border border-indigo-400/30 shadow-inner overflow-hidden">
                      <Sparkles className="w-6 h-6 text-indigo-400/40" />
                   </div>
                 ) : (
                   <Card card={def} isMiniature />
                 ))}
                 
                 <AnimatePresence>
                     {isSelected && !summoningMode && isMyTurn && game.phase === GamePhase.MAIN && (()=>{
                       const level=def?.level||0;
                       const tributesNeeded=getTributesRequired(level);
                       const handSize = me.hand.length;
                       const canAffordTribute = (handSize - 1) >= tributesNeeded;
                       const normalSummonForbidden=isNormalSummonForbidden(def);
                       const attrMatch = hasAttributeMatch(def);
                       
                       return(
                       <motion.div initial={{opacity:0,y:10,scale:0.8}} animate={{opacity:1,y:-40,scale:1}} exit={{opacity:0,y:10,scale:0.8}} className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-3 z-[100]">
                         {def?.type===CardType.MONSTER?(<>{!normalSummonForbidden&&(<button onClick={(e)=>{e.stopPropagation();if(!canAffordTribute)return;if(tributesNeeded===0){setSummoningMode({type:'SUMMON',instanceId,isNegated:false});}else{setSummoningMode({type:'SUMMON',instanceId,isNegated:false});setTributeModal({instanceId,required:tributesNeeded});setSelectedTributes([]);setSelectedHandInstanceId(null);}}} disabled={!canAffordTribute} className={`flex flex-col items-center gap-1 group/btn ${!canAffordTribute?'opacity-40 cursor-not-allowed':''}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${canAffordTribute?'bg-indigo-600 group-hover/btn:bg-indigo-500':'bg-slate-700'}`}><Zap className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">{tributesNeeded>0?`Cost (${tributesNeeded})`:'Summon'}</span></button>)}
                         
                         {attrMatch && !normalSummonForbidden && (
                           <button onClick={(e)=>{e.stopPropagation();setSummoningMode({type:'SUMMON',instanceId,isNegated:true});setSelectedHandInstanceId(null);}} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-amber-500 transition-colors shadow-amber-500/20 animate-pulse"><Sparkles className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">Free Match</span></button>
                         )}
<button onClick={(e)=>{e.stopPropagation();if(!canAffordTribute)return;if(tributesNeeded===0){setSummoningMode({type:'SET',instanceId});}else{setSummoningMode({type:'SET',instanceId});setTributeModal({instanceId,required:tributesNeeded});setSelectedTributes([]);setSelectedHandInstanceId(null);}}} disabled={!canAffordTribute} className={`flex flex-col items-center gap-1 group/btn ${!canAffordTribute?'opacity-40 cursor-not-allowed':''}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${canAffordTribute?'bg-slate-700 group-hover/btn:bg-slate-600':'bg-slate-800'}`}><Shield className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Set</span></button></>):(<button onClick={(e)=>{e.stopPropagation();setSummoningMode({type:'ACTIVATE',instanceId});}} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-emerald-500 transition-colors"><Flame className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Activate</span></button>)}
                       </motion.div>
                       );
                     })()}
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
          <motion.div initial={{ x: -450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -450, opacity: 0 }} className="absolute top-1/2 -translate-y-1/2 left-6 z-[800] pointer-events-none">
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
      {/* TRIBUTE COST SELECTION OVERLAY */}
      <AnimatePresence>
        {tributeModal && game && me && !isCostConfirmed && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[600] pointer-events-auto"
          >
            <div className="bg-slate-950/95 backdrop-blur-2xl border border-amber-500/30 rounded-[2rem] px-8 py-5 shadow-[0_0_60px_rgba(0,0,0,0.6)] flex items-center gap-6 min-w-[420px]">
              {/* Icon */}
              <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center shrink-0">
                <Zap className="w-6 h-6 text-amber-400" />
              </div>

              {/* Info */}
              <div className="flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-400 mb-1">Summon Cost</p>
                <p className="text-slate-400 text-[10px]">
                  Select {tributeModal.required} <span className="text-white font-bold">cards</span> from your <span className="text-white font-bold">hand</span>
                </p>
              </div>

              {/* Counter */}
              <div className="flex items-center gap-3">
                <div className="flex gap-1.5">
                  {Array.from({ length: tributeModal.required }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
                        i < selectedTributes.length
                          ? 'bg-amber-400 border-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.6)]'
                          : 'bg-transparent border-slate-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-lg font-black text-white font-mono">
                  {selectedTributes.length}<span className="text-slate-600">/{tributeModal.required}</span>
                </span>
              </div>

              {/* Cancel */}
              <button
                onClick={() => { setTributeModal(null); setSummoningMode(null); setSelectedTributes([]); }}
                className="p-2 bg-slate-800 hover:bg-red-500/20 rounded-xl border border-white/5 hover:border-red-500/30 text-slate-500 hover:text-red-400 transition-all"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Confirm Button */}
              {selectedTributes.length === tributeModal.required && (
                <button
                  onClick={(e) => { e.stopPropagation(); setIsCostConfirmed(true); }}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-900/40 animate-in fade-in zoom-in duration-300"
                >
                  Confirm Cost
                </button>
              )}
            </div>

            {/* Sub-text when all selected */}
            {selectedTributes.length >= tributeModal.required && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mt-3 animate-pulse"
              >
                ✓ Cost Paid — Select a Monster Zone to Summon
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ZONE VIEWER (GY / REMOVED) */}
      <AnimatePresence>
        {viewingZone && game && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            className="fixed inset-0 z-[700] bg-slate-950/40 flex items-center justify-end pr-12 p-6"
            onClick={() => setViewingZone(null)}
          >
            <motion.div 
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              className="bg-slate-900 border border-white/5 rounded-[2.5rem] w-[40vw] max-w-3xl h-[75vh] flex flex-col shadow-2xl overflow-hidden p-10"
              onClick={e => e.stopPropagation()}
            >
            <div className="flex items-center justify-between mb-8">
               <div className="flex flex-col gap-1">
                 <h2 className="text-2xl font-black text-white uppercase tracking-tighter">
                   {viewingZone.location === 'GY' ? 'Graveyard' : 'Banishment Zone'}
                 </h2>
                 <p className="text-slate-500 text-sm font-bold uppercase tracking-widest">
                   Viewing {game.players[viewingZone.playerIndex].name}'s {viewingZone.location}
                 </p>
               </div>
               <button onClick={() => setViewingZone(null)} className="p-3 bg-slate-800 hover:bg-red-500 rounded-2xl text-white transition-colors">
                 <X className="w-6 h-6" />
               </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-4" onClick={e => e.stopPropagation()}>
               {(() => {
                 const player = game.players[viewingZone.playerIndex];
                 const cardInstances = viewingZone.location === 'GY' ? player.gy : player.removed;
                 
                 if (!cardInstances || cardInstances.length === 0) {
                   return (
                     <div className="h-full flex flex-col items-center justify-center opacity-20 italic">
                        <Package className="w-20 h-20 mb-4" />
                        <p className="text-2xl font-black uppercase">Zone Empty</p>
                     </div>
                   );
                 }

                 return (
                   <div className="grid grid-cols-2 lg:grid-cols-3 gap-8 p-6 pt-12">
                     {cardInstances.map((instanceId) => {
                       const def = getCardDefByInstance(instanceId);
                       return def && (
                         <div key={instanceId} className="space-y-3 group" onClick={() => setInspectedInstanceId(instanceId)}>
                           <Card card={def} isMiniature className="w-full hover:scale-110 hover:-translate-y-4 transition-all duration-300 cursor-zoom-in" />
                           <p className="text-[10px] font-black text-slate-500 text-center uppercase truncate group-hover:text-white transition-colors">{def.name}</p>
                         </div>
                       );
                     })}
                   </div>
                 );
               })()}
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* BATTLE ANIMATION OVERLAY */}
      <AnimatePresence>
        {battleAnim && (
          <div className="fixed inset-0 z-[1000] pointer-events-none flex items-center justify-center overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-950/20 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 2, opacity: 0 }}
              className="relative flex flex-col items-center"
            >
               <motion.div 
                 initial={{ width: 0, opacity: 0 }}
                 animate={{ width: 800, opacity: 1 }}
                 transition={{ duration: 0.3, ease: "easeOut" }}
                 className="absolute h-1 bg-white shadow-[0_0_30px_#fff,0_0_60px_#f00] rotate-[-35deg] z-10"
               />
               <motion.div
                 initial={{ scale: 0 }}
                 animate={{ scale: [0, 1.5, 1] }}
                 className="w-40 h-40 bg-white rounded-full blur-3xl opacity-50"
               />
               <motion.div
                 initial={{ y: 0, opacity: 0, scale: 0.5 }}
                 animate={{ y: -150, opacity: 1, scale: 1.5 }}
                 className="text-9xl font-black text-white italic drop-shadow-[0_0_20px_rgba(255,0,0,0.8)] z-20"
               >
                 {battleAnim.damage > 0 ? `-${battleAnim.damage}` : '0'}
               </motion.div>
               <motion.div
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="text-2xl font-black text-red-500 uppercase tracking-widest mt-4"
               >
                 {battleAnim.result}
               </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DIRECT ATTACK PROMPT */}
      <AnimatePresence>
        {isDirectAttackPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 p-10 rounded-[2.5rem] border border-white/10 flex flex-col items-center gap-8 shadow-2xl max-w-md w-full"
            >
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center border border-red-500/30">
                <Sword className="w-10 h-10 text-red-500" />
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">Direct Attack?</h3>
                <p className="text-slate-400 text-sm">The opponent has no monsters to defend. Attack their Life Points directly?</p>
              </div>
              <div className="flex gap-4 w-full">
                <button 
                  onClick={() => { setIsDirectAttackPrompt(false); executeAttack(attackingInstanceId!, 'DIRECT'); }} 
                  className="flex-1 py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl uppercase transition-all shadow-lg shadow-red-600/20 active:scale-95"
                >
                  Confirm
                </button>
                <button 
                  onClick={() => { setIsDirectAttackPrompt(false); setAttackingInstanceId(null); }} 
                  className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl uppercase transition-all active:scale-95"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
