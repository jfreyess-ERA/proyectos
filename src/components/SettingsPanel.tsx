'use client';
import { useEffect, useState } from 'react';
import { X, LogOut, Moon, Sun, Plus, Trash2, UserPlus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { avatarBg } from '@/lib/data';
import type { User } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

type Tab = 'profile' | 'users';

interface UserRow extends User {
  email?: string;
  is_admin?: boolean;
}

export function SettingsPanel({ open, onClose }: Props) {
  const { profile, signOut, session } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [dark, setDark] = useState(false);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '' });
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState(false);

  const isAdmin = profile?.is_admin;

  useEffect(() => {
    const stored = document.documentElement.getAttribute('data-theme') === 'dark';
    setDark(stored);
  }, [open]);

  useEffect(() => {
    if (!open || !isAdmin || tab !== 'users') return;
    fetchUsers();
  }, [open, isAdmin, tab]);

  async function fetchUsers() {
    if (!session?.access_token) return;
    setLoadingUsers(true);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (Array.isArray(data)) setUsers(data);
    } finally {
      setLoadingUsers(false);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormOk(false);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Error al crear usuario');
      } else {
        setFormOk(true);
        setForm({ name: '', email: '', role: '', password: '' });
        fetchUsers();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    await fetch(`/api/admin/users?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setUsers(prev => prev.filter(u => u.id !== id));
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,.25)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 400,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--line)',
          boxShadow: '-4px 0 24px rgba(0,0,0,.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--line)' }}
        >
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
            Configuración
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent"
            style={{ color: 'var(--ink-3)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div
            className="flex gap-[2px] px-5 py-3 border-b"
            style={{ borderColor: 'var(--line)' }}
          >
            {(['profile', 'users'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="h-7 px-3 rounded-[6px] text-[12.5px] font-medium border-0 transition-colors"
                style={{
                  background: tab === t ? 'var(--bg-3)' : 'transparent',
                  color: tab === t ? 'var(--ink)' : 'var(--ink-3)',
                }}
              >
                {t === 'profile' ? 'Mi perfil' : 'Usuarios'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">

          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <>
              {/* Avatar + info */}
              <div className="flex items-center gap-4">
                {profile && (
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-[15px] flex-shrink-0"
                    style={{ background: avatarBg(profile.hue) }}
                  >
                    {profile.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {profile?.name ?? '—'}
                  </div>
                  <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                    {profile?.role ?? '—'}
                  </div>
                  {profile?.email && (
                    <div className="text-[12px]" style={{ color: 'var(--ink-4)' }}>
                      {profile.email}
                    </div>
                  )}
                  {isAdmin && (
                    <span
                      className="inline-block mt-1 text-[10px] font-semibold px-2 py-px rounded-full"
                      style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}
                    >
                      Administrador
                    </span>
                  )}
                </div>
              </div>

              {/* Theme toggle */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>
                  Apariencia
                </div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3 py-[10px] rounded-[10px] border transition-colors text-left"
                  style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}
                >
                  <div
                    className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--bg-3)' }}
                  >
                    {dark ? <Moon size={15} style={{ color: 'var(--ink-2)' }} /> : <Sun size={15} style={{ color: 'var(--ink-2)' }} />}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>
                      {dark ? 'Modo oscuro' : 'Modo claro'}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      Click para cambiar
                    </div>
                  </div>
                </button>
              </div>

              {/* Sign out */}
              <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <button
                  onClick={async () => { await signOut(); window.location.replace('/login'); }}
                  className="flex items-center gap-2 w-full px-3 py-[10px] rounded-[10px] text-[13px] font-medium border-0 transition-colors"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}

          {/* ── Users tab (admin only) ── */}
          {tab === 'users' && isAdmin && (
            <>
              {/* User list */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                  Miembros del equipo
                </div>
                {loadingUsers ? (
                  <div className="text-[13px] py-4 text-center" style={{ color: 'var(--ink-4)' }}>Cargando…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {users.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 px-3 py-2 rounded-[8px]"
                        style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                          style={{ background: avatarBg(u.hue) }}
                        >
                          {u.initials}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                            {u.name}
                          </div>
                          <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                            {u.email ?? u.role}
                          </div>
                        </div>
                        {u.is_admin && (
                          <span className="text-[10px] font-semibold px-2 py-px rounded-full flex-shrink-0"
                            style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                            Admin
                          </span>
                        )}
                        {u.id !== profile?.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent flex-shrink-0"
                            style={{ color: 'var(--ink-4)' }}
                            title="Eliminar usuario"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Create user form */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>
                  Crear usuario
                </div>

                {formError && (
                  <div className="mb-3 px-3 py-2 rounded-[8px] text-[12px]"
                    style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                    {formError}
                  </div>
                )}
                {formOk && (
                  <div className="mb-3 px-3 py-2 rounded-[8px] text-[12px]"
                    style={{ background: 'oklch(0.96 0.03 160)', color: 'oklch(0.38 0.12 160)', border: '1px solid oklch(0.75 0.12 160)' }}>
                    Usuario creado correctamente.
                  </div>
                )}

                <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                  {[
                    { key: 'name', label: 'Nombre completo', type: 'text', placeholder: 'Ana García' },
                    { key: 'email', label: 'Email', type: 'email', placeholder: 'ana@empresa.com' },
                    { key: 'role', label: 'Cargo (opcional)', type: 'text', placeholder: 'Diseñadora' },
                    { key: 'password', label: 'Contraseña temporal', type: 'password', placeholder: '••••••••' },
                  ].map(field => (
                    <div key={field.key} className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-medium" style={{ color: 'var(--ink-3)' }}>
                        {field.label}
                      </label>
                      <input
                        type={field.type}
                        value={form[field.key as keyof typeof form]}
                        onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                        required={field.key !== 'role'}
                        placeholder={field.placeholder}
                        className="h-8 px-3 rounded-[7px] text-[12.5px] outline-none"
                        style={{
                          border: '1px solid var(--line)',
                          background: 'var(--bg)',
                          color: 'var(--ink)',
                          fontFamily: 'var(--font)',
                        }}
                      />
                    </div>
                  ))}

                  <button
                    type="submit"
                    disabled={creating}
                    className="h-8 rounded-[7px] text-[12.5px] font-semibold flex items-center justify-center gap-2 border-0 mt-1 transition-opacity"
                    style={{
                      background: 'var(--accent)',
                      color: 'var(--on-accent)',
                      opacity: creating ? 0.6 : 1,
                    }}
                  >
                    <UserPlus size={13} />
                    {creating ? 'Creando…' : 'Crear usuario'}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
