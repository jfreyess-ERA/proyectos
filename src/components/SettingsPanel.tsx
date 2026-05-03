'use client';
import { useEffect, useState } from 'react';
import { X, LogOut, Moon, Sun, Trash2, UserPlus, Pencil, Check, ChevronDown } from 'lucide-react';
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
  const { profile, signOut, session, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [dark, setDark] = useState(false);

  // Profile editing
  const [profileName, setProfileName] = useState('');
  const [profileRole, setProfileRole] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileOk, setProfileOk] = useState(false);

  // User list
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, { name: string; role: string; is_admin: boolean }>>({});
  const [savingUser, setSavingUser] = useState<string | null>(null);

  // Create user form
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '' });
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isAdmin = profile?.is_admin;

  useEffect(() => {
    if (!open) return;
    setDark(document.documentElement.getAttribute('data-theme') === 'dark');
    setProfileName(profile?.name ?? '');
    setProfileRole(profile?.role ?? '');
    setProfileOk(false);
  }, [open, profile]);

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
      if (Array.isArray(data)) {
        setUsers(data);
        const forms: Record<string, { name: string; role: string; is_admin: boolean }> = {};
        data.forEach((u: UserRow) => {
          forms[u.id] = { name: u.name, role: u.role ?? '', is_admin: u.is_admin ?? false };
        });
        setEditForms(forms);
      }
    } finally {
      setLoadingUsers(false);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);
    setProfileOk(false);
    const parts = profileName.trim().split(' ');
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : profileName.slice(0, 2).toUpperCase();
    await supabase.from('users').update({ name: profileName, role: profileRole, initials }).eq('id', profile.id);
    await refreshProfile();
    setSavingProfile(false);
    setProfileOk(true);
  }

  async function handleSaveUser(id: string) {
    const f = editForms[id];
    if (!f) return;
    setSavingUser(id);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id, ...f }),
    });
    await fetchUsers();
    setSavingUser(null);
    setExpandedUser(null);
  }

  async function handleDeleteUser(id: string) {
    if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
    await fetch(`/api/admin/users?id=${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session?.access_token}` },
    });
    setUsers(prev => prev.filter(u => u.id !== id));
    setExpandedUser(null);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormOk(false);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Error al crear usuario');
      } else {
        setFormOk(true);
        setForm({ name: '', email: '', role: '', password: '' });
        setShowCreateForm(false);
        fetchUsers();
      }
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,.25)' }} onClick={onClose} />

      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{ width: 420, background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-4px 0 24px rgba(0,0,0,.1)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
          <span className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>Configuración</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-[6px] border-0 bg-transparent" style={{ color: 'var(--ink-3)' }}>
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        {isAdmin && (
          <div className="flex gap-[2px] px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--line)' }}>
            {(['profile', 'users'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="h-7 px-3 rounded-[6px] text-[12.5px] font-medium border-0 transition-colors"
                style={{ background: tab === t ? 'var(--bg-3)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--ink-3)' }}
              >
                {t === 'profile' ? 'Mi perfil' : 'Usuarios'}
              </button>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 min-h-0">

          {/* ── Profile tab ── */}
          {tab === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-4">
                {profile && (
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-[16px] flex-shrink-0"
                    style={{ background: avatarBg(profile.hue) }}
                  >
                    {profile.initials}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-[15px] font-semibold truncate" style={{ color: 'var(--ink)' }}>{profile?.name}</div>
                  <div className="text-[12px]" style={{ color: 'var(--ink-3)' }}>{profile?.email}</div>
                  {isAdmin && (
                    <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-px rounded-full" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                      Administrador
                    </span>
                  )}
                </div>
              </div>

              {/* Edit profile form */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>Editar perfil</div>
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                  {profileOk && (
                    <div className="px-3 py-2 rounded-[8px] text-[12px]" style={{ background: 'oklch(0.96 0.03 160)', color: 'oklch(0.38 0.12 160)', border: '1px solid oklch(0.75 0.12 160)' }}>
                      Perfil actualizado.
                    </div>
                  )}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-medium" style={{ color: 'var(--ink-3)' }}>Nombre completo</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={e => { setProfileName(e.target.value); setProfileOk(false); }}
                      required
                      className="h-8 px-3 rounded-[7px] text-[12.5px] outline-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[11.5px] font-medium" style={{ color: 'var(--ink-3)' }}>Cargo</label>
                    <input
                      type="text"
                      value={profileRole}
                      onChange={e => { setProfileRole(e.target.value); setProfileOk(false); }}
                      placeholder="Ej: Product Manager"
                      className="h-8 px-3 rounded-[7px] text-[12.5px] outline-none"
                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile || (profileName === profile?.name && profileRole === profile?.role)}
                    className="h-8 rounded-[7px] text-[12.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: savingProfile || (profileName === profile?.name && profileRole === profile?.role) ? 0.45 : 1 }}
                  >
                    <Check size={13} />
                    {savingProfile ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </form>
              </div>

              {/* Theme */}
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>Apariencia</div>
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3 py-[10px] rounded-[10px] border transition-colors text-left"
                  style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}
                >
                  <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-3)' }}>
                    {dark ? <Moon size={15} style={{ color: 'var(--ink-2)' }} /> : <Sun size={15} style={{ color: 'var(--ink-2)' }} />}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{dark ? 'Modo oscuro' : 'Modo claro'}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Click para cambiar</div>
                  </div>
                </button>
              </div>

              {/* Sign out */}
              <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <button
                  onClick={async () => { await signOut(); window.location.replace('/login'); }}
                  className="flex items-center gap-2 w-full px-3 py-[10px] rounded-[10px] text-[13px] font-medium border-0"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                >
                  <LogOut size={14} />
                  Cerrar sesión
                </button>
              </div>
            </>
          )}

          {/* ── Users tab ── */}
          {tab === 'users' && isAdmin && (
            <>
              {/* User list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                    Miembros ({users.length})
                  </div>
                  <button
                    onClick={() => { setShowCreateForm(f => !f); setFormError(''); setFormOk(false); }}
                    className="flex items-center gap-1 h-6 px-2 rounded-[6px] text-[11.5px] font-medium border-0 transition-colors"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
                  >
                    <UserPlus size={11} /> Nuevo
                  </button>
                </div>

                {/* Create form (collapsible) */}
                {showCreateForm && (
                  <div className="mb-4 p-4 rounded-[10px] flex flex-col gap-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                    <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)' }}>Crear usuario</div>
                    {formError && (
                      <div className="px-3 py-2 rounded-[8px] text-[11.5px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>{formError}</div>
                    )}
                    <form onSubmit={handleCreateUser} className="flex flex-col gap-2">
                      {[
                        { key: 'name',     label: 'Nombre',            type: 'text',     placeholder: 'Ana García' },
                        { key: 'email',    label: 'Email',             type: 'email',    placeholder: 'ana@empresa.com' },
                        { key: 'role',     label: 'Cargo (opcional)',   type: 'text',     placeholder: 'Diseñadora' },
                        { key: 'password', label: 'Contraseña inicial', type: 'password', placeholder: '••••••••' },
                      ].map(field => (
                        <div key={field.key} className="flex flex-col gap-[3px]">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{field.label}</label>
                          <input
                            type={field.type}
                            value={form[field.key as keyof typeof form]}
                            onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                            required={field.key !== 'role'}
                            placeholder={field.placeholder}
                            className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                            style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                          />
                        </div>
                      ))}
                      <div className="flex gap-2 mt-1">
                        <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 h-7 rounded-[6px] text-[12px] border-0" style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}>
                          Cancelar
                        </button>
                        <button type="submit" disabled={creating} className="flex-1 h-7 rounded-[6px] text-[12px] font-semibold border-0 transition-opacity" style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: creating ? 0.6 : 1 }}>
                          {creating ? 'Creando…' : 'Crear'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* User rows */}
                {loadingUsers ? (
                  <div className="text-[13px] py-4 text-center" style={{ color: 'var(--ink-4)' }}>Cargando…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {users.map(u => {
                      const isExpanded = expandedUser === u.id;
                      const ef = editForms[u.id] ?? { name: u.name, role: u.role, is_admin: u.is_admin ?? false };
                      const isSelf = u.id === profile?.id;
                      return (
                        <div
                          key={u.id}
                          className="rounded-[10px] overflow-hidden"
                          style={{ border: '1px solid var(--line)', background: isExpanded ? 'var(--bg-2)' : 'var(--surface)' }}
                        >
                          {/* Row header */}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                              style={{ background: avatarBg(u.hue) }}
                            >
                              {u.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{u.name}</div>
                              <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>{u.email ?? u.role}</div>
                            </div>
                            {u.is_admin && (
                              <span className="text-[10px] font-semibold px-2 py-px rounded-full flex-shrink-0" style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                Admin
                              </span>
                            )}
                            <button
                              onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent flex-shrink-0 transition-colors"
                              style={{ color: 'var(--ink-3)' }}
                              title="Editar"
                            >
                              {isExpanded ? <ChevronDown size={13} /> : <Pencil size={12} />}
                            </button>
                          </div>

                          {/* Expanded edit form */}
                          {isExpanded && (
                            <div className="px-3 pb-3 flex flex-col gap-2 border-t" style={{ borderColor: 'var(--line)' }}>
                              <div className="pt-2 flex flex-col gap-2">
                                <div className="flex gap-2">
                                  <div className="flex flex-col gap-[3px] flex-1">
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Nombre</label>
                                    <input
                                      type="text"
                                      value={ef.name}
                                      onChange={e => setEditForms(prev => ({ ...prev, [u.id]: { ...ef, name: e.target.value } }))}
                                      className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                                    />
                                  </div>
                                  <div className="flex flex-col gap-[3px] flex-1">
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Cargo</label>
                                    <input
                                      type="text"
                                      value={ef.role}
                                      onChange={e => setEditForms(prev => ({ ...prev, [u.id]: { ...ef, role: e.target.value } }))}
                                      className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }}
                                    />
                                  </div>
                                </div>

                                {/* Admin toggle — only if editing someone else */}
                                {!isSelf && (
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div
                                      className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                                      style={{ background: ef.is_admin ? 'var(--accent)' : 'var(--bg-3)' }}
                                      onClick={() => setEditForms(prev => ({ ...prev, [u.id]: { ...ef, is_admin: !ef.is_admin } }))}
                                    >
                                      <div
                                        className="absolute top-[2px] w-3 h-3 rounded-full transition-transform"
                                        style={{ background: 'white', left: ef.is_admin ? '18px' : '2px' }}
                                      />
                                    </div>
                                    <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>Administrador</span>
                                  </label>
                                )}

                                <div className="flex gap-2">
                                  {!isSelf && (
                                    <button
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="h-7 px-2 rounded-[6px] text-[11.5px] border-0 flex items-center gap-1"
                                      style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}
                                    >
                                      <Trash2 size={11} /> Eliminar
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleSaveUser(u.id)}
                                    disabled={savingUser === u.id}
                                    className="flex-1 h-7 rounded-[6px] text-[11.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: savingUser === u.id ? 0.6 : 1 }}
                                  >
                                    <Check size={11} />
                                    {savingUser === u.id ? 'Guardando…' : 'Guardar'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
