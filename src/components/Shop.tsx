import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Sparkles, AlertCircle, ShoppingCart, Loader2 } from 'lucide-react';
import { CardDefinition, PhysicalCard } from '../types';
import { Card } from './Card';
import { API_BASE } from '../config';

interface ShopProps {
  userEmail: string;
  coins: number;
  collection: CardDefinition[];
  onBack: () => void;
  onRefreshPhysicalCards: () => void;
  onUpdateCoins: (coins: number) => void;
}

export function Shop({ userEmail, coins, collection, onBack, onRefreshPhysicalCards, onUpdateCoins }: ShopProps) {
  const [isBuying, setIsBuying] = useState(false);
  const [pulledCards, setPulledCards] = useState<{ def: CardDefinition, physical: PhysicalCard }[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const PACK_PRICE = 100;

  const handleBuyPack = async () => {
    if (coins < PACK_PRICE) {
      setError("Not enough coins!");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsBuying(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/shop/buy-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail })
      });

      if (res.ok) {
        const data = await res.json();
        // Update local coins state immediately
        onUpdateCoins(coins - PACK_PRICE);
        
        // Map physical cards to definitions
        const newCards = data.cards.map((pc: PhysicalCard) => ({
          def: collection.find(c => c.id === pc.templateId)!,
          physical: pc
        }));
        
        setPulledCards(newCards);
        onRefreshPhysicalCards(); // Refresh global inventory
      } else {
        const data = await res.json();
        setError(data.error || "Failed to buy pack");
      }
    } catch (err) {
      setError("Network error occurred.");
    } finally {
      setIsBuying(false);
    }
  };

  return (
    <div className="min-h-[80vh] w-full flex flex-col items-center justify-center relative p-8">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.1)_0%,rgba(2,6,23,1)_70%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl flex flex-col items-center">
        
        {/* Header */}
        <div className="text-center mb-12 animate-in slide-in-from-top-4 fade-in">
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-600 mb-2">
            Card Shop
          </h1>
          <p className="text-slate-400 font-bold uppercase tracking-widest text-sm flex items-center justify-center gap-2">
            Expand Your Collection <Sparkles className="w-4 h-4 text-emerald-500" />
          </p>
        </div>

        {/* Error Notification */}
        <AnimatePresence>
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-0 flex items-center gap-2 bg-red-500/20 text-red-400 px-6 py-3 rounded-full border border-red-500/30 font-black text-sm uppercase tracking-widest backdrop-blur-md"
            >
              <AlertCircle className="w-4 h-4" />
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {!pulledCards ? (
          /* Pack Display */
          <motion.div 
            className="flex flex-col items-center gap-8"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="relative group cursor-pointer" onClick={isBuying ? undefined : handleBuyPack}>
              {/* Glow */}
              <div className="absolute inset-0 bg-emerald-500/20 blur-[50px] group-hover:bg-emerald-500/40 transition-colors duration-500 rounded-full" />
              
              {/* Pack Image/Container */}
              <div className={`relative w-64 h-96 bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-emerald-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col items-center justify-center group-hover:-translate-y-4 transition-transform duration-500 ${isBuying ? 'animate-pulse' : ''}`}>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 mix-blend-overlay" />
                <Package className="w-24 h-24 text-emerald-500 mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white drop-shadow-md">Core Set</h2>
                <p className="text-emerald-400 font-bold text-xs uppercase tracking-widest mt-1">Contains 5 Cards</p>
              </div>
            </div>

            <button 
              onClick={handleBuyPack}
              disabled={isBuying || coins < PACK_PRICE}
              className="group relative px-8 py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-2xl font-black uppercase tracking-widest transition-all hover:-translate-y-1 hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] flex items-center gap-3 overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              {isBuying ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Buy Pack — 100 Coins
                </>
              )}
            </button>
          </motion.div>
        ) : (
          /* Reveal Cards */
          <div className="flex flex-col items-center w-full">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-white mb-8 animate-in fade-in slide-in-from-bottom-4">Cards Added to Inventory!</h2>
            
            <div className="flex flex-wrap justify-center gap-4 md:gap-6 mb-12">
              {pulledCards.map((card, i) => (
                <motion.div
                  key={card.physical.id}
                  initial={{ opacity: 0, y: 50, scale: 0.8, rotateY: 90 }}
                  animate={{ opacity: 1, y: 0, scale: 1, rotateY: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.2, type: 'spring' }}
                  className="relative group"
                >
                  <div className={`absolute -inset-2 rounded-xl blur-lg transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                    card.physical.quality === 'ULTRA' ? 'bg-fuchsia-500/50' : 
                    card.physical.quality === 'EPIC' ? 'bg-orange-500/50' : 
                    card.physical.quality === 'SPECIAL' ? 'bg-emerald-500/50' : 'bg-indigo-500/30'
                  }`} />
                  <div className="relative w-40 md:w-48 animate-in zoom-in group-hover:-translate-y-2 transition-transform duration-300">
                    <Card card={card.def} isMiniature />
                    <div className={`absolute -top-3 -right-3 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest shadow-xl border-2 ${
                      card.physical.quality === 'ULTRA' ? 'bg-fuchsia-950 text-fuchsia-400 border-fuchsia-500' : 
                      card.physical.quality === 'EPIC' ? 'bg-orange-950 text-orange-400 border-orange-500' : 
                      card.physical.quality === 'SPECIAL' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' : 
                      'bg-indigo-950 text-indigo-400 border-indigo-500'
                    }`}>
                      {card.physical.quality}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={() => setPulledCards(null)}
              className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black uppercase tracking-widest transition-colors text-sm"
            >
              Open Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
