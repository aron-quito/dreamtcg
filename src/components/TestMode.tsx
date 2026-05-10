import React, { useState, useEffect } from 'react';
import { 
  Dna, 
  Sword, 
  Shield, 
  Zap, 
  RefreshCw, 
  MessageSquare,
  Play,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  GameState, 
  CardDefinition, 
  TriggerType 
} from '../types';
import { CardEngine } from '../engine/controller';

interface TestModeProps {
  initialState: GameState;
  cards: CardDefinition[];
}

export const TestMode: React.FC<TestModeProps> = ({ initialState, cards }) => {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'trigger' | 'action'}[]>([]);
  const [engine] = useState(() => new CardEngine(initialState, cards));

  const addLog = (msg: string, type: 'info' | 'trigger' | 'action' = 'info') => {
    setLogs(prev => [{ msg, type }, ...prev].slice(0, 50));
  };

  const handleEmit = async (type: TriggerType) => {
    addLog(`EMITTING TRIGGER: ${type}`, 'trigger');
    await engine.emit(type);
    setGameState({ ...engine.getState() });
    addLog("Event loop completed.", 'info');
  };

  const handleSummon = async (playerIndex: number, cardId: string, slotIndex: number) => {
    const newState = { ...gameState };
    const player = newState.players[playerIndex];
    if (player.monsterZones[slotIndex] === null) {
      player.monsterZones[slotIndex] = cardId;
      addLog(`SUMMONED ${cards.find(c => c.id === cardId)?.name} to M-ZONE ${slotIndex + 1}`, 'action');
      setGameState(newState);
      await handleEmit(TriggerType.ON_SUMMON);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[75vh]">
      {/* Simulation Board */}
      <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 p-8 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(79,70,229,0.05)_0,transparent_100%)] pointer-events-none" />
        
        {/* Opponent (Top) */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-20 w-48 bg-slate-900/50 border border-slate-800 rounded-b-xl flex items-center justify-center text-slate-500 font-mono text-xs">
            OPPONENT AREA
          </div>
          <div className="flex gap-4">
            {[0, 1, 2].map(i => (
               <div key={i} className="w-24 h-32 border-2 border-dashed border-slate-900 rounded-xl flex items-center justify-center text-slate-800">
                  <span className="text-[10px] font-bold">M-{i+1}</span>
               </div>
            ))}
          </div>
        </div>

        {/* Center: Chain Stack (Visual) */}
        <div className="flex justify-center flex-col items-center">
           <Zap className="w-8 h-8 text-indigo-500 mb-2 animate-pulse" />
           <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Active Resolution Field</div>
        </div>

        {/* Player (Bottom) */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-6">
            {/* Monster Zones */}
            <div className="flex gap-4">
              {[0, 1, 2].map(i => {
                const cardId = gameState.players[0].monsterZones[i];
                const card = cards.find(c => c.id === cardId);
                return (
                  <div 
                    key={i} 
                    className={`w-24 h-32 rounded-xl transition-all border-2 flex flex-col items-center justify-center gap-2 relative group overflow-hidden ${
                      cardId ? 'bg-slate-900 border-indigo-500 shadow-lg shadow-indigo-500/20' : 'bg-slate-900/20 border-slate-900 border-dashed hover:border-slate-700 cursor-pointer'
                    }`}
                    onClick={() => !cardId && handleSummon(0, cards[0]?.id, i)}
                  >
                    {!cardId ? (
                      <span className="text-[10px] font-bold text-slate-800">SUMMON</span>
                    ) : (
                      <>
                        <Dna className="w-8 h-8 text-indigo-400" />
                        <div className="text-[8px] font-bold uppercase truncate px-1 w-full text-center">{card?.name}</div>
                        <div className="absolute bottom-1 left-1 right-1 flex justify-between px-1 text-[7px] font-mono">
                          <span>{card?.atk}</span>
                          <span>{card?.def}</span>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="h-16 w-full max-w-md bg-slate-900 border border-slate-800 rounded-t-xl flex items-center justify-around px-6">
            <div className="flex items-center gap-2 text-emerald-400 font-mono text-sm leading-none pt-1">
              <Shield className="w-4 h-4" />
              <span>{gameState.players[0].lp} LP</span>
            </div>
            <div className="flex items-center gap-2 text-amber-400 font-mono text-sm leading-none pt-1">
              <RefreshCw className="w-4 h-4" />
              <span>TURN {gameState.turn}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel & Real-time Chain Inspector */}
      <div className="lg:col-span-4 flex flex-col gap-6">
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex-1 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Engine Logs
            </h3>
            <button 
              onClick={() => setLogs([])}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
            >
              CLEAR
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2">
            <AnimatePresence mode="popLayout">
              {logs.map((log, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`text-[10px] p-2 rounded border font-mono ${
                    log.type === 'trigger' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' :
                    log.type === 'action' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
                    'bg-slate-950 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {log.type === 'trigger' && <Zap className="w-3 h-3" />}
                    {log.type === 'action' && <Play className="w-3 h-3" />}
                    <span>{log.msg}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Manual Triggers</h3>
          <div className="grid grid-cols-2 gap-2">
            {[TriggerType.ON_ATTACK, TriggerType.ON_DRAW, TriggerType.ANY_TIME].map(t => (
              <button 
                key={t}
                onClick={() => handleEmit(t)}
                className="p-2 bg-slate-950 border border-slate-800 rounded-lg text-[9px] font-bold text-slate-400 hover:text-indigo-400 hover:border-indigo-500 transition-all flex items-center gap-2"
              >
                <ArrowRight className="w-3 h-3" /> {t}
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
