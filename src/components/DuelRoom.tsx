import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Swords, 
  ShieldCheck, 
  Layers, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { DeckDefinition } from '../types';

interface RoomState {
  id: string;
  host_email: string;
  owner_name?: string;
  player1_email: string | null;
  player2_email: string | null;
  p1_name?: string;
  p2_name?: string;
  spec1_name?: string;
  spec2_name?: string;
  spectator1_email: string | null;
  spectator2_email: string | null;
  host_deck_id: string | null;
  guest_deck_id: string | null;
  host_ready: number;
  guest_ready: number;
  status: string;
}

interface DuelRoomProps {
  roomId: string;
  userEmail: string;
  userDecks: DeckDefinition[];
  isSpectator?: boolean;
  onRoleChanged: (isSpec: boolean) => void;
  onStartDuel: (config: { hostDeckId: string; guestDeckId: string; hostEmail: string; guestEmail: string }) => void;
  onExit: () => void;
}

export function DuelRoom({ roomId, userEmail, userDecks, isSpectator, onRoleChanged, onStartDuel, onExit }: DuelRoomProps) {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [isReady, setIsReady] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const isHost = room?.host_email === userEmail;

  // Polling for room state
  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:3001/api/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          setRoom(data);

          // Transition logic
          if (data.status === 'RPS' || data.status === 'DUELING' || data.status === 'FINISHED') {
            onStartDuel({
              hostDeckId: data.host_deck_id!,
              guestDeckId: data.guest_deck_id!,
              hostEmail: data.host_email,
              guestEmail: data.guest_email!
            });
          }
        } else if (response.status === 404) {
          // Room was closed
          onExit();
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    };

    const interval = setInterval(fetchRoom, 2000);
    fetchRoom();
    return () => clearInterval(interval);
  }, [roomId, onStartDuel]);

  const updateRoomState = async (updates: { deckId?: string; ready?: boolean; status?: string }) => {
    if (isSpectator) return;
    try {
      await fetch('http://127.0.0.1:3001/api/rooms/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          roomId, 
          email: userEmail, 
          ...updates 
        })
      });
    } catch (error) {
      console.error("Update error:", error);
    }
  };

  const handleSwitchRole = async (target: 'PLAYER' | 'SPECTATOR') => {
    try {
      const response = await fetch('http://127.0.0.1:3001/api/rooms/roles/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, email: userEmail, targetRole: target })
      });
      if (response.ok) {
        onRoleChanged(target === 'SPECTATOR');
        setIsReady(false);
        setSelectedDeckId('');
      } else {
        const data = await response.json();
        alert(data.error || "Failed to switch role");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExit = async () => {
    try {
      await fetch('http://127.0.0.1:3001/api/rooms/leave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, email: userEmail })
      });
    } catch (error) {
      console.error("Leave error:", error);
    }
    onExit();
  };

  const handleToggleReady = () => {
    if (isSpectator) return;
    if (!selectedDeckId) {
      alert("Please select a deck first!");
      return;
    }
    const nextReady = !isReady;
    setIsReady(nextReady);
    updateRoomState({ ready: nextReady });
  };

  const handleDeckSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (isSpectator) return;
    const deckId = e.target.value;
    setSelectedDeckId(deckId);
    updateRoomState({ deckId });
  };

  const handleStartMatch = () => {
    if (isHost && room?.host_ready && room?.guest_ready) {
      updateRoomState({ status: 'RPS' });
    }
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  // Filtrar mazos para mostrar solo cartas válidas
  const validatedDecks = userDecks.map(d => ({
    ...d,
    existingCards: d.mainCards.filter(cid => true)
  }));

  if (!room) return null;

  return (
    <div className="relative min-h-[90vh] w-full flex flex-col p-8">
      {/* Header Info */}
      <div className="flex justify-between items-center mb-12">
        <button 
          onClick={handleExit}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors uppercase text-[10px] font-black tracking-widest group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> {isSpectator ? "Exit Observation" : "Cancel Duel"}
        </button>
        
        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 px-6 py-3 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Room ID:</span>
            <span className="text-white font-black tracking-widest text-lg">{roomId}</span>
            <button onClick={copyRoomId} className="p-2 hover:bg-white/5 rounded-lg transition-colors relative">
              <Copy className={`w-4 h-4 ${copyFeedback ? 'text-emerald-400' : 'text-slate-600'}`} />
            </button>
          </div>
          <p className="mt-2 text-[8px] font-black text-indigo-500 uppercase tracking-widest">
            Created by {room.owner_name || room.host_email}
          </p>
        </div>

        <div className="flex items-center gap-4">
           {!isSpectator && (
             <button 
               onClick={() => handleSwitchRole('SPECTATOR')}
               className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-[8px] font-black uppercase tracking-widest transition-all border border-white/5"
             >
                Move to Spectators
             </button>
           )}
           {isSpectator && (
             <div className="px-4 py-2 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2 whitespace-nowrap">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black uppercase tracking-widest text-amber-500">Spectator Mode</span>
             </div>
           )}
        </div>
      </div>

      {/* Versus Screen */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-12 items-center">
        {/* Player 1 (Host) */}
        <PlayerProfile 
          name={room.p1_name || "WAITING..."}
          email={room.player1_email}
          isReady={!!room.host_ready}
          isLocal={room.player1_email === userEmail}
          selectedDeck={validatedDecks.find(d => d.id === (room.player1_email === userEmail ? selectedDeckId : room.host_deck_id))}
          decks={validatedDecks}
          onDeckSelect={handleDeckSelect}
        />

        {/* VS Divider */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-px h-24 bg-gradient-to-b from-transparent via-slate-800 to-transparent" />
          <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center shadow-2xl shadow-indigo-600/50 relative">
            <Swords className="w-10 h-10 text-white italic" />
            <div className="absolute inset-0 bg-white/20 rounded-full animate-ping" />
          </div>
          <div className="w-px h-24 bg-gradient-to-b from-slate-800 via-slate-800 to-transparent" />
        </div>

        {/* Player 2 (Guest) */}
        <PlayerProfile 
          name={room.p2_name || "WAITING..."}
          email={room.player2_email || "???"}
          isReady={!!room.guest_ready}
          isLocal={room.player2_email === userEmail}
          selectedDeck={validatedDecks.find(d => d.id === (room.player2_email === userEmail ? selectedDeckId : room.guest_deck_id))}
          decks={validatedDecks}
          onDeckSelect={handleDeckSelect}
        />
      </div>

      {/* Bottom Controls */}
      <footer className="mt-12 flex flex-col items-center gap-6">
        {!isSpectator ? (
          <>
            <div className="flex items-center gap-8">
              <ReadyToggle isActive={isReady} onClick={handleToggleReady} />
            </div>

            {room.host_email === userEmail && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={!(room.host_ready && room.guest_ready)}
                onClick={handleStartMatch}
                className={`px-16 py-6 rounded-3xl font-black uppercase italic text-xl tracking-[0.3em] transition-all shadow-2xl ${
                  (room.host_ready && room.guest_ready) 
                    ? 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-indigo-900/50 opacity-100' 
                    : 'bg-slate-800 text-slate-600 shadow-none opacity-50 cursor-not-allowed'
                }`}
              >
                Start Duel
              </motion.button>
            )}
            
            {!(room.host_ready && room.guest_ready) && (
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-3 h-3" /> Both duelists must be ready to begin
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-8">
            {(!room.player1_email || !room.player2_email) && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleSwitchRole('PLAYER')}
                className="px-16 py-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-3xl font-black uppercase italic text-xl tracking-[0.3em] shadow-2xl shadow-emerald-900/40"
              >
                Step into the Arena
              </motion.button>
            )}

            <div className="p-8 bg-slate-900/50 border border-white/5 rounded-[2rem] text-center max-w-sm">
               <Clock className="w-8 h-8 text-indigo-400 mx-auto mb-4 animate-pulse" />
               <p className="text-xs font-black uppercase tracking-widest text-slate-400">Waiting for players to finalize configuration...</p>
               <p className="text-[8px] text-slate-600 mt-2">You will be automatically deployed when the combat starts.</p>
            </div>
          </div>
        )}
      </footer>

      {/* Spectator List */}
      <div className="mt-12 pt-8 border-t border-white/5 flex flex-col items-center gap-4">
         <h5 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] flex items-center gap-2">
            <User className="w-3 h-3" /> Passive Observers
         </h5>
         <div className="flex gap-4">
            {[
              { email: room.spectator1_email, name: room.spec1_name },
              { email: room.spectator2_email, name: room.spec2_name }
            ].map((spec, i) => spec.email ? (
              <div key={i} className="px-4 py-2 bg-slate-900/50 border border-white/5 rounded-full flex items-center gap-3">
                 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                 <span className="text-[10px] font-bold text-slate-300">{spec.name || 'Connecting...'}</span>
              </div>
            ) : null)}
            {!(room.spectator1_email || room.spectator2_email) && (
              <span className="text-[9px] font-black text-slate-800 uppercase tracking-widest italic">No observers present</span>
            )}
         </div>
      </div>
    </div>
  );
}

function PlayerProfile({ name, email, isReady, isLocal, selectedDeck, decks, onDeckSelect }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: isLocal ? -20 : 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`glass-bright p-10 rounded-[3rem] border-2 transition-all duration-500 ${isReady ? 'border-emerald-500/30' : 'border-white/5'}`}
    >
      <div className="flex flex-col items-center">
        <div className="relative mb-6">
          <div className="w-32 h-32 bg-slate-900 rounded-3xl flex items-center justify-center border border-white/5 shadow-inner">
            <User className="w-16 h-16 text-slate-600" />
          </div>
          <AnimatePresence>
            {isReady && (
              <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center border-4 border-slate-950 shadow-lg shadow-emerald-900/40"
              >
                <CheckCircle2 className="w-5 h-5 text-white" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="flex-1 text-center">
          <h4 className="text-2xl font-black text-white truncate italic tracking-tighter">{name}</h4>
          <div className="flex items-center justify-center gap-2 mt-1">
             <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">{isReady ? 'Ready for Combat' : 'Configuring...'}</span>
          </div>
        </div>

        <div className="w-full space-y-4 mt-8">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Layers className="w-3 h-3" />
            <span className="text-[9px] font-black uppercase tracking-widest">Active Strategy</span>
          </div>

          {isLocal ? (
            <select 
              value={selectedDeck?.id || ''}
              onChange={onDeckSelect}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none focus:border-indigo-500 transition-all appearance-none"
            >
              <option value="" disabled>-- Select a Deck --</option>
              {decks.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          ) : (
            <div className="w-full bg-slate-950/50 border border-white/5 rounded-xl px-4 py-3 text-sm font-bold text-slate-400 italic">
              {selectedDeck ? selectedDeck.name : "Selecting Deck..."}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ReadyToggle({ isActive, onClick }: { isActive: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`relative px-12 py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-500 overflow-hidden group ${
        isActive 
          ? 'bg-emerald-600 text-white shadow-xl shadow-emerald-900/40' 
          : 'bg-slate-900 text-slate-500 border border-slate-800 hover:border-slate-700'
      }`}
    >
      <div className="relative z-10 flex items-center gap-3">
        {isActive ? <ShieldCheck className="w-4 h-4" /> : <div className="w-4 h-4 border-2 border-slate-700 rounded-full" />}
        {isActive ? "DUELIST READY" : "CONFIRM READINESS"}
      </div>
      <motion.div 
        animate={{ x: isActive ? '100%' : '-100%' }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" 
      />
    </button>
  );
}
