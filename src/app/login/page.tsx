'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.replace('/');
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-[360px] rounded-[16px] p-8"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          boxShadow: 'var(--shadow-2, 0 4px 24px rgba(0,0,0,.08))',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 mb-8">
          <img src="/era-logo-cropped.png" alt="ERA Group" className="h-[64px] w-auto object-contain" />
          <img src="/era-tagline-cropped.png" alt="value through insight" className="h-[16px] w-auto object-contain opacity-80" />
        </div>

        <h1 className="text-[20px] font-bold mb-1" style={{ color: 'var(--ink)' }}>
          Iniciar sesión
        </h1>
        <p className="text-[13px] mb-6" style={{ color: 'var(--ink-3)' }}>
          Ingresa con tu cuenta de equipo
        </p>

        {error && (
          <div
            className="mb-4 px-3 py-2 rounded-[8px] text-[13px]"
            style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="tu@email.com"
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none transition-colors"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[12px] font-medium" style={{ color: 'var(--ink-2)' }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="h-9 px-3 rounded-[8px] text-[13px] outline-none transition-colors"
              style={{
                border: '1px solid var(--line)',
                background: 'var(--bg-2)',
                color: 'var(--ink)',
                fontFamily: 'var(--font)',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="h-9 rounded-[8px] text-[13px] font-semibold mt-1 transition-opacity"
            style={{
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: 'none',
            }}
          >
            {loading ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-[11px] text-center mt-6" style={{ color: 'var(--ink-4)' }}>
          No tienes cuenta? Pide al administrador que te invite.
        </p>
      </div>
    </div>
  );
}
