import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  Mail, 
  ArrowRight, 
  LogIn, 
  UserPlus,
  Chrome,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface AuthProps {
  onLogin: (user: { name: string; email: string }) => void;
}

export function Auth({ onLogin }: AuthProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.user);
      } else {
        setError(data.error || 'Authentication failed');
      }
    } catch (err) {
      setError('Could not connect to the server. Is it running?');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setIsLoading(true);
    // Simulate Google Sign-In
    setTimeout(() => {
      onLogin({ 
        name: 'Google Duelist',
        email: 'google@example.com' 
      });
      setIsLoading(false);
    }, 1000);
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-950 font-sans text-slate-100 selection:bg-indigo-500/30">
      {/* Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,41,59,1)_0%,rgba(2,6,23,1)_100%)]" />
        <div className="absolute inset-0 bg-grid-slate-900 opacity-20" />
        <motion.div 
          animate={{ 
            opacity: [0.3, 0.5, 0.3],
            scale: [1, 1.2, 1],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 blur-[100px] rounded-full" 
        />
        <motion.div 
          animate={{ 
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.1, 1],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full" 
        />
      </div>

      <div className="relative z-10 w-full max-w-md px-6 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center mb-10"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-600/30 mb-4 animate-float">
            <Zap className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter uppercase italic text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">
            Dream TCG
          </h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] mt-2">Accessing Digital Realms</p>
        </motion.div>

        <motion.div 
          layout
          className="glass p-8 rounded-[2.5rem] shadow-2xl border border-white/5 relative overflow-hidden"
        >
          {/* Top Tabs */}
          <div className="flex bg-slate-950/50 p-1 rounded-2xl border border-white/5 mb-8">
            <button 
              onClick={() => { setIsLogin(true); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <LogIn className="w-4 h-4" /> Login
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <UserPlus className="w-4 h-4" /> Register
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-3"
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            <AnimatePresence mode="wait">
              {!isLogin && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2 overflow-hidden"
                >
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Duelist Name</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                    <input 
                      type="text"
                      required={!isLogin}
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Username..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="email"
                  required
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  placeholder="name@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Secret Key</label>
                {isLogin && (
                  <button type="button" className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest">Forgot?</button>
                )}
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="password"
                  required
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-50 disabled:grayscale text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-indigo-900/40 flex items-center justify-center gap-3 relative overflow-hidden"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? "Enter Simulation" : "Begin Journey"}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-[8px] font-black uppercase tracking-[0.3em]">
              <span className="bg-slate-900 px-4 text-slate-600">Digital Identity Verification</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full py-4 bg-white/5 hover:bg-white/10 text-slate-300 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border border-white/5 flex items-center justify-center gap-3 group"
          >
            <Chrome className="w-4 h-4 group-hover:text-indigo-400 transition-colors" />
            Continue with Google
          </button>

          <div className="mt-8 flex items-center justify-center gap-2 text-[9px] font-bold text-slate-600 uppercase tracking-widest">
            <ShieldCheck className="w-3 h-3 text-emerald-500/50" />
            Secure Neural Connection Encrypted
          </div>
        </motion.div>
      </div>
    </div>
  );
}
