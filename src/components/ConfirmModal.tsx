import React from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onClose?: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  onClose,
  variant = 'info'
}) => {
  if (!isOpen) return null;

  const handleClose = onClose || onCancel;

  const variants = {
    danger: {
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      border: 'border-red-500/30',
      glow: 'shadow-[0_0_30px_rgba(239,68,68,0.15)]',
      confirmBtn: 'bg-red-600 hover:bg-red-500 text-white'
    },
    warning: {
      icon: <AlertCircle className="w-8 h-8 text-amber-500" />,
      border: 'border-amber-500/30',
      glow: 'shadow-[0_0_30px_rgba(245,158,11,0.15)]',
      confirmBtn: 'bg-amber-600 hover:bg-amber-500 text-amber-950 font-black'
    },
    info: {
      icon: <CheckCircle2 className="w-8 h-8 text-indigo-500" />,
      border: 'border-indigo-500/30',
      glow: 'shadow-[0_0_30px_rgba(79,70,229,0.15)]',
      confirmBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white'
    }
  };

  const v = variants[variant];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={handleClose}
      />
      
      {/* Modal Card */}
      <div className={`relative w-full max-w-md bg-slate-900 border ${v.border} rounded-3xl p-8 ${v.glow} animate-in zoom-in-95 fade-in duration-300 overflow-hidden`}>
        {/* Subtle Gradient Background */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex flex-col items-center text-center">
          <div className="mb-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner">
            {v.icon}
          </div>
          
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">
            {title}
          </h2>
          
          <p className="text-slate-400 text-sm leading-relaxed mb-8">
            {message}
          </p>

          <div className="flex w-full gap-3">
            <button 
              onClick={onCancel}
              className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition-all active:scale-95 border border-slate-700/50"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm}
              className={`flex-1 px-6 py-3 ${v.confirmBtn} font-black uppercase text-[11px] tracking-widest rounded-xl transition-all active:scale-95 shadow-xl`}
            >
              {confirmText}
            </button>
          </div>
        </div>

        <button 
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
