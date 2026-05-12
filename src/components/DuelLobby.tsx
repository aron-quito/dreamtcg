import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlusCircle, 
  LogIn, 
  Swords, 
  Users, 
  Trophy, 
  Shield,
  ArrowRight,
  Hash,
  Globe,
  Clock,
  ExternalLink,
  ChevronLeft,
  RefreshCw,
  Zap
} from 'lucide-react';

interface RoomData {
  id: string;
  host_name: string;
  host_email: string;
  guest_email: string | null;
  player_count: number;
  spectators: number;
  status: 'LOBBY' | 'RPS' | 'DUELING' | 'FINISHED';
  spectator1_email?: string | null;
  spectator2_email?: string | null;
  created_at: string;
}

interface DuelLobbyProps {
  userEmail: string;
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (roomId: string, isSpectator?: boolean) => void;
  onBack: () => void;
}

export function DuelLobby({ userEmail, onRoomCreated, onRoomJoined, onBack }: DuelLobbyProps) {
  const [activeTab, setActiveTab] = useState<'BROWSE' | 'CREATE' | 'JOIN'>('BROWSE');
  const [roomIdInput, setRoomIdInput] = useState('');
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Fetch Rooms & Telemetry
  const fetchData = async () => {
    setIsLoadingRooms(true);
    try {
      const [roomsRes, onlineRes] = await Promise.all([
        fetch('http://127.0.0.1:3001/api/rooms'),
        fetch('http://127.0.0.1:3001/api/users/online')
      ]);

      if (roomsRes.ok) {
        const data = await roomsRes.json();
        const rawRooms = Array.isArray(data) ? data : (data.rooms || []);
        const activeRooms = rawRooms.filter((r: any) => r.id && (r.host_email || r.host_name));
        setRooms(activeRooms);
      }

      if (onlineRes.ok) {
        const users = await onlineRes.json();
        setOnlineUsers(users);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // 10s auto refresh
    return () => clearInterval(interval);
  }, []);

  const handleCreateRoom = async () => {
    setIsCreating(true);
    try {
      const response = await fetch('http://127.0.0.1:3001/api/rooms/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail })
      });
      const data = await response.json();
      if (response.ok) {
        onRoomCreated(data.roomId);
      } else {
        if (data.error === 'already_in_match') {
          onRoomJoined(data.roomId);
          return;
        }
        alert(data.error);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (targetRoomId?: string, asSpectator: boolean = false) => {
    const id = targetRoomId || roomIdInput.toUpperCase();
    if (!id) return;
    setIsJoining(true);
    try {
      const endpoint = asSpectator ? 'http://127.0.0.1:3001/api/rooms/spectate' : 'http://127.0.0.1:3001/api/rooms/join';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: id, email: userEmail })
      });
      if (response.ok) {
        onRoomJoined(id, asSpectator);
      } else {
        const data = await response.json();
        if (data.error === 'already_in_match') {
          onRoomJoined(data.roomId);
          return;
        }
        if (!asSpectator && (data.error === 'match_in_progress' || data.error === 'room_full')) {
          console.log("Room full or in progress, attempting auto-spectate...");
          return handleJoinRoom(id, true);
        }
        alert(data.error || "Failed to enter room");
      }
    } catch (error) {
      console.error("Failed to join room:", error);
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div className="relative w-full h-screen bg-[#0a0d14] flex overflow-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/5 blur-[150px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[150px] rounded-full" />
      </div>

      {/* MAIN LAYOUT */}
      <div className="relative z-10 flex flex-1 overflow-hidden">
        
        {/* CENTER CONTENT */}
        <div className="flex-1 flex flex-col min-h-0">
          <header className="p-8 border-b border-white/5 flex items-center justify-between bg-slate-900/20 backdrop-blur-xl shrink-0">
            <div className="flex flex-col">
              <button 
                onClick={onBack}
                className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors mb-2 group"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span className="text-[8px] font-black uppercase tracking-widest">Back to Systems</span>
              </button>
              <h2 className="text-3xl font-black tracking-tighter uppercase italic text-white leading-none">Combat Nexus</h2>
            </div>

            {/* Tab Navigation */}
            <div className="flex bg-black/40 p-1.5 rounded-2xl border border-white/5">
              {[
                { id: 'BROWSE', label: 'Browse', icon: Globe },
                { id: 'CREATE', label: 'Host', icon: PlusCircle },
                { id: 'JOIN', label: 'ID', icon: Hash }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-6 py-2.5 rounded-xl flex items-center gap-3 transition-all ${
                    activeTab === tab.id 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  <span className="text-[9px] font-black uppercase tracking-widest">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3">
               <div className="px-4 py-2 bg-slate-900/50 border border-white/5 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
                  <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{onlineUsers.length} Online</span>
               </div>
               <button onClick={fetchData} className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl border border-white/5"><RefreshCw className={`w-4 h-4 ${isLoadingRooms ? 'animate-spin' : ''}`} /></button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-10 custom-scrollbar">
            <AnimatePresence mode="wait">
              {activeTab === 'BROWSE' && (
                <motion.div 
                  key="browse"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                   {rooms.length > 0 ? rooms.map((room) => {
                     const isDuel = room.status === 'DUELING';
                     const isFull = room.player_count >= 2;

                     return (
                       <motion.div 
                         key={room.id}
                         whileHover={{ y: -4 }}
                         className="bg-slate-900/40 border border-white/5 rounded-[2.5rem] p-8 group hover:border-indigo-500/30 transition-all"
                       >
                          <div className="flex items-center justify-between mb-8">
                             <div className={`px-4 py-1 rounded-full text-[8px] font-black tracking-widest uppercase border ${
                               isDuel ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                             }`}>
                                {isDuel ? 'IN DUEL' : 'WAITING'}
                             </div>
                             <div className="flex flex-col gap-1 items-end">
                              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/50 border border-white/5 rounded-full">
                                 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
                                 <span className="text-[10px] font-bold text-slate-400">{room.player_count}/2 PLAYERS</span>
                              </div>
                              <div className="flex items-center gap-2 px-3 py-1 bg-slate-950/50 border border-white/5 rounded-full">
                                 <div className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                                 <span className="text-[10px] font-bold text-slate-400">{room.spectators} SPECS</span>
                              </div>
                           </div>
                          </div>
                          
                          <div className="flex items-center gap-5 mb-10">
                             <div className="w-14 h-14 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                                <Swords className="w-7 h-7" />
                             </div>
                             <div>
                                <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Master of Node</p>
                                <h4 className="text-xl font-bold text-white truncate max-w-[200px]">{room.host_name || 'Anonymous'}</h4>
                                <p className="text-[10px] text-slate-500 font-mono mt-1 opacity-50 tracking-tighter">NODE-ID: {room.id}</p>
                             </div>
                          </div>

                           <div className="flex flex-col gap-3">
                             <button 
                               onClick={() => handleJoinRoom(room.id, isFull)}
                               disabled={isJoining || (isFull && room.spectators >= 2)}
                               className={`w-full py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-3 transition-all ${
                                 isFull
                                 ? (room.spectators >= 2 ? 'bg-slate-800 text-slate-600 cursor-not-allowed opacity-50' : 'bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-white border border-amber-500/20 shadow-lg shadow-amber-900/20') 
                                 : 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 hover:bg-indigo-500'
                               }`}
                             >
                                {isFull 
                                  ? (room.spectators >= 2 ? 'Room Fully Occupied' : 'Observe Duel') 
                                  : (isDuel ? 'Resume Duel' : 'Enter Arena')}
                                {isFull ? <Globe className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                             </button>
                           </div>
                       </motion.div>
                     );
                   }) : (
                     <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                        <Clock className="w-12 h-12 mb-4 text-slate-800 mx-auto" />
                        <p className="text-xs font-black uppercase tracking-[0.4em] text-slate-700 italic">No signals in range</p>
                     </div>
                   )}
                </motion.div>
              )}

              {activeTab === 'CREATE' && (
                 <motion.div key="create" className="max-w-xl mx-auto py-10">
                    <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-12 text-center">
                       <div className="w-20 h-20 bg-indigo-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                          <PlusCircle className="w-10 h-10 text-indigo-400" />
                       </div>
                       <h3 className="text-3xl font-black uppercase italic text-white mb-4">Initialize Port</h3>
                       <p className="text-slate-400 text-sm mb-12">Deploying a new node. You will wait for a challenger.</p>
                       <button onClick={handleCreateRoom} disabled={isCreating} className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] transition-all shadow-xl shadow-indigo-900/40">
                         {isCreating ? "Deploying..." : "Open Signal"}
                       </button>
                    </div>
                 </motion.div>
              )}

              {activeTab === 'JOIN' && (
                 <motion.div key="join" className="max-w-xl mx-auto py-10">
                    <div className="bg-slate-900/40 border border-white/5 rounded-[3rem] p-12 text-center">
                       <div className="w-20 h-20 bg-emerald-600/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                          <LogIn className="w-10 h-10 text-emerald-400" />
                       </div>
                       <h3 className="text-3xl font-black uppercase italic text-white mb-4">Manual Sync</h3>
                       <form onSubmit={(e) => { e.preventDefault(); handleJoinRoom(); }} className="space-y-6">
                          <input 
                            type="text"
                            value={roomIdInput}
                            onChange={e => setRoomIdInput(e.target.value.toUpperCase())}
                            placeholder="NODE-CODE"
                            className="w-full bg-black/40 border border-slate-800 rounded-[2rem] py-6 text-center text-xl font-black text-white outline-none focus:border-emerald-500/50 tracking-[0.5em]"
                          />
                          <button type="submit" disabled={isJoining || !roomIdInput} className="w-full py-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-[2rem] font-black uppercase text-sm tracking-[0.3em] transition-all shadow-xl shadow-emerald-900/40">
                            {isJoining ? "Syncing..." : "Connect"}
                          </button>
                       </form>
                    </div>
                 </motion.div>
              )}
            </AnimatePresence>
          </main>
        </div>

        {/* SOCIAL SIDEBAR */}
        <aside className="w-96 border-l border-white/5 bg-slate-950 p-8 flex flex-col gap-8">
           <div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 flex items-center gap-3">
                 <Zap className="w-4 h-4 text-amber-500" /> Duelist Network
              </h3>
              
              <div className="space-y-4">
                 {onlineUsers.map(u => (
                   <div key={u.email} className="p-5 bg-slate-900/30 border border-white/5 rounded-[2rem] hover:bg-slate-800/40 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                         <span className="text-[11px] font-black text-white group-hover:text-indigo-400 transition-colors">{u.name}</span>
                         <div className={`px-3 py-1 rounded-full text-[7px] font-black uppercase tracking-widest ${
                           u.status === 'DUELO' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
                           u.status === 'SALA' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                           'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                         }`}>
                           {u.status || 'ONLINE'}
                         </div>
                      </div>
                      <p className="text-[9px] text-slate-600 font-mono italic">{u.email}</p>
                   </div>
                 ))}
                 {onlineUsers.length === 0 && (
                   <div className="py-20 text-center opacity-30 italic text-[10px] uppercase font-black tracking-widest">
                      Scanning for active signals...
                   </div>
                 )}
              </div>
           </div>
           
           <div className="mt-auto p-8 bg-indigo-600/5 border border-indigo-500/10 rounded-[2.5rem]">
              <Trophy className="w-8 h-8 text-indigo-500 mb-4" />
              <h5 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Social Protocol Active</h5>
              <p className="text-[9px] text-slate-500 leading-relaxed uppercase tracking-tighter">
                You can now see the real-time status of all duelists in the network.
              </p>
           </div>
        </aside>
      </div>
    </div>
  );
}
