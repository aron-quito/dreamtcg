import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen, Swords, Zap, Layers } from 'lucide-react';

interface RulebookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PageType = 'CONCEPTOS' | 'INVOCACION' | 'FASES' | 'CADENAS';

export const RulebookModal: React.FC<RulebookModalProps> = ({ isOpen, onClose }) => {
  const [activePage, setActivePage] = useState<PageType>('CONCEPTOS');

  if (!isOpen) return null;

  const tabs = [
    { id: 'CONCEPTOS', label: 'Conceptos Básicos', icon: BookOpen },
    { id: 'INVOCACION', label: 'Invocaciones', icon: Swords },
    { id: 'FASES', label: 'Fases del Turno', icon: Layers },
    { id: 'CADENAS', label: 'Cadenas y SEGOC', icon: Zap },
  ];

  const renderContent = () => {
    switch (activePage) {
      case 'CONCEPTOS':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">1. Tipos de Cartas</h3>
              <ul className="list-disc pl-5 space-y-3 text-sm leading-relaxed text-slate-300">
                <li><strong className="text-white">Monstruos:</strong> Tienen Puntos de Ataque (ATK) y Defensa (DEF). Sirven para atacar al oponente o defender tus propios Life Points. Se juegan en las Zonas de Monstruos.</li>
                <li><strong className="text-white">Magias (Spell):</strong> Cartas de soporte que se activan desde la Mano (durante tu turno) o se pueden colocar boca abajo para activarlas después. Sus efectos suelen alterar el estado del juego y, tras resolverse, van al Cementerio.</li>
              </ul>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">2. Rarezas y Durabilidad</h3>
              <p className="text-sm leading-relaxed mb-3 text-slate-300">
                En DreamTCG, las cartas físicas sufren desgaste al participar en los duelos y perder. Cuando una carta llega a 0 de durabilidad, se rompe y desaparece de tu inventario (pero puedes reemplazarla por un proxy fantasma en tu mazo).
              </p>
              <ul className="list-none space-y-3 text-sm leading-relaxed">
                <li className="flex gap-2 items-start"><span className="text-indigo-400 font-bold mt-0.5">NORMAL:</span> <span className="text-slate-300">Durabilidad media (5 usos). Se desgasta normalmente al perder duelos. No recupera durabilidad.</span></li>
                <li className="flex gap-2 items-start"><span className="text-emerald-400 font-bold mt-0.5">SPECIAL:</span> <span className="text-slate-300">Alta durabilidad (8 usos). Recupera 1 punto de durabilidad por cada 3 victorias que consiga la carta.</span></li>
                <li className="flex gap-2 items-start"><span className="text-orange-400 font-bold mt-0.5">EPIC:</span> <span className="text-slate-300">Durabilidad masiva (15 usos). Recupera 1 punto de durabilidad por cada 2 victorias. Diseñada para aguantar muchas batallas.</span></li>
                <li className="flex gap-2 items-start"><span className="text-fuchsia-400 font-bold mt-0.5">ULTRA:</span> <span className="text-slate-300">Indestructible (∞ usos). No recibe daño de durabilidad al perder duelos. Poseen un número de serie único y coleccionable.</span></li>
              </ul>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">3. Life Points y Condición de Victoria</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Ambos jugadores comienzan con <strong>8000 LP (Life Points)</strong> y el jugador que comienza el duelo roba 5 cartas (el segundo roba 6). Ganas el duelo reduciendo los LP de tu oponente a 0, o si tu oponente debe robar una carta y su mazo está vacío (Deck Out).
              </p>
            </section>
          </div>
        );
      
      case 'INVOCACION':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">1. Invocación Normal</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Durante tu Main Phase, puedes realizar <strong>1 Invocación Normal por turno</strong>. Esto te permite colocar un monstruo desde tu mano al campo. Esta acción tiene Velocidad 1 (no inicia Cadena directamente, pero puede desencadenar efectos Trigger).
              </p>
            </section>

            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">2. Invocación por Sacrificio (Tribute Summon)</h3>
              <p className="text-sm leading-relaxed text-slate-300 mb-2">
                Los monstruos más poderosos requieren sacrificar a otros monstruos que ya controlas para poder ser invocados. Al igual que la Invocación Normal, solo puedes hacer 1 por turno (y consume tu Invocación Normal del turno).
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-300">
                <li><strong>Nivel 1 al 4:</strong> No requieren sacrificios.</li>
                <li><strong>Nivel 5 al 6:</strong> Requieren sacrificar 1 monstruo.</li>
                <li><strong>Nivel 7 o superior:</strong> Requieren sacrificar 2 monstruos.</li>
              </ul>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">3. Invocación Especial</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Las Invocaciones Especiales se realizan mediante los efectos de cartas (Magias, efectos de Monstruos). A diferencia de la Invocación Normal, no tienen límite por turno; puedes invocar especialmente tantas veces como tus cartas lo permitan.
              </p>
            </section>
          </div>
        );
        
      case 'FASES':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">1. Draw Phase & Standby Phase</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-slate-300">
                <li><strong className="text-white">Draw Phase:</strong> El jugador en turno roba 1 carta de su mazo (Excepto el jugador que va primero en el turno 1).</li>
                <li><strong className="text-white">Standby Phase:</strong> Fase de mantenimiento. Los efectos que dicen "Durante la Standby Phase" se resuelven aquí.</li>
              </ul>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">2. Main Phase</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Es el corazón del turno. Aquí puedes:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-sm mt-2 text-slate-300">
                <li>Realizar tu Invocación Normal / Sacrificio.</li>
                <li>Activar cartas Mágicas desde la mano.</li>
                <li>Colocar cartas boca abajo.</li>
                <li>Activar efectos de Ignición de monstruos (Velocidad 1).</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">3. Fases de Combate: Battle Phase o Dream Phase</h3>
              <p className="text-sm leading-relaxed text-slate-300 mb-2">
                Durante el turno, solo puedes elegir entrar a <strong>UNA</strong> fase de combate (tampoco se permite combate en el Turno 1).
              </p>
              <div className="space-y-4">
                <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <h4 className="font-bold text-red-400 mb-1">Battle Phase (Normal)</h4>
                  <p className="text-sm text-slate-300">
                    Eliges a tus monstruos en el campo uno por uno para atacar a los monstruos rivales. Si el rival no tiene monstruos, puedes atacar directo a sus Life Points. 
                  </p>
                </div>
                
                <div className="bg-slate-800/50 p-4 rounded-xl border border-indigo-700">
                  <h4 className="font-bold text-indigo-400 mb-1">Dream Phase (Especial)</h4>
                  <p className="text-sm text-slate-300">
                    Sacrificas tu Battle Phase convencional para realizar una "Invocación de Sueño". Eliges un Monstruo directamente desde tu <strong>MANO</strong>, el cual es invocado gratis (ignorando sacrificios y condiciones). Este monstruo <strong>ataca directamente a los Life Points</strong> (ignorando a los monstruos defensores). Sin embargo, <strong>todos sus efectos son negados</strong> (incluyendo los de daño por combate, Trigger, etc.). Al finalizar la fase, el monstruo es destruido y enviado al Cementerio.
                  </p>
                </div>
              </div>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">4. End Phase</h3>
              <p className="text-sm leading-relaxed text-slate-300">
                Fase de limpieza. Los efectos temporales ("hasta el final del turno") desaparecen, y el turno pasa al oponente.
              </p>
            </section>
          </div>
        );
        
      case 'CADENAS':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">1. Velocidades (Speeds)</h3>
              <p className="text-sm leading-relaxed mb-2 text-slate-300">
                Al activar un efecto, este se añade a una "Cadena". Cuando ambos jugadores deciden dejar de encadenar, la cadena resuelve en orden inverso (el último eslabón resuelve primero). No puedes encadenar un efecto de velocidad menor al último eslabón de la cadena.
              </p>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed">
                <li><strong className="text-yellow-400">Velocidad 1 (Ignición y Triggers):</strong> Inicio de cadenas. Los Triggers son automáticos si se cumplen sus condiciones. La Ignición es manual en tu Main Phase.</li>
                <li><strong className="text-yellow-400">Velocidad 2 (Efectos Rápidos):</strong> Pueden responder a efectos de V1 o V2. Se pueden activar en cualquier turno y en respuesta a la mayoría de acciones.</li>
                <li><strong className="text-yellow-400">Velocidad 3 (Contra-Efectos):</strong> Magias o Trampas extremadamente rápidas. Solo otra Velocidad 3 puede responder.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">2. Regla SEGOC</h3>
              <p className="text-sm leading-relaxed mb-2 text-slate-300">
                Simultaneous Effects Go On Chain (SEGOC) es el sistema que decide el orden cuando múltiples cartas cumplen su condición "Trigger" (Gatillo) exactamente al mismo tiempo (ej: si se destruyen 3 monstruos a la vez por un efecto).
              </p>
              <p className="text-sm leading-relaxed mb-2 text-slate-300">
                En vez de pelear por prioridad, el juego pone todos estos Triggers en la Cadena como Velocidad 1 en el siguiente orden estricto:
              </p>
              <ol className="list-decimal pl-5 space-y-2 text-sm leading-relaxed text-slate-300">
                <li>Efectos Triggers <span className="text-red-400 font-bold">[Obligatorio]</span> del <strong>Jugador en Turno</strong>.</li>
                <li>Efectos Triggers <span className="text-red-400 font-bold">[Obligatorio]</span> del <strong>Oponente</strong>.</li>
                <li>Efectos Triggers <span className="text-blue-400 font-bold">[Opcional]</span> del <strong>Jugador en Turno</strong>.</li>
                <li>Efectos Triggers <span className="text-blue-400 font-bold">[Opcional]</span> del <strong>Oponente</strong>.</li>
              </ol>
              <p className="text-sm mt-3 bg-indigo-900/30 p-3 rounded-lg border border-indigo-500/20 text-slate-300">
                Una vez que todos los Triggers se han apilado usando SEGOC, recién ahí los jugadores reciben prioridad para encadenar cartas de <strong>Velocidad 2</strong> en respuesta a todo este bloque de Triggers.
              </p>
            </section>
            
            <section>
              <h3 className="text-xl font-bold text-indigo-300 mb-3 border-b border-indigo-900/50 pb-2">3. Componentes del Texto</h3>
              <ul className="list-disc pl-5 space-y-2 text-sm leading-relaxed text-slate-300">
                <li><strong className="text-fuchsia-400">Único por Nombre:</strong> Si el efecto tiene esta etiqueta, solo podrás activarlo esa cantidad de veces por turno, sin importar si invocas otra copia idéntica de la carta en el mismo turno.</li>
                <li><strong className="text-indigo-400">Causa:</strong> Describe el detonante (Gatillo) y los Costos (como pagar LP, descartar cartas). <strong>Si se niega el efecto, los costos ya pagados NO se reembolsan.</strong></li>
                <li><strong className="text-emerald-500">Efecto:</strong> Lo que realmente ocurre cuando la cadena se resuelve. Si la carta es destruida antes de resolver, el efecto normalmente se resuelve igual (a menos que la carta requiera estar en el campo de forma explícita).</li>
              </ul>
            </section>
          </div>
        );
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[1000] flex justify-center items-center p-4 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col md:flex-row shadow-2xl relative overflow-hidden"
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Sidebar / Tabs */}
          <div className="w-full md:w-64 bg-slate-950/80 border-r border-slate-800 flex flex-col shrink-0">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center md:block">
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 uppercase tracking-widest drop-shadow-md">
                Guía del Juego
              </h2>
              <button 
                onClick={onClose}
                className="md:hidden text-slate-400 hover:text-white transition-colors bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-2 flex flex-row md:flex-col overflow-x-auto md:overflow-x-hidden">
              {tabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activePage === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePage(tab.id as PageType)}
                    className={`flex items-center gap-3 w-full p-3 rounded-xl transition-all font-bold tracking-wider uppercase text-xs md:text-sm whitespace-nowrap md:whitespace-normal
                      ${isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
          
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Desktop Close Button */}
            <button 
              onClick={onClose}
              className="hidden md:flex absolute top-6 right-6 text-slate-400 hover:text-white transition-colors bg-slate-800 hover:bg-slate-700 rounded-full w-10 h-10 items-center justify-center z-10 shadow-xl"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar-wide">
              {renderContent()}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
