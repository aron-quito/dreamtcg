import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Zap, 
  Hand, 
  Circle, 
  Square, 
  Scissors,
  Trophy,
  RefreshCw,
  Loader2
} from 'lucide-react';

type Choice = 'ROCK' | 'PAPER' | 'SCISSORS' | null;

interface RPSPhaseProps {
  roomId: string;
  userEmail: string;
  isSpectator?: boolean;
  onFinished: (goFirst: boolean) => void;
}

export function RPSPhase({ roomId, userEmail, isSpectator, onFinished }: RPSPhaseProps) {
  const [myChoice, setMyChoice] = useState<Choice>(null);
  const [opponentChoice, setOpponentChoice] = useState<Choice>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [deciderEmail, setDeciderEmail] = useState<string | null>(null);
  const [isDuelStarting, setIsDuelStarting] = useState(false);
  const [roomData, setRoomData] = useState<any>(null);
  
  const isResetting = useRef(false);
  const localChoiceLocked = useRef<Choice>(null);

  useEffect(() => {
    const fetchRoom = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:3001/api/rooms/${roomId}`);
        if (response.ok) {
          const data = await response.json();
          
          const isP1 = data.player1_email === userEmail;
          const isP2 = data.player2_email === userEmail;
          
          const remoteOpponentChoice = isP1 ? data.guest_choice : (isP2 ? data.host_choice : data.guest_choice);
          const remoteMyChoice = isP1 ? data.host_choice : (isP2 ? data.guest_choice : data.host_choice);
          
          setRoomData(data); // New state to hold room info
          
          if (data.status === 'DUELING' && !isDuelStarting) {
            triggerDuelStart();
            return;
          }

          if (!isResetting.current) {
            setOpponentChoice(remoteOpponentChoice);
            if (!localChoiceLocked.current || remoteMyChoice === localChoiceLocked.current) {
              setMyChoice(remoteMyChoice);
            }

            if (data.host_choice && data.guest_choice) {
              setIsRevealed(true);
              setDeciderEmail(data.turn_order_decider);

              if (data.turn_order_decider === 'TIE') {
                isResetting.current = true;
                setTimeout(async () => {
                  try {
                    await fetch('http://127.0.0.1:3001/api/rooms/rps/reset', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ roomId })
                    });
                    setMyChoice(null);
                    setOpponentChoice(null);
                    setIsRevealed(false);
                    setDeciderEmail(null);
                    localChoiceLocked.current = null;
                    isResetting.current = false;
                  } catch (e) {}
                }, 3000);
              }
            }
          }
        } else if (response.status === 404) {
          onFinished(false);
        }
      } catch (error) {}
    };
    const interval = setInterval(fetchRoom, 1000);
    return () => clearInterval(interval);
  }, [roomId, userEmail, isDuelStarting, onFinished]);

  const triggerDuelStart = () => {
    setIsDuelStarting(true);
    // Sequence: READY? (1.5s) -> DUEL! (1.5s) -> Transition
    setTimeout(() => {
      onFinished(true); // Actual transition to board
    }, 3500);
  };

  const handleChoice = async (choice: Choice) => {
    if (isResetting.current || localChoiceLocked.current) return;
    setMyChoice(choice);
    localChoiceLocked.current = choice;
    try {
      await fetch('http://127.0.0.1:3001/api/rooms/rps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, email: userEmail, choice })
      });
    } catch (error) {
      localChoiceLocked.current = null;
    }
  };

  const handleTurnDecision = async (goFirst: boolean) => {
    try {
      const isP1 = roomData?.player1_email === userEmail;
      // If I am P1 and choose to go first -> Turn 0
      // If I am P1 and choose to go second -> Turn 1
      // If I am P2 and choose to go first -> Turn 1
      // If I am P2 and choose to go second -> Turn 0
      const turnOrder = goFirst ? (isP1 ? 0 : 1) : (isP1 ? 1 : 0);

      await fetch('http://127.0.0.1:3001/api/rooms/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, email: userEmail, status: 'DUELING', turnOrder })
      });
    } catch (error) {}
  };

  const isP1 = roomData?.player1_email === userEmail;
  const amIDecider = deciderEmail === userEmail;
  const isTie = deciderEmail === 'TIE';

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-8 overflow-hidden text-slate-100">
      {/* Cinematic Start Overlay */}
      <AnimatePresence>
        {isDuelStarting && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-[200] bg-slate-950 flex flex-col items-center justify-center"
          >
            <motion.div 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ 
                scale: [0.5, 1.2, 1], 
                opacity: [0, 1, 1],
                filter: ["blur(10px)", "blur(0px)", "blur(0px)"]
              }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <DuelText text="READY?" delay={0} />
              <DuelText text="DUEL!" delay={1.5} color="text-indigo-500" />
            </motion.div>
            
            {/* Background Impact FX */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.4, 0] }}
              transition={{ delay: 1.5, duration: 0.5 }}
              className="absolute inset-0 bg-white"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background FX */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ scale: [1, 1.1, 1], rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1500px] h-[1500px] border-[1px] border-white/5 rounded-full"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,23,42,0)_0%,rgba(2,6,23,1)_90%)]" />
      </div>

      <AnimatePresence mode="wait">
        {!isRevealed ? (
          <motion.div 
            key="selection"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-10 flex flex-col items-center"
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-6">
                <Zap className="w-4 h-4 text-indigo-400 fill-current animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300">
                  {isSpectator ? "NEURAL SYNCHRONIZATION..." : "Synchronizing..."}
                </span>
              </div>
              <h2 className="text-7xl font-black uppercase italic tracking-tighter text-white">
                {isSpectator ? "Duelists are Deciding" : "Choose your hand"}
              </h2>
              <p className="mt-4 text-slate-500 font-bold uppercase tracking-widest text-xs">
                {isSpectator ? "Observing combat initialization" : "Waiting for opponent"}
              </p>
            </div>

            {!isSpectator ? (
              <div className="flex gap-10">
                <RPSButton icon={<Square className="w-14 h-14" />} label="ROCK" isActive={myChoice === 'ROCK'} onClick={() => handleChoice('ROCK')} isDisabled={!!localChoiceLocked.current} />
                <RPSButton icon={<Hand className="w-14 h-14" />} label="PAPER" isActive={myChoice === 'PAPER'} onClick={() => handleChoice('PAPER')} isDisabled={!!localChoiceLocked.current} />
                <RPSButton icon={<Scissors className="w-14 h-14" />} label="SCISSORS" isActive={myChoice === 'SCISSORS'} onClick={() => handleChoice('SCISSORS')} isDisabled={!!localChoiceLocked.current} />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-12">
                <div className="flex gap-32 items-center">
                   {/* P1 Shadow Hand */}
                   <div className="flex flex-col items-center gap-6">
                      <motion.div 
                        animate={{ 
                          scale: roomData?.host_choice ? [1, 1.02, 1] : 1,
                          opacity: roomData?.host_choice ? 1 : 0.2,
                          borderColor: roomData?.host_choice ? "rgba(129, 140, 248, 0.5)" : "rgba(255, 255, 255, 0.05)",
                          boxShadow: roomData?.host_choice ? "0 0 60px rgba(79,70,229,0.3)" : "0 0 0px rgba(0,0,0,0)"
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        className="w-44 h-60 rounded-[3rem] bg-slate-900 border-2 flex items-center justify-center transition-colors duration-700"
                      >
                         <Hand className={`w-20 h-20 transition-colors duration-700 ${roomData?.host_choice ? 'text-indigo-400' : 'text-slate-800'}`} />
                      </motion.div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{roomData?.p1_name || "PLAYER 1"}</span>
                      <AnimatePresence>
                        {roomData?.host_choice && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.5 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[8px] bg-indigo-500 text-white px-4 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                          >
                            LOCKED
                          </motion.span>
                        )}
                      </AnimatePresence>
                   </div>

                   <div className="text-4xl font-black italic text-slate-800">VS</div>

                   {/* P2 Shadow Hand */}
                   <div className="flex flex-col items-center gap-6">
                      <motion.div 
                        animate={{ 
                          scale: roomData?.guest_choice ? [1, 1.02, 1] : 1,
                          opacity: roomData?.guest_choice ? 1 : 0.2,
                          borderColor: roomData?.guest_choice ? "rgba(129, 140, 248, 0.5)" : "rgba(255, 255, 255, 0.05)",
                          boxShadow: roomData?.guest_choice ? "0 0 60px rgba(79,70,229,0.3)" : "0 0 0px rgba(0,0,0,0)"
                        }}
                        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                        className="w-44 h-60 rounded-[3rem] bg-slate-900 border-2 flex items-center justify-center transition-colors duration-700"
                      >
                         <Hand className={`w-20 h-20 transition-colors duration-700 ${roomData?.guest_choice ? 'text-indigo-400' : 'text-slate-800'}`} />
                      </motion.div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">{roomData?.p2_name || "PLAYER 2"}</span>
                      <AnimatePresence>
                        {roomData?.guest_choice && (
                          <motion.span 
                            initial={{ opacity: 0, scale: 0.5 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-[8px] bg-indigo-500 text-white px-4 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                          >
                            LOCKED
                          </motion.span>
                        )}
                      </AnimatePresence>
                   </div>
                </div>

                <div className="flex items-center gap-4 bg-white/5 px-8 py-4 rounded-3xl border border-white/10 backdrop-blur-md">
                   <div className="flex gap-1">
                      <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 2 }} className="w-1 h-1 bg-indigo-500 rounded-full" />
                      <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.4 }} className="w-1 h-1 bg-indigo-500 rounded-full" />
                      <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 2, delay: 0.8 }} className="w-1 h-1 bg-indigo-500 rounded-full" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 italic">Synchronizing Tactical Intent...</p>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="reveal"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 20 }}
            className="relative z-10 flex flex-col items-center w-full max-w-5xl"
          >
            <div className="flex items-center justify-between w-full mb-24 gap-20">
              <ChoiceDisplay 
                label={isSpectator ? (roomData?.p1_name || "PLAYER 1") : "YOUR CHOICE"} 
                choice={isSpectator ? roomData?.host_choice : myChoice} 
                isWinner={deciderEmail === roomData?.player1_email} 
                isTie={isTie} 
              />
              <div className="flex flex-col items-center">
                <motion.div 
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring" }}
                  className={`text-5xl font-black italic mb-2 ${isTie ? 'text-amber-500 animate-pulse' : 'text-slate-800'}`}
                >
                  {isTie ? "TIE" : "VS"}
                </motion.div>
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: 128 }}
                  className={`w-px bg-gradient-to-b from-transparent ${isTie ? 'via-amber-500/50' : 'via-slate-800'} to-transparent`} 
                />
              </div>
              <ChoiceDisplay 
                label={isSpectator ? (roomData?.p2_name || "PLAYER 2") : (roomData?.p1_name || "OPPONENT")} 
                choice={isSpectator ? roomData?.guest_choice : opponentChoice} 
                isWinner={deciderEmail === roomData?.player2_email} 
                isTie={isTie} 
              />
            </div>

            <AnimatePresence>
              {isTie ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-3 text-amber-500 font-black uppercase italic text-2xl tracking-widest">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    SIMULTANEOUS INTENT
                  </div>
                </motion.div>
              ) : deciderEmail && (
                <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="text-center">
                  {amIDecider && !isSpectator ? (
                    <>
                      <h3 className="text-6xl font-black uppercase italic text-white mb-10 tracking-tight">Decide the Turn Order</h3>
                      <div className="flex gap-8">
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTurnDecision(true)}
                          className="px-16 py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black uppercase italic tracking-[0.3em] shadow-2xl shadow-emerald-900/40"
                        >
                          GO FIRST
                        </motion.button>
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleTurnDecision(false)}
                          className="px-16 py-6 bg-slate-800 hover:bg-slate-700 text-white rounded-[2rem] font-black uppercase italic tracking-[0.3em]"
                        >
                          GO SECOND
                        </motion.button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center">
                      <h3 className="text-4xl font-black uppercase italic text-slate-400 mb-6">
                        {isSpectator ? "Analyzing Decision..." : "Opponent is deciding..."}
                      </h3>
                      {roomData?.status === 'DUELING' && (
                        <motion.div 
                          initial={{ scale: 0.8, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="px-10 py-4 bg-indigo-500/20 border border-indigo-500/40 rounded-2xl"
                        >
                           <p className="text-2xl font-black uppercase italic text-indigo-400 tracking-widest">
                             {roomData.turn_order === 0 ? (roomData.p1_name || "PLAYER 1") : (roomData.p2_name || "PLAYER 2")} GOES FIRST
                           </p>
                        </motion.div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DuelText({ text, delay, color = "text-white" }: { text: string; delay: number; color?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20], scale: [1, 1.1, 1.1, 1.2] }}
      transition={{ delay, duration: 1.5 }}
      className={`text-9xl font-black italic tracking-tighter uppercase ${color} absolute inset-0 flex items-center justify-center whitespace-nowrap`}
    >
      {text}
    </motion.div>
  );
}

function RPSButton({ icon, label, isActive, onClick, isDisabled }: any) {
  return (
    <motion.button
      whileHover={isDisabled ? {} : { y: -10, scale: 1.05 }}
      whileTap={isDisabled ? {} : { scale: 0.95 }}
      onClick={onClick}
      disabled={isDisabled}
      className={`w-44 h-60 rounded-[3rem] flex flex-col items-center justify-center gap-8 transition-all duration-500 border-2 ${
        isActive 
          ? 'bg-indigo-600 border-indigo-400 shadow-[0_20px_50px_rgba(79,70,229,0.4)] text-white scale-110' 
          : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
      } ${isDisabled && !isActive ? 'opacity-40' : ''}`}
    >
      <div>{icon}</div>
      <span className="text-[10px] font-black uppercase tracking-[0.4em]">{label}</span>
    </motion.button>
  );
}

function ChoiceDisplay({ label, choice, isWinner, isTie }: any) {
  const Icon = choice === 'ROCK' ? Square : choice === 'PAPER' ? Hand : Scissors;
  return (
    <div className="flex flex-col items-center">
      <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.5em] mb-10">{label}</span>
      <motion.div 
        animate={{ scale: (isWinner || isTie) ? 1.1 : 1 }}
        className={`w-72 h-72 rounded-[4rem] flex items-center justify-center border-4 shadow-2xl relative transition-all duration-500 ${
          isWinner ? 'border-emerald-500 text-emerald-400' : isTie ? 'border-amber-500 text-amber-400' : 'border-slate-800 text-slate-600'
        }`}
      >
        <Icon className="w-28 h-28" />
      </motion.div>
    </div>
  );
}
