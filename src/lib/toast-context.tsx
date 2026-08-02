'use client';
import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { RotateCcw } from 'lucide-react';

interface UndoOpts {
  /** Texto del toast, p. ej. 'Tarea "X" eliminada'. */
  message: string;
  /** Ejecuta el borrado real. Se llama al expirar el toast, al deshacer otro, o al cerrar la app. */
  onCommit: () => void;
  /** Revierte el ocultamiento optimista en la UI. */
  onUndo?: () => void;
  /** Ventana para deshacer, en ms. */
  delay?: number;
}

interface Ctx { deleteWithUndo: (o: UndoOpts) => void; }

const ToastContext = createContext<Ctx | null>(null);

export function useToast(): Ctx {
  const c = useContext(ToastContext);
  if (!c) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return c;
}

/**
 * Deshacer para borrados, estilo Gmail. El borrado se DIFIERE: se oculta de la UI al
 * instante y el DELETE real recién corre cuando expira la ventana. Así el "deshacer" no
 * tiene que re-insertar la fila ni sus hijos en cascada — simplemente no se borró todavía.
 *
 * Un solo undo activo a la vez: si llega otro borrado, se confirma el anterior. Al cerrar
 * la app se confirma lo pendiente. (Si el navegador se cae dentro de la ventana, el ítem
 * reaparece — del lado seguro: nunca se pierde trabajo.)
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ message: string; delay: number; seq: number } | null>(null);
  const pending = useRef<UndoOpts | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const clearTimer = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };

  const flushPending = useCallback(() => {
    clearTimer();
    const p = pending.current; pending.current = null;
    p?.onCommit();
  }, []);

  const deleteWithUndo = useCallback((o: UndoOpts) => {
    // Si había uno pendiente, confirmarlo ya antes de arrancar el nuevo.
    if (pending.current) flushPending();
    pending.current = o;
    const delay = o.delay ?? 6000;
    seq.current += 1;
    setToast({ message: o.message, delay, seq: seq.current });
    timer.current = setTimeout(() => {
      const p = pending.current; pending.current = null;
      timer.current = null;
      setToast(null);
      p?.onCommit();
    }, delay);
  }, [flushPending]);

  const undo = useCallback(() => {
    clearTimer();
    const p = pending.current; pending.current = null;
    setToast(null);
    p?.onUndo?.();
  }, []);

  // Al desmontar el provider (cierre real de la app), confirmar lo pendiente.
  useEffect(() => () => { pending.current?.onCommit(); }, []);

  return (
    <ToastContext.Provider value={{ deleteWithUndo }}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed z-[100] left-1/2 bottom-6 -translate-x-1/2 flex items-center gap-3 pl-4 pr-2 h-11 rounded-[10px] overflow-hidden"
          style={{ background: 'var(--ink)', color: 'var(--surface)', boxShadow: 'var(--shadow-pop)', minWidth: 280, maxWidth: '92vw' }}
        >
          <span className="text-[13px] flex-1 truncate">{toast.message}</span>
          <button
            onClick={undo}
            className="flex items-center gap-1.5 h-8 px-3 rounded-[7px] text-[13px] font-medium border-0 flex-shrink-0"
            style={{ background: 'rgba(255,255,255,.14)', color: 'var(--surface)' }}
          >
            <RotateCcw size={13} /> Deshacer
          </button>
          {/* Barra que se agota en la ventana de deshacer. key por seq para reiniciar la animación. */}
          <span
            key={toast.seq}
            className="absolute left-0 bottom-0 h-[2px]"
            style={{ background: 'var(--accent)', width: '100%', animation: `era-undo-bar ${toast.delay}ms linear forwards` }}
          />
          <style>{`@keyframes era-undo-bar { from { width: 100%; } to { width: 0%; } }`}</style>
        </div>
      )}
    </ToastContext.Provider>
  );
}
