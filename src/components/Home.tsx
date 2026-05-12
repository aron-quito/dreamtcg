import React from 'react';
import { motion } from 'framer-motion';
import { 
  Swords, 
  Layers, 
  Hammer, 
  ShoppingBag, 
  Settings, 
  User,
  Star,
  ChevronRight
} from 'lucide-react';

interface HomeProps {
  onNavigate: (module: 'BUILDER' | 'DECK' | 'TEST' | 'SHOP') => void;
  cardCount: number;
  deckCount: number;
  userName: string;
  onLogout: () => void;
  onNavigateDuel: () => void;
}

export function Home({ onNavigate, cardCount, deckCount, userName, onLogout, onNavigateDuel }: HomeProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30">
      {/* Background Decorative Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,1)_0%,rgba(2,6,23,1)_100%)]" />
        <div className="absolute inset-0 bg-grid-slate-900 opacity-30" />
        <motion.div 
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-1/2 -left-1/4 w-full h-full bg-indigo-500/10 blur-[120px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -bottom-1/2 -right-1/4 w-full h-full bg-blue-500/10 blur-[120px] rounded-full" 
        />
      </div>

      {/* Header / Logo Section */}
      <header className="relative z-10 flex items-start justify-between p-8 md:p-12">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 uppercase">
            Dream TCG
          </h1>
          <div className="flex items-center gap-2 mt-2 px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 rounded-full w-fit">
            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Online Alpha v0.1</span>
          </div>
        </motion.div>

        {/* Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-bright p-1 rounded-2xl flex items-center gap-4 group cursor-pointer hover:border-white/20 transition-all duration-500"
        >
          <div className="relative">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 border border-slate-600 flex items-center justify-center overflow-hidden">
              <User className="w-8 h-8 text-slate-400" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gold-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
              <Star className="w-3 h-3 text-white fill-current" />
            </div>
          </div>
          <div className="pr-6">
            <div className="text-sm font-bold text-slate-200">{userName}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Level 24</span>
              <span className="text-slate-700 text-[10px]">•</span>
              <button 
                onClick={(e) => { e.stopPropagation(); onLogout(); }}
                className="text-[10px] text-red-500/60 hover:text-red-400 font-black uppercase tracking-widest transition-colors"
              >
                Log Out
              </button>
            </div>
            <div className="mt-1.5 h-1 w-32 bg-slate-800 rounded-full overflow-hidden">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: '65%' }}
                transition={{ duration: 1.5, delay: 0.5 }}
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-400" 
              />
            </div>
          </div>
        </motion.div>
      </header>

      {/* Main Navigation Menu */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 md:px-12 mt-12 md:mt-24">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MenuTile 
            title="DUEL" 
            subtitle="Test your skills in the sandbox"
            icon={<Swords className="w-10 h-10" />}
            color="indigo"
            delay={0.1}
            onClick={onNavigateDuel}
            stats={`${deckCount} Decks Ready`}
          />
          <MenuTile 
            title="DECKS" 
            subtitle="Manage your powerful collections"
            icon={<Layers className="w-10 h-10" />}
            color="blue"
            delay={0.2}
            onClick={() => onNavigate('DECK')}
            stats={`${deckCount} / 20 Saved`}
          />
          <MenuTile 
            title="BUILDER" 
            subtitle="Create custom card mechanics"
            icon={<Hammer className="w-10 h-10" />}
            color="cyan"
            delay={0.3}
            onClick={() => onNavigate('BUILDER')}
            stats={`${cardCount} Custom Cards`}
          />
          <MenuTile 
            title="SHOP" 
            subtitle="Acquire new power for your decks"
            icon={<ShoppingBag className="w-10 h-10" />}
            color="gold"
            delay={0.4}
            onClick={() => onNavigate('SHOP')}
            stats="Coming Soon"
          />
        </div>
      </main>

      {/* Settings & Bottom Controls */}
      <footer className="absolute bottom-0 left-0 right-0 z-10 p-8 md:p-12 flex justify-end">
        <motion.button 
          whileHover={{ rotate: 90, scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          className="p-4 glass rounded-2xl text-slate-400 hover:text-white transition-colors"
        >
          <Settings className="w-8 h-8" />
        </motion.button>
      </footer>
    </div>
  );
}

interface MenuTileProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'indigo' | 'blue' | 'cyan' | 'gold';
  delay: number;
  onClick: () => void;
  stats: string;
}

function MenuTile({ title, subtitle, icon, color, delay, onClick, stats }: MenuTileProps) {
  const colorMap = {
    indigo: 'from-indigo-600/20 to-indigo-900/20 border-indigo-500/30 hover:border-indigo-400 group-hover:bg-indigo-500/20',
    blue: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 hover:border-blue-400 group-hover:bg-blue-500/20',
    cyan: 'from-cyan-600/20 to-cyan-900/20 border-cyan-500/30 hover:border-cyan-400 group-hover:bg-cyan-500/20',
    gold: 'from-gold-600/20 to-gold-900/20 border-gold-500/30 hover:border-gold-400 group-hover:bg-gold-500/20'
  };

  const iconColorMap = {
    indigo: 'text-indigo-400',
    blue: 'text-blue-400',
    cyan: 'text-cyan-400',
    gold: 'text-gold-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ y: -10 }}
      className="group"
      onClick={onClick}
    >
      <div className={`relative h-[320px] rounded-3xl border-2 transition-all duration-500 cursor-pointer overflow-hidden bg-gradient-to-b ${colorMap[color]}`}>
        {/* Shine effect on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-tr from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full" />
        
        <div className="absolute inset-0 p-8 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className={`p-4 rounded-2xl glass-bright ${iconColorMap[color]}`}>
              {icon}
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ChevronRight className="w-6 h-6 text-slate-400" />
            </div>
          </div>

          <div>
            <div className="text-[10px] font-black tracking-widest text-slate-500 mb-1 group-hover:text-slate-300 transition-colors uppercase">
              {stats}
            </div>
            <h2 className="text-3xl font-black tracking-tight mb-2 uppercase italic">{title}</h2>
            <p className="text-sm text-slate-400 group-hover:text-slate-200 transition-colors leading-tight">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Bottom Glow */}
        <div className={`absolute bottom-0 left-0 right-0 h-1 transition-all duration-500 opacity-0 group-hover:opacity-100 blur-sm ${
          color === 'indigo' ? 'bg-indigo-500 shadow-[0_-4px_20px_rgba(99,102,241,0.6)]' :
          color === 'blue' ? 'bg-blue-500 shadow-[0_-4px_20px_rgba(59,130,246,0.6)]' :
          color === 'cyan' ? 'bg-cyan-500 shadow-[0_-4px_20px_rgba(6,182,212,0.6)]' :
          'bg-gold-500 shadow-[0_-4px_20px_rgba(245,158,11,0.6)]'
        }`} />
      </div>
    </motion.div>
  );
}
