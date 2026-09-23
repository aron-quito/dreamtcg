import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Zap, 
  RefreshCw, 
  X,
  Minus,
  Layers,
  Sword,
  Shield,
  Sparkles,
  Heart,
  Clock,
  ArrowRight,
  Maximize2,
  Minimize2,
  Search,
  History,
  Trash2,
  Dna,
  Loader2,
  ChevronRight,
  Flame,
  Package,
  Star,
  CloudRain
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  GameState, 
  CardType,
  TriggerType,
  DeckDefinition,
  PlayerState,
  GamePhase,
  CardEffect,
  CardLocation
} from '../types';
import { API_BASE } from '../config';
import { CardDefinition } from '../types';
import { EffectEngine, resetTurnTracking } from '../engine/engine';
import { CardRegistry } from '../engine/scripts/registry';
import { SyncedGameState } from '../engine/types';

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

// SyncedGameState is imported from the engine barrel — no redeclaration needed.


export const DuelBoard: React.FC<DuelBoardProps> = ({ cards, decks, roomId, userEmail, isSpectator, onExit }) => {
  // --- SYNC STATE ---
  const [game, setGame] = useState<SyncedGameState | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [showPortal, setShowPortal] = useState(true);

  // --- UI STATE ---
  const [selectedHandInstanceId, setSelectedHandInstanceId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<'SUMMON' | 'SET' | null>(null);
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [summoningMode, setSummoningMode] = useState<{ type: 'SUMMON' | 'SET' | 'ACTIVATE', instanceId: string, isNegated?: boolean, isDreamSummon?: boolean } | null>(null);
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
  const [engineSelectionPrompt, setEngineSelectionPrompt] = useState<{
    options: string[];
    count: number;
    message: string;
    resolve: (selectedIds: string[]) => void;
  } | null>(null);
  const [selectedEngineOptions, setSelectedEngineOptions] = useState<string[]>([]);
  const [isSelectionMinimized, setIsSelectionMinimized] = useState(false);
  const [isZoneViewerMinimized, setIsZoneViewerMinimized] = useState(false);
  
  // --- BATTLE STATES ---
  const [attackingInstanceId, setAttackingInstanceId] = useState<string | null>(null);
  const [isDirectAttackPrompt, setIsDirectAttackPrompt] = useState(false);
  const [battleAnim, setBattleAnim] = useState<{ 
    attackerId: string; 
    targetId: string | 'DIRECT'; 
    damage: number; 
    result: 'DESTROYED' | 'SURVIVED' | 'DIRECT' 
  } | null>(null);

  // --- CHAIN ANIMATION STATES ---
  const [selectedPriorityItem, setSelectedPriorityItem] = useState<{ instanceId: string; effectId: string } | null>(null);
  const [isPriorityMinimized, setIsPriorityMinimized] = useState(false);
  const [chainBuildAnim, setChainBuildAnim] = useState<{ 
    instanceId: string; 
    chainNumber: number; 
    cardName: string; 
    playerName: string 
  } | null>(null);
  const [chainResolutionAnim, setChainResolutionAnim] = useState<{
    links: Array<{ instanceId: string; cardName: string; chainNumber: number; playerName: string; effectName: string }>;
    currentIndex: number;
    phase: 'OVERVIEW' | 'RESOLVING' | 'DONE';
  } | null>(null);
  
  const lastActionTimeRef = useRef<number>(0);
  const isInitRef = useRef(false);
  const [resolvingCardId, setResolvingCardId] = useState<string | null>(null);
  const engineRef = useRef<EffectEngine>(new EffectEngine(cards as CardDefinition[]));

  // Initialize engine whenever cards change
  useEffect(() => {
    engineRef.current = new EffectEngine(cards as CardDefinition[]);
  }, [cards]);

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
    const cardId = instanceId.substring(0, instanceId.lastIndexOf('_'));
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
      await fetch(`${API_BASE}/rooms/game/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, gameState: nextState, email: userEmail })
      });
    } catch (e) {}
  };

  const pushLog = (g: SyncedGameState, msg: string, type: string = 'info') => {
    if (!g.logs) g.logs = [];
    g.logs.push({ id: Date.now() + Math.random(), msg: msg, type });
    if (g.logs.length > 40) g.logs.shift();
  };

  const addSyncedLog = (msg: string, type: string = 'info') => {
    if (!game) return;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    pushLog(nextGame, msg, type);
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
        const response = await fetch(`${API_BASE}/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setRoom(data);

          if (data.game_state) {
            try {
              const nextGame = JSON.parse(data.game_state) as SyncedGameState;
              
              // Ignore server sync if we just made a local action (2 sec grace period)
              if (Date.now() - lastActionTimeRef.current < 2500) return;

              setGame(nextGame);

              // Sync Duel Result
              if (nextGame.winnerEmail) {
                if (isSpectator) {
                  const winner = nextGame.players.find(p => p.email?.toLowerCase().trim() === nextGame.winnerEmail?.toLowerCase().trim());
                  setDuelResult(winner ? `VICTORY: ${winner.name}` : 'DUEL FINISHED');
                } else if (userEmail) {
                  const isWinner = nextGame.winnerEmail.toLowerCase().trim() === userEmail.toLowerCase().trim();
                  setDuelResult(isWinner ? 'VICTORY' : 'DEFEAT');
                }
              }
            } catch (err) {
              console.error("Failed to parse game state:", err, data.game_state);
            }
          } else if (data.host_email === userEmail && !isInitRef.current) {
            isInitRef.current = true;
            console.log("Host initializing game state...");
            
            // Fetch both players' decks directly from the server
            const fetchDecks = async (email: string) => {
               try {
                  const res = await fetch(`${API_BASE}/decks?userEmail=${email}`);
                  if (res.ok) return await res.json();
               } catch(e) {}
               return [];
            };
            
            const p1Decks = await fetchDecks(data.player1_email);
            const p2Decks = await fetchDecks(data.player2_email);
            
            const filterDeck = (deckId: string | null, sourceDecks: any[]) => {
              const deck = sourceDecks.find((d: any) => d.id === deckId);
              if (!deck) return [];
              return deck.mainCards.map((id: string) => {
                 const def = cards.find(c => c.id === id);
                 return def ? `${def.id}_${Math.random().toString(36).substr(2, 9)}` : null;
              }).filter(Boolean) as string[];
            };

            // Draw initial hands (4 cards)
            const p1Deck = filterDeck(data.host_deck_id, p1Decks);
            const p2Deck = filterDeck(data.guest_deck_id, p2Decks);
            const p1Hand = p1Deck.splice(0, 4);
            const p2Hand = p2Deck.splice(0, 4);

            const initialGame: SyncedGameState = {
              turn: 1,
              activePlayerIndex: data.turn_order || 0,
              firstPlayerIndex: data.turn_order || 0,
              phase: GamePhase.MAIN, // Start in MAIN for turn 1 (skip DREAM and DRAW)
              chain: [],
              logs: [{ id: Date.now(), msg: 'Duel Started!', type: 'system' }],
              players: [
                {
                  id: 'p1',
                  name: data.p1_name || 'Player 1',
                  email: data.player1_email,
                  lp: 2000,
                  deck: p1Deck,
                  hand: p1Hand,
                  monsterZones: Array(3).fill(null),
                  spellZones: Array(3).fill(null),
                  cardPositions: {},
                  cardVisibilities: {},
                  gy: [],
                  removed: [],
                  extraDeck: [],
                  attacksMade: {},
                  negatedInstances: []
                },
                {
                  id: 'p2',
                  name: data.p2_name || 'Player 2',
                  email: data.player2_email,
                  lp: 2000,
                  deck: p2Deck,
                  hand: p2Hand,
                  monsterZones: Array(3).fill(null),
                  spellZones: Array(3).fill(null),
                  cardPositions: {},
                  cardVisibilities: {},
                  gy: [],
                  removed: [],
                  extraDeck: [],
                  attacksMade: {},
                  negatedInstances: []
                }
              ]
            };
            await updateServerGame(initialGame);
            setGame(initialGame);
          }
        }
      } catch (e) {
        console.error("Sync loop error:", e);
      }
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

  // Pre-calculate valid cards to chain during priority window
  const activatablePriorityInstances = useMemo(() => {
    if (!game?.chainPriority || game.chainPriority.playerIndex !== myIndex || !me) return [];
    const validInstances: { instanceId: string; effectId: string; location: 'HAND' | 'FIELD' | 'GY' }[] = [];
    
    const checkCard = (instanceId: string, location: 'HAND' | 'FIELD' | 'GY') => {
       // Skip cards already in the pending chain (prevent duplicate activation)
       if (game?.pendingChain?.some(link => link.instanceId === instanceId)) return;
       // Skip cards that are negated
       if (me.negatedInstances?.includes(instanceId)) return;
       const def = getCardDefByInstance(instanceId);
       if (!def) return;
       const registryEffects = CardRegistry.getEffects(def.id);
       const engineDef = engineRef.current?.getCardDef(def.id);
       const fallbackEffects = Array.isArray(engineDef?.effects) ? engineDef.effects : [];
       const activeEffects = registryEffects && registryEffects.length > 0 ? registryEffects : fallbackEffects;
       
       for (const eff of activeEffects) {
          if (eff?.trigger?.type === TriggerType.ANY_TIME || eff?.trigger?.type === TriggerType.ON_ACTIVATION) {
             const locs = eff?.restriction?.locations || [];
             if (locs.length > 0) {
                 const currentLocEnum = location === 'HAND' ? CardLocation.HAND :
                                        location === 'FIELD' ? (def.type === 'MONSTER' ? CardLocation.MONSTER_ZONE : CardLocation.SPELL_ZONE) :
                                        CardLocation.GY;
                 if (!locs.includes(currentLocEnum as any)) continue;
             }
             
             // Spells cannot be activated from hand on opponent's turn.
             if (location === 'HAND' && def.type === 'SPELL') {
                 if (!isMyTurn) continue;
             }
             validInstances.push({ instanceId, effectId: eff.id, location });
             break; // one effect is enough to show the card
          }
       }
    };

    me.hand?.forEach(id => id && checkCard(id, 'HAND'));
    me.monsterZones?.forEach(id => id && checkCard(id, 'FIELD'));
    me.spellZones?.forEach(id => id && checkCard(id, 'FIELD'));
    me.gy?.forEach(id => id && checkCard(id, 'GY'));

    return validInstances;
  }, [game?.chainPriority, myIndex, me, getCardDefByInstance, isMyTurn]);

  // Ref to track last pass count so we don't clear selection on every poll
  const lastPriorityStateRef = useRef<{ playerIndex: number; passCount: number; chainLength: number } | null>(null);

  // Auto-pass priority if no activatable effects
  useEffect(() => {
    if (game?.chainPriority && !game.chainPriority.isResolving && game.chainPriority.playerIndex === myIndex) {
      const currentPriorityState = {
        playerIndex: game.chainPriority.playerIndex,
        passCount: game.chainPriority.passCount,
        chainLength: game.pendingChain?.length || 0
      };

      const lastState = lastPriorityStateRef.current;
      const isNewPriorityWindow = !lastState || 
        lastState.playerIndex !== currentPriorityState.playerIndex || 
        lastState.passCount !== currentPriorityState.passCount ||
        lastState.chainLength !== currentPriorityState.chainLength;

      if (isNewPriorityWindow) {
        // Clear any previous selection when priority window opens/updates
        setSelectedPriorityItem(null);
        lastPriorityStateRef.current = currentPriorityState;
      }

      if (activatablePriorityInstances.length === 0) {
        const timer = setTimeout(() => {
          passPriority();
        }, 1200); // 1.2s delay to show what opponent activated
        return () => clearTimeout(timer);
      }
    } else {
      setSelectedPriorityItem(null);
      lastPriorityStateRef.current = null;
    }
  }, [game?.chainPriority, game?.pendingChain?.length, myIndex, activatablePriorityInstances.length]);

  // Step-by-Step Chain Resolution Engine
  useEffect(() => {
    if (!game?.chainPriority?.isResolving || !engineRef.current) return;
    
    // Check if it's our turn to resolve a link
    if (game.chainPriority.playerIndex === myIndex) {
      const resolveCurrentLink = async () => {
        // If there are no links, just close the chain
        if (!game.pendingChain || game.pendingChain.length === 0) {
          const nextGame = await engineRef.current!.resolveNextLink(game);
          updateServerGame(nextGame);
          return;
        }

        const currentLinkIdx = game.pendingChain.length - 1;
        const currentLink = game.pendingChain[currentLinkIdx];
        const def = getCardDefByInstance(currentLink.instanceId);
        
        // Show the OVERVIEW animation first if this is the very first link we are resolving
        // (We know it's the first if the chain length is the max it's been, but for simplicity
        // let's just show the resolving badge per-link).
        
        // Setup the animation state for this specific link
        setChainResolutionAnim({
          links: [{
            instanceId: currentLink.instanceId,
            cardName: def?.name || 'Card',
            chainNumber: currentLinkIdx + 1,
            playerName: game.players[currentLink.controllerIndex]?.name || 'Player',
            effectName: 'Effect' // Could extract from engine if needed
          }],
          currentIndex: 0,
          phase: 'RESOLVING'
        });

        // Wait for animation
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Clear animation
        setChainResolutionAnim(null);

        // Execute the link logic (this will trigger requestSelection if needed)
        const nextGame = await engineRef.current!.resolveNextLink(
          game,
          (options, count, message) => {
            return new Promise<string[]>((resolve) => {
              setEngineSelectionPrompt({ options, count, message, resolve });
              setSelectedEngineOptions([]);
            });
          }
        );
        
        // Send state to server (this might pass resolving control to opponent)
        updateServerGame(nextGame);
      };

      resolveCurrentLink();
    }
  }, [game?.chainPriority?.isResolving, game?.chainPriority?.playerIndex, game?.pendingChain?.length, myIndex]);

  // RESUME PENDING ATTACK AFTER CHAIN
  useEffect(() => {
    if (!game) return;
    
    // Check if chain window is fully closed and we have a pending attack
    if (!game.chainPriority && (!game.pendingChain || game.pendingChain.length === 0) && game.pendingAttack) {
       // Only the attacking player resumes the attack to prevent duplicate updates
       if (myIndex === game.activePlayerIndex) {
         const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
         const attack = nextGame.pendingAttack!;
         nextGame.pendingAttack = undefined; // clear immediately
         
         // Wait slightly for chain animations to finish before resolving combat
         setTimeout(() => {
            finalizeAttack(attack.attackerId, attack.targetId, nextGame);
         }, 800);
       }
    }
  }, [game?.chainPriority, game?.pendingChain?.length, game?.pendingAttack, myIndex, game?.activePlayerIndex]);
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
        // Skip Battle Phase on the very first turn, or if Dream Summon was used this turn
        // Turn 1 skip Battle phase
        if (nextGame.turn === 1 || nextGame.players[nextGame.activePlayerIndex].dreamSummonUsedThisTurn) {
          next = GamePhase.END;
        } else {
          next = GamePhase.BATTLE;
        }
        break;
      case GamePhase.BATTLE: next = GamePhase.END; break;
      case GamePhase.END: 
        // Send Dream Summoned monster to GY if it still exists
        const currentPlayer = nextGame.players[nextGame.activePlayerIndex];
        if (currentPlayer.dreamSummonedInstanceId) {
           const did = currentPlayer.dreamSummonedInstanceId;
           const mzIdx = currentPlayer.monsterZones.indexOf(did);
           if (mzIdx !== -1) {
              currentPlayer.monsterZones[mzIdx] = null;
              currentPlayer.gy.push(did);
              pushLog(nextGame, `Dream Summoned monster was sent to GY.`, 'system');
           }
        }
        // Reset player flags
        nextGame.players.forEach(player => {
          player.dreamSummonUsedThisTurn = false;
          player.dreamSummonedInstanceId = null;
          player.salvationUsedThisTurn = false;
        });

        next = GamePhase.DREAM;
        nextGame.activePlayerIndex = nextGame.activePlayerIndex === 0 ? 1 : 0;
        nextGame.turn++; // Increment turn on every player change
        // Reset attacks and engine turn-frequency tracking
        nextGame.players[nextGame.activePlayerIndex].attacksMade = {};
        resetTurnTracking();
        break;
      default: next = GamePhase.DREAM;
    }

    nextGame.phase = next;
    
    if (next === GamePhase.DRAW) {
      const p = nextGame.players[nextGame.activePlayerIndex];
      // Skip drawing on Turn 1
      if (nextGame.turn === 1) {
        nextGame.phase = GamePhase.MAIN;
      } else {
        if (p.deck.length > 0) {
          const drawnId = p.deck.pop()!;
          p.hand.push(drawnId);
          pushLog(nextGame, `${p.name} drew a card.`, 'system');
          nextGame.phase = GamePhase.MAIN;
        } else {
          // Deck Out!
          nextGame.winnerEmail = nextGame.players[nextGame.activePlayerIndex === 0 ? 1 : 0].email;
          pushLog(nextGame, `${p.name} has no cards left in deck! DECK OUT!`, 'combat');
        }
      }
    }

    pushLog(nextGame, `Phase: ${next}`, 'system');

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

  const placeCard = async (zoneType: 'MONSTER' | 'SPELL', slotIndex: number, tributeIds: string[] = [], isNegated: boolean = false) => {
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
    const isMonster = getCardDefByInstance(summoningMode.instanceId)?.type === 'MONSTER';
    p.cardPositions[summoningMode.instanceId] = (summoningMode.type === 'SET' && isMonster) ? "DEFENSE" : "ATTACK";
    p.cardVisibilities[summoningMode.instanceId] = summoningMode.type === 'SET' ? "FACE_DOWN" : "FACE_UP";

    if (isNegated) {
      p.negatedInstances = p.negatedInstances || [];
      p.negatedInstances.push(summoningMode.instanceId);
    }
    
    if (summoningMode.isDreamSummon) {
      p.dreamSummonUsedThisTurn = true;
      p.dreamSummonedInstanceId = summoningMode.instanceId;
    }

    const cardDef = getCardDefByInstance(summoningMode.instanceId);
    const discardedNames = tributeIds.map(tid => getCardDefByInstance(tid)?.name).filter(Boolean).join(", ");
    const tributeText = tributeIds.length > 0 ? ` (Discarded: ${discardedNames})` : (isNegated ? ' (Free: Attribute Match)' : '');
    
    const actionMsg = `${p.name} ${summoningMode.type === 'SUMMON' ? 'Summoned' : (summoningMode.type === 'ACTIVATE' ? 'Activated' : 'Set')} ${cardDef?.name}${tributeText}${isNegated ? ' [NEGATED]' : ''}`;
    
    // Emit Engine Events (Activation/Summon)
    if (engineRef.current && (summoningMode.type === 'SUMMON' || summoningMode.type === 'ACTIVATE')) {
      const trigger = summoningMode.type === 'ACTIVATE' ? TriggerType.ON_ACTIVATION : TriggerType.ON_SUMMON;
      const instanceId = summoningMode.instanceId;
      const cardDef = getCardDefByInstance(instanceId);
      
      // Visual feedback
      // setResolvingCardId(instanceId); // TEMPORARILY DISABLED
      
      // We do the logic and then clear the animation
      (async () => {
        try {
          const finalGame = await engineRef.current.emit(
            trigger,
            { instanceId, controllerIndex: myIndex, cardName: cardDef?.name },
            nextGame,
            () => {}, // Simplified
            'hand',
            (options, count, message) => {
              return new Promise<string[]>((resolve) => {
                setEngineSelectionPrompt({ options, count, message, resolve });
                setSelectedEngineOptions([]);
              });
            }
          );
          
          setGame(finalGame);
          updateServerGame(finalGame);
        } catch (err) {
          console.error("Logic Error:", err);
        } finally {
          // Keep the animation for a bit for the user to see, but logic is done
          setTimeout(() => setResolvingCardId(null), 1200);
        }
      })();

    } else {
      setGame(nextGame);
      updateServerGame(nextGame);
    }

    setSummoningMode(null);
    setTributeModal(null);
    setSelectedTributes([]);
    setIsCostConfirmed(false);
  };

  const finalizeAttack = async (attackerId: string, targetId: string | 'DIRECT', gameToMutate: SyncedGameState) => {
    const attackerDef = getCardDefByInstance(attackerId);
    if (!attackerDef) return;

    const myState = gameToMutate.players[myIndex];
    const oppState = gameToMutate.players[oppIndex];

    let damage = 0;
    let result: 'DESTROYED' | 'SURVIVED' | 'DIRECT' = 'DIRECT';
    let flippedTarget = false;

    // Verify attacker is still on the field
    const isAttackerAlive = myState.monsterZones.includes(attackerId);
    if (!isAttackerAlive) {
      // Attacker was removed from the field during a chain
      pushLog(gameToMutate, `Attack by ${attackerDef.name} aborted (monster no longer on field).`, 'system');
      setGame(gameToMutate);
      updateServerGame(gameToMutate);
      return;
    }

    if (targetId === 'DIRECT') {
      damage = attackerDef?.atk || 0;
      oppState.lp = Math.max(0, oppState.lp - damage);
      result = 'DIRECT';
    } else {
      const targetDef = getCardDefByInstance(targetId);
      const targetPos = oppState.cardPositions[targetId] || 'ATTACK';
      
      // Verify target is still on field
      if (!oppState.monsterZones.includes(targetId)) {
         pushLog(gameToMutate, `Attack aborted (target no longer on field).`, 'system');
         setGame(gameToMutate);
         updateServerGame(gameToMutate);
         return;
      }

      // REVEAL IF FACE DOWN
      if (oppState.cardVisibilities[targetId] === 'FACE_DOWN') {
        oppState.cardVisibilities[targetId] = 'FACE_UP';
        pushLog(gameToMutate, `Set monster revealed: ${targetDef?.name}`, 'system');
        flippedTarget = true;
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

    // LOG ATTACK
    const targetName = targetId === 'DIRECT' ? 'Direct Attack' : getCardDefByInstance(targetId)?.name;
    pushLog(gameToMutate, `${attackerDef.name} attacks ${targetName}!`, 'combat');
    if (damage > 0) {
      pushLog(gameToMutate, `${damage} damage dealt!`, 'combat');
    }

    myState.attacksMade[attackerId] = (myState.attacksMade[attackerId] || 0) + 1;
    setBattleAnim({ attackerId, targetId, damage, result });
    
    // Emit ON_ATTACK and ON_FLIP
    if (engineRef.current) {
      let stateAfterAttack = await engineRef.current.emit(
        TriggerType.ON_ATTACK,
        { attackerId, targetId, damage, result, controllerIndex: myIndex },
        gameToMutate,
        () => {}
      );
      
      if (flippedTarget) {
         stateAfterAttack = await engineRef.current.emit(
           TriggerType.ON_FLIP,
           { instanceId: targetId, controllerIndex: oppIndex },
           stateAfterAttack,
           () => {}
         );
      }
      
      updateServerGame(stateAfterAttack);
      setGame(stateAfterAttack);
    } else {
      updateServerGame(gameToMutate);
      setGame(gameToMutate);
    }

    // DELAY VICTORY/DEFEAT SCREEN TO ALLOW ANIMATION TO PLAY
    setTimeout(() => {
      setBattleAnim(null);
      if (oppState.lp <= 0) {
        setDuelResult('VICTORY');
        const winGame = JSON.parse(JSON.stringify(gameToMutate)) as SyncedGameState;
        winGame.winnerEmail = me?.email;
        updateServerGame(winGame);
      } else if (myState.lp <= 0) {
        setDuelResult('DEFEAT');
        const loseGame = JSON.parse(JSON.stringify(gameToMutate)) as SyncedGameState;
        loseGame.winnerEmail = opponent?.email;
        updateServerGame(loseGame);
      }
    }, 2000);
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

    if (targetId === 'DIRECT') {
      nextGame.directAttackPrompt = attackerId;
      nextGame.pendingAttack = { attackerId, targetId: 'DIRECT' };
      setGame(nextGame);
      updateServerGame(nextGame);
      setAttackingInstanceId(null);
      return;
    } else {
      await finalizeAttack(attackerId, targetId, nextGame);
    }
  };

  const respondToDirectAttack = async (action: 'SALVATION' | 'EFFECT' | 'DAMAGE') => {
    if (!game || !game.directAttackPrompt) return;
    const attackerId = game.directAttackPrompt;
    const nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const myState = nextGame.players[myIndex]; // defender
    const oppState = nextGame.players[oppIndex]; // attacker
    const attackerDef = getCardDefByInstance(attackerId);

    nextGame.directAttackPrompt = undefined;

    if (action === 'SALVATION' && myState.deck.length > 0 && !myState.salvationUsedThisTurn) {
      myState.salvationUsedThisTurn = true;
      const drawnId = myState.deck.pop()!;
      myState.hand.push(drawnId);
      const drawnDef = getCardDefByInstance(drawnId);

      if (drawnDef?.type === 'MONSTER') {
        myState.hand.pop();
        myState.gy.push(drawnId);
        pushLog(nextGame, `SALVATION SUCCESS! ${myState.name} drew ${drawnDef.name} (Monster) and blocked the direct attack!`, 'combat');
        
        oppState.attacksMade[attackerId] = (oppState.attacksMade[attackerId] || 0) + 1;
        nextGame.pendingAttack = undefined;
        
        setGame(nextGame);
        updateServerGame(nextGame);
        return;
      } else {
        myState.hand.pop();
        myState.gy.push(drawnId);
        pushLog(nextGame, `SALVATION FAILED! ${myState.name} drew ${drawnDef?.name} (Spell). The attack goes through!`, 'combat');
        
        // Attack goes through!
        nextGame.pendingAttack = undefined;
        await finalizeAttack(attackerId, 'DIRECT', nextGame);
        return;
      }
    } else if (action === 'EFFECT') {
      // Enter chain priority mode!
      nextGame.chainPriority = { playerIndex: myIndex, passCount: 0 };
      setGame(nextGame);
      updateServerGame(nextGame);
      return;
    } else if (action === 'DAMAGE') {
      // Just take the damage
      nextGame.pendingAttack = undefined;
      await finalizeAttack(attackerId, 'DIRECT', nextGame);
      return;
    }
  };

  const passPriority = async () => {
    if (!game || !game.chainPriority || game.chainPriority.playerIndex !== myIndex) return;
    if (!engineRef.current) return;

    // Call the engine to pass priority (it will enter isResolving state if both passed)
    const nextGame = await engineRef.current.passPriority(
      game,
      (options, count, message) => {
        return new Promise<string[]>((resolve) => {
          setEngineSelectionPrompt({ options, count, message, resolve });
          setSelectedEngineOptions([]);
        });
      }
    );
    
    // Clear selection UI
    setSelectedPriorityItem(null);
    setInspectedInstanceId(null);
    
    setGame(nextGame);
    updateServerGame(nextGame);
  };

  const handleAutoActivate = async (instanceId: string, effectId: string) => {
    if (!game || !me || !engineRef.current) return;
    let nextGame = JSON.parse(JSON.stringify(game)) as SyncedGameState;
    const pState = nextGame.players[myIndex];
    
    const isInHand = pState.hand.includes(instanceId);
    const def = getCardDefByInstance(instanceId);
    
    // If it's a Spell activated from hand, auto-place in the first available spell zone
    if (isInHand && def?.type === 'SPELL') {
      const emptyZoneIdx = pState.spellZones.findIndex(z => z === null);
      if (emptyZoneIdx === -1) {
        addSyncedLog("No empty spell zones!", "system");
        return; 
      }
      pState.hand = pState.hand.filter(id => id !== instanceId);
      pState.spellZones[emptyZoneIdx] = instanceId;
      pState.cardVisibilities[instanceId] = 'FACE_UP';
    }

    // Calculate chain number BEFORE adding to chain
    const chainNumber = (nextGame.pendingChain?.length || 0) + 1;

    // Show chain build animation
    setChainBuildAnim({
      instanceId,
      chainNumber,
      cardName: def?.name || 'Card',
      playerName: me.name
    });

    // Clear priority selection
    setSelectedPriorityItem(null);
    
    nextGame = await engineRef.current.activateManualEffect(instanceId, effectId, nextGame);
    updateServerGame(nextGame);
    
    // Auto-dismiss chain build animation after 1.5s
    setTimeout(() => setChainBuildAnim(null), 1500);
    setInspectedInstanceId(null);
    setSummoningMode(null);
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
    const smDef = summoningMode?.instanceId ? getCardDefByInstance(summoningMode.instanceId) : null;
    const isSummonable = isPlayer && !isSpectator && summoningMode && tributesPaid && smDef && smDef.type === type && (
      (summoningMode.type === 'SUMMON' && type === 'MONSTER') ||
      (summoningMode.type === 'SET' && type === 'MONSTER') ||
      (summoningMode.type === 'ACTIVATE' && type === 'SPELL') ||
      (summoningMode.type === 'SET' && type === 'SPELL')
    ) && !instanceId;

    const targetPlayer = isPlayer ? me : opponent;
    const position = targetPlayer.cardPositions ? (targetPlayer.cardPositions[instanceId!] || "ATTACK") : "ATTACK";
    const visibility = targetPlayer.cardVisibilities ? (targetPlayer.cardVisibilities[instanceId!] || "FACE_UP") : "FACE_UP";
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

            {/* Chain Link Badge (Top-Left) — shows CL-X when card is in pending chain */}
            {instanceId && game?.pendingChain?.some(link => link.instanceId === instanceId) && (() => {
              const chainIdx = game.pendingChain!.findIndex(link => link.instanceId === instanceId);
              return (
                <div className="absolute top-1 left-1 z-40 pointer-events-none">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 border-2 border-indigo-400 flex items-center justify-center shadow-[0_0_15px_rgba(99,102,241,0.6)] animate-pulse">
                    <span className="text-[10px] font-black text-white leading-none tabular-nums">{chainIdx + 1}</span>
                  </div>
                </div>
              );
            })()}

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

            {/* Action Buttons Container (Attack & Activate) */}
            <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-2 z-[60]">
              {/* Attack Button */}
              {(() => {
                const isNormalAttack = game.phase === GamePhase.BATTLE;
                const isDreamAttack = game.phase === GamePhase.DREAM && instanceId === me.dreamSummonedInstanceId;
                const canShowAttackButton = instanceId && isPlayer && (isNormalAttack || isDreamAttack) && game.activePlayerIndex === myIndex && !attackingInstanceId && (me.attacksMade ? (me.attacksMade[instanceId] || 0) : 0) < 1 && visibility === 'FACE_UP';
                
                if (!canShowAttackButton) return null;

                return (
                  <button 
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      if (isDreamAttack) {
                        setAttackingInstanceId(instanceId);
                        setIsDirectAttackPrompt(true);
                      } else {
                        const hasOpponentMonsters = opponent.monsterZones.some(id => id !== null);
                        if (!hasOpponentMonsters) {
                          setAttackingInstanceId(instanceId);
                          setIsDirectAttackPrompt(true);
                        } else {
                          setAttackingInstanceId(instanceId);
                        }
                      }
                    }}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.4)] transition-all flex items-center gap-2 group animate-bounce"
                  >
                    <Sword className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                    <span className="tracking-tighter uppercase italic">Attack</span>
                  </button>
                );
              })()}

              {/* Field Activate Button */}
              {(() => {
                if (!instanceId || !isPlayer || instanceId !== inspectedInstanceId) return null;

                const registryEffects = CardRegistry.getEffects(cardDef?.id || "");
                const engineCardDef = cardDef ? engineRef.current?.getCardDef(cardDef.id) : null;
                const fallbackEffects = Array.isArray(engineCardDef?.effects) ? engineCardDef.effects : [];
                const activeEffects = registryEffects.length > 0 ? registryEffects : fallbackEffects;
                
                const isPriorityWindow = game?.chainPriority && !game?.chainPriority?.isResolving && game.chainPriority.playerIndex === myIndex;
                const isResolving = game?.chainPriority?.isResolving;
                if (isResolving) return null; // No manual activations during resolution!
                
                const isMyTurn = game.activePlayerIndex === myIndex;

                const activatableEffect = activeEffects.find(eff => {
                   if (eff.canActivate && !eff.canActivate(game, myIndex)) return false;
                   
                   // New restriction: Set Spells cannot be activated until the opponent's turn.
                   if (visibility === 'FACE_DOWN' && type === 'SPELL' && game.players[myIndex].cardVisibilities[instanceId] === 'FACE_DOWN') {
                     // Can only be activated if it's NOT the turn it was set.
                     // The simplest approximation is to block activation on my turn if it is face down.
                     // Wait, if it was set on my turn, it's face down. 
                     // We need a proper way to track if it was set this turn, but for now:
                     // We'll add a property `turnSet` or just assume they can't activate face-down spells on their own turn.
                     if (isMyTurn) return false;
                   }

                   if (isPriorityWindow) {
                      return eff?.trigger?.type === TriggerType.ANY_TIME || eff?.trigger?.type === TriggerType.ON_ACTIVATION;
                   } else if (isMyTurn) {
                      return eff?.trigger?.type === TriggerType.ANY_TIME || 
                             eff?.trigger?.type === TriggerType.IGNITION ||
                             eff?.trigger?.type === TriggerType.ON_ACTIVATION;
                   } else {
                      return eff?.trigger?.type === TriggerType.ANY_TIME;
                   }
                });

                if (activatableEffect) {
                   return (
                     <button 
                       onClick={async (e) => { 
                         e.stopPropagation(); 
                         if (engineRef.current && game) {
                            const newGame = await engineRef.current.activateManualEffect(instanceId, activatableEffect.id, game);
                            updateServerGame(newGame);
                            setInspectedInstanceId(null);
                         }
                       }}
                       className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-[0_10px_20px_rgba(79,70,229,0.4)] transition-all flex items-center gap-2 group animate-bounce"
                     >
                       <Flame className="w-4 h-4" />
                       <span className="tracking-tighter uppercase italic">Activate</span>
                     </button>
                   );
                }
                return null;
              })()}
            </div>

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

  if (!game || !me || !opponent) {
    return (
      <div className="fixed inset-0 bg-slate-950 flex items-center justify-center z-[1000]">
         <div className="flex flex-col items-center gap-6">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
            <h2 className="text-xl font-black italic tracking-[0.3em] text-white animate-pulse uppercase">Syncing Duel Matrix...</h2>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest text-center px-10">
              Room: {roomId} | Game: {!!game ? "READY" : "WAITING"}
            </p>
            <p className="text-indigo-500/50 text-[9px] font-mono text-center">
              P1: {room?.p1_name || "???"} ({room?.player1_email === userEmail ? "YOU" : "GUEST"})<br/>
              P2: {room?.p2_name || "???"} ({room?.player2_email === userEmail ? "YOU" : "GUEST"})<br/>
              Status: {room?.status || "FETCHING..."} | Me: {myIndex}<br/>
              API: {API_BASE}
            </p>
            <button 
              onClick={onExit}
              className="mt-8 px-6 py-2 bg-slate-800 text-slate-400 rounded-full text-[8px] font-black uppercase tracking-widest hover:text-white transition-colors"
            >
              Force Exit (Connection Lost)
            </button>
         </div>
      </div>
    );
  }

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
          <motion.div
             key={opponent.lp}
             initial={{ scale: 1.5, color: '#f87171' }}
             animate={{ scale: 1, color: '#ffffff' }}
             transition={{ duration: 0.5 }}
           >
             <span className="text-3xl font-black text-white font-mono tracking-tighter">{opponent.lp}</span>
           </motion.div>
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
           <motion.div
             key={me.lp}
             initial={{ scale: 1.5, color: '#4ade80' }}
             animate={{ scale: 1, color: '#ffffff' }}
             transition={{ duration: 0.5 }}
           >
             <span className="text-3xl font-black text-white font-mono tracking-tighter">{me.lp}</span>
           </motion.div>
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
                     {isSelected && !summoningMode && (()=>{
                       const level=def?.level||0;
                       const tributesNeeded=getTributesRequired(level);
                       const handSize = me.hand.length;
                       const canAffordTribute = (handSize - 1) >= tributesNeeded;
                       const normalSummonForbidden=isNormalSummonForbidden(def);
                       const attrMatch = hasAttributeMatch(def);
                       
                       const isMyMainPhase = isMyTurn && game.phase === GamePhase.MAIN;
                       const isMyDreamPhase = isMyTurn && game.phase === GamePhase.DREAM;
                       const hasDreamSummoned = me.dreamSummonUsedThisTurn;
                       
                       const registryEffects = CardRegistry.getEffects(def?.id || "");
                       const engineDef = engineRef.current?.getCardDef(def?.id || "");
                       const fallbackEffects = Array.isArray(engineDef?.effects) ? engineDef.effects : [];
                       const activeEffects = registryEffects && registryEffects.length > 0 ? registryEffects : fallbackEffects;
                       const hasHandEffect = activeEffects.some(eff => {
                           if (eff.canActivate && !eff.canActivate(game, myIndex)) return false;
                           const locs = eff?.restriction?.locations || [];
                           return locs.length === 0 || locs.includes("HAND" as any);
                       });
                       
                       const canSummonOrSet = isMyMainPhase && !hasDreamSummoned;
                       const canActivateSpell = def?.type === 'SPELL' && isMyMainPhase && (!activeEffects.length || activeEffects.some(eff => !eff.canActivate || eff.canActivate(game, myIndex)));
                       const canActivateMonsterEffect = def?.type === 'MONSTER' && isMyMainPhase && hasHandEffect;
                       const canDreamSummon = isMyDreamPhase && def?.type === 'MONSTER' && !hasDreamSummoned;
                       
                       if (!canSummonOrSet && !canActivateSpell && !canActivateMonsterEffect && !canDreamSummon) return null;
                       if (game?.chainPriority?.isResolving) return null; // No manual actions during resolution!

                       return(
                       <motion.div initial={{opacity:0,y:10,scale:0.8}} animate={{opacity:1,y:-40,scale:1}} exit={{opacity:0,y:10,scale:0.8}} className="absolute -top-12 left-1/2 -translate-x-1/2 flex gap-3 z-[100]">
                         {def?.type==='MONSTER' && (
                           <>
                             {canSummonOrSet && !normalSummonForbidden && (<button onClick={(e)=>{e.stopPropagation();if(!canAffordTribute)return;if(tributesNeeded===0){setSummoningMode({type:'SUMMON',instanceId,isNegated:false});}else{setSummoningMode({type:'SUMMON',instanceId,isNegated:false});setTributeModal({instanceId,required:tributesNeeded});setSelectedTributes([]);setSelectedHandInstanceId(null);}}} disabled={!canAffordTribute} className={`flex flex-col items-center gap-1 group/btn ${!canAffordTribute?'opacity-40 cursor-not-allowed':''}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${canAffordTribute?'bg-indigo-600 group-hover/btn:bg-indigo-500':'bg-slate-700'}`}><Zap className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">{tributesNeeded>0?`Cost (${tributesNeeded})`:'Summon'}</span></button>)}
                             
                             {canSummonOrSet && attrMatch && !normalSummonForbidden && (
                               <button onClick={(e)=>{e.stopPropagation();setSummoningMode({type:'SUMMON',instanceId,isNegated:true});setSelectedHandInstanceId(null);}} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-amber-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-amber-500 transition-colors shadow-amber-500/20 animate-pulse"><Sparkles className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">Free Match</span></button>
                             )}
                             
                             {canSummonOrSet && (
                               <button onClick={(e)=>{e.stopPropagation();if(!canAffordTribute)return;if(tributesNeeded===0){setSummoningMode({type:'SET',instanceId});}else{setSummoningMode({type:'SET',instanceId});setTributeModal({instanceId,required:tributesNeeded});setSelectedTributes([]);setSelectedHandInstanceId(null);}}} disabled={!canAffordTribute} className={`flex flex-col items-center gap-1 group/btn ${!canAffordTribute?'opacity-40 cursor-not-allowed':''}`}><div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-colors ${canAffordTribute?'bg-slate-700 group-hover/btn:bg-slate-600':'bg-slate-800'}`}><Shield className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Set</span></button>
                             )}

                             {canActivateMonsterEffect && (
                               <button onClick={(e)=>{e.stopPropagation();
                                  const eff = activeEffects.find(eff => {
                                      if (eff.canActivate && !eff.canActivate(game, myIndex)) return false;
                                      return eff.trigger?.type === TriggerType.IGNITION || eff.trigger?.type === TriggerType.ANY_TIME || eff.trigger?.type === TriggerType.ON_ACTIVATION;
                                  });
                                  if (eff) handleAutoActivate(instanceId, eff.id);
                               }} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-emerald-500 transition-colors"><Flame className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Activate</span></button>
                             )}
                             
                             {canDreamSummon && (
                               <button onClick={(e)=>{e.stopPropagation();setSummoningMode({type:'SUMMON',instanceId,isNegated:true,isDreamSummon:true});setSelectedHandInstanceId(null);}} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-fuchsia-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-fuchsia-500 transition-colors shadow-fuchsia-500/20 animate-pulse"><CloudRain className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded whitespace-nowrap">Dream Summon</span></button>
                             )}
                           </>
                         )}

                         {def?.type!=='MONSTER' && (
                           <>
                             {canSummonOrSet && (
                               <button onClick={(e)=>{e.stopPropagation();setSummoningMode({type:'SET',instanceId});setSelectedHandInstanceId(null);}} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-slate-600 transition-colors"><Shield className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Set</span></button>
                             )}
                             
                             {(canActivateSpell || hasHandEffect) && (
                               <button onClick={(e)=>{e.stopPropagation();
                                  const eff = activeEffects.find(eff => {
                                      if (eff.canActivate && !eff.canActivate(game, myIndex)) return false;
                                      return eff.trigger?.type === TriggerType.IGNITION || eff.trigger?.type === TriggerType.ANY_TIME || eff.trigger?.type === TriggerType.ON_ACTIVATION;
                                  });
                                  if (eff) handleAutoActivate(instanceId, eff.id);
                               }} className="flex flex-col items-center gap-1 group/btn"><div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center shadow-lg group-hover/btn:bg-emerald-500 transition-colors"><Flame className="w-6 h-6 text-white"/></div><span className="text-[8px] font-black text-white uppercase tracking-widest bg-slate-950 px-2 py-0.5 rounded">Activate</span></button>
                             )}
                           </>
                         )}
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
          <motion.div initial={{ x: -450, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -450, opacity: 0 }} className="absolute top-1/2 -translate-y-1/2 left-6 z-[950] pointer-events-none">
            <div className="w-[380px] flex flex-col gap-4 pointer-events-auto relative">
              <div className="relative">
                <Card card={inspectedCard} className="w-full shadow-2xl cursor-pointer hover:scale-[1.02] transition-transform" onClick={() => setIsCardPopupOpen(true)} />
                <button onClick={() => setIsInspectorPanelOpen(false)} className="absolute -top-3 -right-3 p-2 bg-slate-800 rounded-full text-slate-500 hover:text-white border border-slate-700 shadow-lg"><X className="w-4 h-4" /></button>
              </div>
              
              {/* Manual Effect Activation Button (Removed: Moved to Field Popover) */}
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/80 backdrop-blur-md">
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
                        await fetch(`${API_BASE}/rooms/leave`, {
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
                         await fetch(`${API_BASE}/rooms/leave`, {
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

      {/* ENGINE SELECTION OVERLAY */}
      <AnimatePresence>
        {engineSelectionPrompt && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={isSelectionMinimized 
              ? "fixed bottom-8 right-8 w-16 h-16 rounded-full cursor-pointer z-[900] pointer-events-auto" 
              : "fixed inset-0 z-[900] flex font-sans select-none pointer-events-none"
            }
            onClick={() => isSelectionMinimized && setIsSelectionMinimized(false)}
          >
            {isSelectionMinimized ? (
              <div className="w-full h-full bg-cyan-600 rounded-full flex items-center justify-center shadow-lg shadow-cyan-500/50 hover:bg-cyan-500 transition-colors pointer-events-auto">
                <Search className="w-8 h-8 text-white" />
                <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {selectedEngineOptions.length}
                </span>
              </div>
            ) : (
              <>
                <div className="w-[440px] h-full shrink-0 pointer-events-none hidden md:block" />
                
                <div className="flex-1 h-full bg-slate-950/90 backdrop-blur-sm flex flex-col pointer-events-auto relative border-l border-slate-700/50 shadow-2xl overflow-hidden">
                  <div className="absolute top-0 left-0 w-full p-8 text-center bg-gradient-to-b from-slate-900 to-transparent z-10 pointer-events-none">
                     <h2 className="text-3xl font-black text-white uppercase tracking-tighter drop-shadow-lg mb-2">Engine Prompt</h2>
                     <p className="text-slate-300 uppercase tracking-widest text-sm font-bold flex items-center justify-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                        {engineSelectionPrompt.message}
                     </p>
                     <div className="mt-4 text-[10px] font-black text-cyan-400 uppercase tracking-widest">
                        Selected: {selectedEngineOptions.length} / {engineSelectionPrompt.count}
                     </div>
                  </div>

                  <div className="flex-1 flex flex-wrap items-center justify-center gap-4 p-12 mt-20 content-start custom-scrollbar overflow-y-auto">
               {engineSelectionPrompt.options.map((instanceId, i) => {
                 const def = getCardDefByInstance(instanceId);
                 if (!def) return null;
                 const isSelected = selectedEngineOptions.includes(instanceId);
                 return (
                   <motion.div 
                     key={instanceId}
                     initial={{ opacity: 0, y: 20 }}
                     animate={{ opacity: 1, y: 0 }}
                     transition={{ delay: i * 0.05 }}
                     onClick={() => {
                        setInspectedInstanceId(instanceId);
                        setIsInspectorPanelOpen(true);
                        if (isSelected) {
                          setSelectedEngineOptions(prev => prev.filter(id => id !== instanceId));
                        } else if (selectedEngineOptions.length < engineSelectionPrompt.count) {
                          setSelectedEngineOptions(prev => [...prev, instanceId]);
                        }
                     }}
                     className={`cursor-pointer transition-all duration-200 w-[150px] aspect-[63/88] rounded-xl overflow-hidden border-2
                       ${isSelected ? 'border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] scale-105 z-10' : 'border-slate-700/50 hover:border-slate-500 opacity-80 hover:opacity-100'}
                     `}
                   >
                     <Card card={def} isMiniature className="w-full h-full" />
                   </motion.div>
                 );
               })}
            </div>

            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex items-center gap-4">
               <button 
                 onClick={() => {
                   if (selectedEngineOptions.length === engineSelectionPrompt.count) {
                     engineSelectionPrompt.resolve(selectedEngineOptions);
                     setEngineSelectionPrompt(null);
                     setSelectedEngineOptions([]);
                   }
                 }}
                 disabled={selectedEngineOptions.length !== engineSelectionPrompt.count}
                 className={`px-12 py-4 rounded-full font-black uppercase tracking-widest transition-all
                   ${selectedEngineOptions.length === engineSelectionPrompt.count 
                     ? 'bg-cyan-500 hover:bg-cyan-400 text-white shadow-[0_0_40px_rgba(34,211,238,0.4)] scale-110' 
                     : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
               >
                 Confirm Selection
               </button>

               <button 
                 onClick={() => setIsSelectionMinimized(true)}
                 className="px-8 py-4 rounded-full font-black uppercase tracking-widest transition-all bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 shadow-lg"
               >
                 View Board
               </button>
            </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHAIN BUILD ANIMATION — Shows when a card is added to the chain */}
      <AnimatePresence>
        {chainBuildAnim && getCardDefByInstance(chainBuildAnim.instanceId) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" />
            <motion.div 
              initial={{ scale: 0.3, rotateY: 90, opacity: 0 }}
              animate={{ scale: 1, rotateY: 0, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0, filter: 'blur(20px)' }}
              transition={{ type: 'spring', damping: 15, stiffness: 200 }}
              className="relative"
            >
              {/* Card Image */}
              <div className="relative transform-gpu shadow-[0_0_60px_rgba(99,102,241,0.5)] border-4 border-indigo-400/50 rounded-2xl overflow-hidden">
                <Card card={getCardDefByInstance(chainBuildAnim.instanceId)!} />
              </div>

              {/* Chain Link Number Badge */}
              <motion.div 
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
                className="absolute -top-6 -right-6 w-16 h-16 bg-indigo-600 border-4 border-indigo-300 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.8)] z-20"
              >
                <span className="text-2xl font-black text-white italic">{chainBuildAnim.chainNumber}</span>
              </motion.div>

              {/* Label */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1"
              >
                <div className="bg-indigo-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-indigo-400/50 shadow-2xl">
                  <span className="text-white font-black uppercase tracking-[0.3em] text-xs">Chain Link {chainBuildAnim.chainNumber}</span>
                </div>
                <span className="text-indigo-300/60 text-[9px] font-black uppercase tracking-widest">{chainBuildAnim.playerName}</span>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHAIN RESOLUTION ANIMATION — Shows chain overview + per-link resolution */}
      <AnimatePresence>
        {chainResolutionAnim && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1100] flex items-center justify-center pointer-events-none"
          >
            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" />
            
            {chainResolutionAnim.phase === 'OVERVIEW' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative flex flex-col items-center gap-6"
              >
                <motion.h2 
                  initial={{ y: -30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="text-3xl font-black text-white uppercase tracking-[0.5em] italic drop-shadow-2xl"
                >
                  Chain Resolving
                </motion.h2>
                
                <div className="flex items-center gap-4">
                  {chainResolutionAnim.links.slice().reverse().map((link, i) => {
                    const def = getCardDefByInstance(link.instanceId);
                    return (
                      <motion.div
                        key={link.instanceId}
                        initial={{ opacity: 0, y: 30, scale: 0.5 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className="relative">
                          <div className="w-28 aspect-[63/88] rounded-xl overflow-hidden border-2 border-indigo-500/50 shadow-2xl">
                            {def && <Card card={def} isMiniature className="w-full h-full" />}
                          </div>
                          <div className="absolute -top-3 -right-3 w-8 h-8 bg-indigo-600 border-2 border-indigo-300 rounded-full flex items-center justify-center shadow-lg">
                            <span className="text-sm font-black text-white">{link.chainNumber}</span>
                          </div>
                        </div>
                        <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{link.playerName}</span>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: 300 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                  className="h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"
                />
                <span className="text-[10px] font-black text-indigo-400/60 uppercase tracking-[0.3em]">
                  Last In → First Out
                </span>
              </motion.div>
            )}

            {chainResolutionAnim.phase === 'RESOLVING' && chainResolutionAnim.currentIndex >= 0 && (() => {
              const link = chainResolutionAnim.links[chainResolutionAnim.currentIndex];
              const def = getCardDefByInstance(link.instanceId);
              return (
                <motion.div
                  key={`resolve-${link.chainNumber}`}
                  initial={{ opacity: 0, scale: 0.5, rotateX: 20 }}
                  animate={{ opacity: 1, scale: 1, rotateX: 0 }}
                  exit={{ opacity: 0, scale: 1.3, filter: 'blur(10px)' }}
                  className="relative flex flex-col items-center gap-6"
                >
                  {/* Resolving badge */}
                  <motion.div 
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center border-2 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)]">
                      <span className="text-lg font-black text-white italic">{link.chainNumber}</span>
                    </div>
                    <span className="text-xl font-black text-white uppercase tracking-widest">Resolving</span>
                  </motion.div>

                  {/* Card */}
                  <div className="relative">
                    <motion.div
                      animate={{ 
                        boxShadow: ['0 0 20px rgba(245,158,11,0.3)', '0 0 60px rgba(245,158,11,0.6)', '0 0 20px rgba(245,158,11,0.3)']
                      }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="border-4 border-amber-400/50 rounded-2xl overflow-hidden"
                    >
                      {def && <Card card={def} className="w-[240px]" />}
                    </motion.div>
                  </div>

                  {/* Effect name */}
                  <div className="bg-slate-900/80 backdrop-blur-md px-6 py-2 rounded-full border border-amber-500/30">
                    <span className="text-amber-300 font-black uppercase tracking-widest text-[10px]">{link.effectName}</span>
                  </div>

                  {/* Player */}
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{link.playerName}</span>
                </motion.div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* PRIORITY RESPONSE PROMPT — Master Duel Style with Confirmation */}
      <AnimatePresence>
        {game?.chainPriority && !game.chainPriority.isResolving && game.chainPriority.playerIndex === myIndex && !chainResolutionAnim && activatablePriorityInstances.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={isPriorityMinimized 
              ? "fixed bottom-8 left-8 w-16 h-16 rounded-full cursor-pointer z-[800]" 
              : "fixed bottom-32 left-1/2 -translate-x-1/2 z-[800]"
            }
            onClick={() => isPriorityMinimized && setIsPriorityMinimized(false)}
          >
            {isPriorityMinimized ? (
              <div className="w-full h-full bg-indigo-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/50 hover:bg-indigo-500 transition-colors">
                <Layers className="w-8 h-8 text-white" />
                <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {activatablePriorityInstances.length}
                </span>
              </div>
            ) : (
            <div className="bg-slate-900/95 backdrop-blur-2xl border-2 border-indigo-500 rounded-3xl px-8 py-6 shadow-[0_0_50px_rgba(79,70,229,0.3)] flex flex-col items-center gap-6 min-w-[400px] relative">
               <button 
                 onClick={(e) => { e.stopPropagation(); setIsPriorityMinimized(true); }}
                 className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-full transition-colors z-[810]"
                 title="Minimize to view board"
               >
                 <Minus className="w-5 h-5" />
               </button>
               <div className="flex items-center gap-3 w-full border-b border-white/10 pb-4 justify-center">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping" />
                  <span className="text-white font-black uppercase tracking-widest text-xs">Response Opportunity</span>
                  {(game.pendingChain?.length || 0) > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-indigo-600/50 rounded-full text-[8px] font-black text-indigo-300 uppercase">
                      Chain: {game.pendingChain?.length}
                    </span>
                  )}
               </div>
               
               <p className="text-slate-300 text-sm uppercase font-bold tracking-widest text-center">
                 {selectedPriorityItem ? 'Activate this card?' : 'Select a card to chain'}
               </p>
               
               <div className="flex gap-4 w-full overflow-x-auto custom-scrollbar p-4 justify-center max-w-[800px] min-h-[140px] items-center">
                  {activatablePriorityInstances.length > 0 ? activatablePriorityInstances.map((item) => {
                     const def = getCardDefByInstance(item.instanceId);
                     if (!def) return null;
                     const isSelected = selectedPriorityItem?.instanceId === item.instanceId;
                     return (
                        <div 
                           key={item.instanceId}
                           onClick={() => {
                             // Single click = select / inspect
                             setSelectedPriorityItem({ instanceId: item.instanceId, effectId: item.effectId });
                             setInspectedInstanceId(item.instanceId);
                             setIsInspectorPanelOpen(true);
                           }}
                           onDoubleClick={() => {
                             // Double click = instant activate (shortcut)
                             handleAutoActivate(item.instanceId, item.effectId);
                           }}
                           className={`relative cursor-pointer transition-all duration-300 hover:scale-110 hover:-translate-y-2 hover:z-10 group shrink-0 w-24 aspect-[63/88] rounded-xl ${
                             isSelected ? 'scale-110 -translate-y-3 z-10' : ''
                           }`}
                        >
                           <Card card={def} isMiniature className={`rounded-xl shadow-lg border-2 w-full h-full absolute inset-0 transition-all ${
                             isSelected 
                               ? 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.5)]' 
                               : 'border-indigo-500/50 group-hover:border-indigo-400 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.5)]'
                           }`} />
                           {isSelected && (
                             <motion.div 
                               initial={{ scale: 0 }}
                               animate={{ scale: 1 }}
                               className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-white z-20"
                             >
                               <span className="text-[10px] font-black text-white">✓</span>
                             </motion.div>
                           )}
                        </div>
                     );
                  }) : (
                     <div className="text-slate-500 text-xs font-black uppercase tracking-widest py-4 text-center">
                        No activatable effects
                     </div>
                  )}
               </div>

               <div className="flex gap-4 w-full mt-2">
                  {/* Chain / Activate Button */}
                  <button 
                    onClick={() => {
                      if (selectedPriorityItem) {
                        handleAutoActivate(selectedPriorityItem.instanceId, selectedPriorityItem.effectId);
                      }
                    }}
                    disabled={!selectedPriorityItem}
                    className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                      selectedPriorityItem 
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30 active:scale-95' 
                        : 'bg-slate-800/50 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <Zap className="w-4 h-4" />
                    Chain
                  </button>
                  <button 
                    onClick={passPriority}
                    className="flex-1 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg hover:shadow-xl hover:shadow-slate-900/50"
                  >
                    Cancel
                  </button>
               </div>
            </div>
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
            className={isZoneViewerMinimized 
              ? "fixed bottom-8 left-8 w-16 h-16 rounded-full cursor-pointer z-[700] pointer-events-auto" 
              : "fixed inset-0 z-[700] flex font-sans select-none pointer-events-none"
            }
            onClick={() => isZoneViewerMinimized && setIsZoneViewerMinimized(false)}
          >
            {isZoneViewerMinimized ? (
              <div className="w-full h-full bg-slate-700 rounded-full flex items-center justify-center shadow-lg shadow-slate-900/50 hover:bg-slate-600 transition-colors pointer-events-auto border-2 border-slate-500">
                <Search className="w-8 h-8 text-white" />
                <span className="absolute -top-2 -right-2 bg-slate-900 text-slate-300 text-[10px] font-black tracking-widest px-2 py-0.5 rounded-full border border-slate-700">
                  {viewingZone.location}
                </span>
              </div>
            ) : (
              <>
                {/* Left clear area for Inspector */}
                <div className="w-[440px] h-full shrink-0 pointer-events-auto hidden md:block" onClick={() => { setViewingZone(null); setIsZoneViewerMinimized(false); }} />
                
                {/* Right blurred area */}
                <div 
                  className="flex-1 h-full bg-slate-950/60 backdrop-blur-2xl border-l border-white/5 pointer-events-auto flex items-center justify-end pr-12 p-6"
                  onClick={() => { setViewingZone(null); setIsZoneViewerMinimized(false); }}
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
                   <div className="flex gap-2">
                     <button 
                       onClick={() => setIsZoneViewerMinimized(true)} 
                       className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                     >
                       <Minimize2 className="w-5 h-5" />
                       <span className="text-[10px] font-black uppercase tracking-widest">View Board</span>
                     </button>
                     <button onClick={() => { setViewingZone(null); setIsZoneViewerMinimized(false); }} className="p-3 bg-slate-800 hover:bg-red-500 rounded-2xl text-white transition-colors">
                       <X className="w-6 h-6" />
                     </button>
                   </div>
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
                </div>
              </>
            )}
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
                  Attack
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

      {/* DIRECT ATTACK PROMPT */}
      <AnimatePresence>
        {game?.directAttackPrompt && !isMyTurn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm flex items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 p-10 rounded-[2.5rem] border border-fuchsia-500/30 flex flex-col items-center gap-8 shadow-[0_0_50px_rgba(217,70,239,0.2)] max-w-md w-full"
            >
              <div className="w-20 h-20 bg-fuchsia-500/20 rounded-full flex items-center justify-center border border-fuchsia-500/30 animate-pulse">
                <Shield className="w-10 h-10 text-fuchsia-400" />
              </div>
              <div className="text-center">
                <h3 className="text-3xl font-black text-fuchsia-400 uppercase italic tracking-tighter mb-2">Direct Attack!</h3>
                <p className="text-slate-300 text-sm">You are being attacked directly! Choose your response.</p>
              </div>
              <div className="flex flex-col gap-3 w-full">
                {game.players[myIndex].deck.length > 0 && !game.players[myIndex].salvationUsedThisTurn && (
                  <button 
                    onClick={() => respondToDirectAttack('SALVATION')} 
                    className="w-full py-4 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black rounded-2xl uppercase transition-all shadow-lg shadow-fuchsia-600/20 active:scale-95 text-sm tracking-widest"
                  >
                    Use Salvation
                  </button>
                )}
                <button 
                  onClick={() => respondToDirectAttack('EFFECT')} 
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl uppercase transition-all shadow-lg shadow-blue-600/20 active:scale-95 text-sm tracking-widest"
                >
                  Activate Effect
                </button>
                <button 
                  onClick={() => respondToDirectAttack('DAMAGE')} 
                  className="w-full py-4 bg-slate-800 hover:bg-red-500/80 text-white font-black rounded-2xl uppercase transition-all active:scale-95 text-sm tracking-widest"
                >
                  Take Damage
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WAITING FOR DIRECT ATTACK RESPONSE (Attacker View) */}
      <AnimatePresence>
        {game?.directAttackPrompt && isMyTurn && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[900] bg-black/60 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 p-10 rounded-[2.5rem] border border-fuchsia-500/30 flex flex-col items-center gap-6 shadow-[0_0_50px_rgba(217,70,239,0.2)] max-w-md w-full"
            >
              <div className="w-16 h-16 bg-fuchsia-500/20 rounded-full flex items-center justify-center border border-fuchsia-500/30 animate-spin-slow">
                <Loader2 className="w-8 h-8 text-fuchsia-400 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-2xl font-black text-fuchsia-400 uppercase italic tracking-tighter mb-2">Direct Attack Paused</h3>
                <p className="text-slate-300 text-sm font-bold uppercase tracking-widest">Waiting for opponent to respond...</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
