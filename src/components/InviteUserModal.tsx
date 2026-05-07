'use client';
import { useState } from 'react';
import { X, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  open: boolean;
  onClose: () => void;
  onInvited?: () => void;
}

const ROLES = [
  'Miembro del equipo',
  'Account Manager',
  'Consultor',
  'Analista',
  'Director',
  'Administrador',
];

export function InviteUserModal({ open, onClose, onInvited }: Props) {
  const [email, setEmail]   = useState('');
  const [name, setName]     = useState('');
  const [role, setRole]     = useState('Miembro del equipo');
  const [sending, setSending] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  function reset() {
    setEmail('');
    setName('');
    setRole('Miembro del equipo');
    setError('');
    setSuccess(false);
    setSending(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !name.trim()) return;
    setSending(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), role }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Error al enviar la invitación');
        return;
      }

      setSuccess(true);
      onInvited?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error de red');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const inp = "w-full h-9 px-3 rounded-[7px] text-[13px] outline-none";
  const inpStyle = {
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--ink)',
    fontFamily: 'var(--font)',
  };

  return (
    <div
      className="fixed inset-0 z-[70] grid place-items-center"
      style={{ background: 'rgba(20,18,12,.32)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          width: 'min(440px, 92vw)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-pop)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
          <div>
            <h2 className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>Invitar usuario</h2>
            <p className="text-[12px] mt-[2px]" style={{ color: 'var(--ink-3)' }}>
              El usuario recibirá un email para activar su cuenta
            </p>
          </div>
          <button
            onClick={() => { reset(); onClose(); }}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent"
            style={{ color: 'var(--ink-4)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          {success ? (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <CheckCircle size={40} style={{ color: 'oklch(0.55 0.14 160)' }} />
              <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                ¡Invitación enviada!
              </div>
              <div className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                Se envió un email de invitación a <strong>{email}</strong>
              </div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={reset}
                  className="h-8 px-4 rounded-[7px] text-[13px] border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                >
                  Invitar otro
                </button>
                <button
                  onClick={() => { reset(); onClose(); }}
                  className="h-8 px-4 rounded-[7px] text-[13px] font-medium border-0"
                  style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                >
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
                  Nombre completo *
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Juan Pérez"
                  className={inp}
                  style={inpStyle}
                  required
                />
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
                  Email corporativo *
                </label>
                <div className="relative">
                  <Mail size={13} className="absolute left-[10px] top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-4)' }} />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@eragroup.cl"
                    className={`${inp} pl-8`}
                    style={inpStyle}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-[12px] font-medium mb-1 block" style={{ color: 'var(--ink-2)' }}>
                  Rol en el equipo
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value)}
                  className={inp}
                  style={inpStyle}
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              {error && (
                <div
                  className="px-3 py-2 rounded-[7px] text-[12.5px]"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                >
                  {error}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={sending || !email.trim() || !name.trim()}
                  className="flex-1 h-9 rounded-[7px] text-[13px] font-medium border-0 flex items-center justify-center gap-2"
                  style={{
                    background: 'var(--accent)',
                    color: 'var(--on-accent)',
                    opacity: sending || !email.trim() || !name.trim() ? 0.6 : 1,
                  }}
                >
                  <Mail size={14} />
                  {sending ? 'Enviando…' : 'Enviar invitación'}
                </button>
                <button
                  type="button"
                  onClick={() => { reset(); onClose(); }}
                  className="h-9 px-4 rounded-[7px] text-[13px] border-0"
                  style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
