'use client';
import { useEffect, useState } from 'react';
import { X, LogOut, Moon, Sun, Trash2, UserPlus, Pencil, Check,
         ChevronDown, Mail, Eye, EyeOff, RefreshCw, KeyRound, Copy } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { avatarBg } from '@/lib/data';
import type { User } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onInviteUser?: () => void;
}

type Tab = 'profile' | 'users';

interface UserRow extends User {
  email?: string;
  is_admin?: boolean;
}

// ── Generador de contraseña segura ──────────────────────────────────────────
function generatePassword(length = 14): string {
  const upper  = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower  = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';
  const all = upper + lower + digits + special;
  // Garantiza al menos 1 de cada tipo
  const required = [
    upper[Math.floor(Math.random() * upper.length)],
    lower[Math.floor(Math.random() * lower.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)],
  ];
  const rest = Array.from({ length: length - 4 }, () => all[Math.floor(Math.random() * all.length)]);
  return [...required, ...rest].sort(() => Math.random() - 0.5).join('');
}

// ── Campo de contraseña con mostrar/ocultar + generar ──────────────────────
function PasswordField({
  value, onChange, placeholder = '••••••••', label, showGenerate = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label?: string;
  showGenerate?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);

  function generate() {
    const pw = generatePassword();
    onChange(pw);
    setShow(true);
  }

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-[3px]">
      {label && <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>{label}</label>}
      <div className="flex gap-1">
        <div className="relative flex-1">
          <input
            type={show ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full h-7 pl-2 pr-7 rounded-[6px] text-[12px] outline-none"
            style={{
              border: '1px solid var(--line)',
              background: 'var(--bg)',
              color: 'var(--ink)',
              fontFamily: show ? 'var(--font-mono)' : 'var(--font)',
              letterSpacing: show ? '0.03em' : undefined,
            }}
          />
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            tabIndex={-1}
            className="absolute right-[6px] top-1/2 -translate-y-1/2 border-0 bg-transparent p-0"
            style={{ color: 'var(--ink-4)' }}
            title={show ? 'Ocultar' : 'Mostrar'}
          >
            {show ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>

        {/* Copiar */}
        {value && (
          <button
            type="button"
            onClick={copy}
            className="h-7 px-2 rounded-[6px] border-0 flex items-center gap-1 text-[11px] transition-colors"
            style={{ background: copied ? 'oklch(0.95 0.06 160)' : 'var(--bg-3)', color: copied ? 'oklch(0.38 0.12 160)' : 'var(--ink-3)' }}
            title="Copiar contraseña"
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
          </button>
        )}

        {/* Generar */}
        {showGenerate && (
          <button
            type="button"
            onClick={generate}
            className="h-7 px-2 rounded-[6px] border-0 flex items-center gap-1 text-[11px]"
            style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
            title="Generar contraseña segura"
          >
            <RefreshCw size={11} />
            Generar
          </button>
        )}
      </div>
      {show && value && (
        <div className="text-[10.5px] mt-[2px]" style={{ color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          {value}
        </div>
      )}
    </div>
  );
}

export function SettingsPanel({ open, onClose, onInviteUser }: Props) {
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
  const [usersError, setUsersError] = useState('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, { name: string; role: string; is_admin: boolean }>>({});
  const [savingUser, setSavingUser] = useState<string | null>(null);

  // Per-user password change (admin panel)
  const [pwForms, setPwForms] = useState<Record<string, string>>({});
  const [savingPw, setSavingPw] = useState<string | null>(null);
  const [pwOk, setPwOk] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<Record<string, string>>({});

  // Own password change (profile tab)
  const [ownPw, setOwnPw] = useState('');
  const [savingOwnPw, setSavingOwnPw] = useState(false);
  const [ownPwOk, setOwnPwOk] = useState(false);
  const [ownPwErr, setOwnPwErr] = useState('');

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
    if (!session?.access_token) {
      setUsersError('Sin sesión activa');
      return;
    }
    setLoadingUsers(true);
    setUsersError('');
    try {
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setUsersError(`Error ${res.status}: ${data?.error ?? 'desconocido'}`);
        return;
      }
      if (Array.isArray(data)) {
        setUsers(data);
        const forms: Record<string, { name: string; role: string; is_admin: boolean }> = {};
        data.forEach((u: UserRow) => {
          forms[u.id] = { name: u.name, role: u.role ?? '', is_admin: u.is_admin ?? false };
        });
        setEditForms(forms);
      }
    } catch (e: unknown) {
      setUsersError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoadingUsers(false);
    }
  }

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    const val = next ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', val);
    try { localStorage.setItem('era-theme', val); } catch (_) {}
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !session?.access_token) return;
    setSavingProfile(true);
    setProfileOk(false);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ name: profileName, role: profileRole }),
      });
      if (!res.ok) { const d = await res.json(); console.error(d.error); return; }
      await refreshProfile();
      setProfileOk(true);
    } finally {
      setSavingProfile(false);
    }
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

  async function handleChangePassword(id: string) {
    const pw = pwForms[id] ?? '';
    if (pw.length < 6) {
      setPwErr(prev => ({ ...prev, [id]: 'Mínimo 6 caracteres' }));
      return;
    }
    setSavingPw(id);
    setPwErr(prev => ({ ...prev, [id]: '' }));
    setPwOk(null);
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ id, password: pw }),
    });
    setSavingPw(null);
    if (res.ok) {
      setPwOk(id);
      setPwForms(prev => ({ ...prev, [id]: '' }));
      setTimeout(() => setPwOk(null), 3000);
    } else {
      const d = await res.json();
      setPwErr(prev => ({ ...prev, [id]: d.error ?? 'Error al cambiar contraseña' }));
    }
  }

  async function handleChangeOwnPassword() {
    if (ownPw.length < 6) { setOwnPwErr('Mínimo 6 caracteres'); return; }
    setSavingOwnPw(true);
    setOwnPwErr('');
    setOwnPwOk(false);
    try {
      const { supabase } = await import('@/lib/supabase');
      const { error } = await supabase.auth.updateUser({ password: ownPw });
      if (error) { setOwnPwErr(error.message); }
      else { setOwnPwOk(true); setOwnPw(''); setTimeout(() => setOwnPwOk(false), 3000); }
    } finally {
      setSavingOwnPw(false);
    }
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
        style={{ width: 440, background: 'var(--surface)', borderLeft: '1px solid var(--line)', boxShadow: '-4px 0 24px rgba(0,0,0,.1)' }}
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
              <button key={t} onClick={() => setTab(t)}
                className="h-7 px-3 rounded-[6px] text-[12.5px] font-medium border-0 transition-colors"
                style={{ background: tab === t ? 'var(--bg-3)' : 'transparent', color: tab === t ? 'var(--ink)' : 'var(--ink-3)' }}>
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
              <div className="flex items-center gap-4">
                {profile && (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-[16px] flex-shrink-0"
                    style={{ background: avatarBg(profile.hue) }}>
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

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>Editar perfil</div>
                <form onSubmit={handleSaveProfile} className="flex flex-col gap-3">
                  {profileOk && (
                    <div className="px-3 py-2 rounded-[8px] text-[12px]" style={{ background: 'oklch(0.96 0.03 160)', color: 'oklch(0.38 0.12 160)', border: '1px solid oklch(0.75 0.12 160)' }}>
                      Perfil actualizado.
                    </div>
                  )}
                  {[
                    { label: 'Nombre completo', value: profileName, onChange: (v: string) => { setProfileName(v); setProfileOk(false); }, placeholder: '' },
                    { label: 'Cargo', value: profileRole, onChange: (v: string) => { setProfileRole(v); setProfileOk(false); }, placeholder: 'Ej: Product Manager' },
                  ].map(f => (
                    <div key={f.label} className="flex flex-col gap-1">
                      <label className="text-[11.5px] font-medium" style={{ color: 'var(--ink-3)' }}>{f.label}</label>
                      <input type="text" value={f.value} onChange={e => f.onChange(e.target.value)}
                        placeholder={f.placeholder} required={f.label === 'Nombre completo'}
                        className="h-8 px-3 rounded-[7px] text-[12.5px] outline-none"
                        style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                    </div>
                  ))}
                  <button type="submit"
                    disabled={savingProfile || (profileName === profile?.name && profileRole === profile?.role)}
                    className="h-8 rounded-[7px] text-[12.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: savingProfile || (profileName === profile?.name && profileRole === profile?.role) ? 0.45 : 1 }}>
                    <Check size={13} />{savingProfile ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </form>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--ink-4)' }}>Cambiar contraseña</div>
                <div className="flex flex-col gap-2">
                  <PasswordField
                    value={ownPw}
                    onChange={v => { setOwnPw(v); setOwnPwErr(''); setOwnPwOk(false); }}
                    placeholder="Nueva contraseña"
                    label="Nueva contraseña"
                  />
                  {ownPwErr && <div className="text-[11.5px]" style={{ color: 'var(--danger)' }}>{ownPwErr}</div>}
                  {ownPwOk && <div className="text-[11.5px]" style={{ color: 'oklch(0.55 0.14 160)' }}>✓ Contraseña actualizada</div>}
                  <button
                    onClick={handleChangeOwnPassword}
                    disabled={savingOwnPw || ownPw.length < 6}
                    className="h-8 rounded-[7px] text-[12.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: savingOwnPw || ownPw.length < 6 ? 0.45 : 1 }}
                  >
                    <KeyRound size={13} />{savingOwnPw ? 'Guardando…' : 'Actualizar contraseña'}
                  </button>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--ink-4)' }}>Apariencia</div>
                <button onClick={toggleTheme}
                  className="flex items-center gap-3 w-full px-3 py-[10px] rounded-[10px] border transition-colors text-left"
                  style={{ border: '1px solid var(--line)', background: 'var(--bg-2)' }}>
                  <div className="w-8 h-8 rounded-[8px] flex items-center justify-center flex-shrink-0" style={{ background: 'var(--bg-3)' }}>
                    {dark ? <Moon size={15} style={{ color: 'var(--ink-2)' }} /> : <Sun size={15} style={{ color: 'var(--ink-2)' }} />}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--ink)' }}>{dark ? 'Modo oscuro' : 'Modo claro'}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>Click para cambiar</div>
                  </div>
                </button>
              </div>

              <div className="mt-auto pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <button onClick={async () => { await signOut(); window.location.replace('/login'); }}
                  className="flex items-center gap-2 w-full px-3 py-[10px] rounded-[10px] text-[13px] font-medium border-0"
                  style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                  <LogOut size={14} />Cerrar sesión
                </button>
              </div>
            </>
          )}

          {/* ── Users tab ── */}
          {tab === 'users' && isAdmin && (
            <>
              {usersError && (
                <div className="px-3 py-2 rounded-[8px] text-[12px] mb-3" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                  {usersError}
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ink-4)' }}>
                    Miembros ({users.length})
                  </div>
                  <div className="flex items-center gap-2">
                    {onInviteUser && (
                      <button onClick={onInviteUser}
                        className="flex items-center gap-1 h-6 px-2 rounded-[6px] text-[11.5px] font-medium border-0"
                        style={{ background: 'var(--bg-3)', color: 'var(--ink-2)', border: '1px solid var(--line)' }}
                        title="Invitar por email">
                        <Mail size={11} /> Invitar
                      </button>
                    )}
                    <button
                      onClick={() => { setShowCreateForm(f => !f); setFormError(''); setFormOk(false); }}
                      className="flex items-center gap-1 h-6 px-2 rounded-[6px] text-[11.5px] font-medium border-0"
                      style={{ background: showCreateForm ? 'var(--bg-3)' : 'var(--accent)', color: showCreateForm ? 'var(--ink-2)' : 'var(--on-accent)' }}>
                      <UserPlus size={11} /> {showCreateForm ? 'Cancelar' : 'Nuevo'}
                    </button>
                  </div>
                </div>

                {/* ── Crear usuario ── */}
                {showCreateForm && (
                  <div className="mb-4 p-4 rounded-[10px] flex flex-col gap-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)' }}>
                    <div className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>Nuevo usuario</div>
                    {formError && (
                      <div className="px-3 py-2 rounded-[8px] text-[11.5px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                        {formError}
                      </div>
                    )}
                    <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-[3px] flex-1">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Nombre *</label>
                          <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            required placeholder="Ana García"
                            className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                            style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                        </div>
                        <div className="flex flex-col gap-[3px] flex-1">
                          <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Cargo</label>
                          <input type="text" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                            placeholder="Diseñadora"
                            className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                            style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                        </div>
                      </div>
                      <div className="flex flex-col gap-[3px]">
                        <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Email *</label>
                        <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                          required placeholder="ana@empresa.com"
                          className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                          style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                      </div>
                      <PasswordField
                        label="Contraseña inicial *"
                        value={form.password}
                        onChange={v => setForm(f => ({ ...f, password: v }))}
                        placeholder="Mínimo 6 caracteres"
                      />
                      <div className="text-[10.5px] px-1" style={{ color: 'var(--ink-4)' }}>
                        💡 Usa "Generar" para crear una contraseña segura y cópiala antes de guardar.
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setShowCreateForm(false)}
                          className="flex-1 h-7 rounded-[6px] text-[12px] border-0"
                          style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}>
                          Cancelar
                        </button>
                        <button type="submit" disabled={creating || !form.password || !form.name || !form.email}
                          className="flex-1 h-7 rounded-[6px] text-[12px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                          style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: creating || !form.password || !form.name || !form.email ? 0.5 : 1 }}>
                          <UserPlus size={12} />{creating ? 'Creando…' : 'Crear usuario'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ── Lista usuarios ── */}
                {loadingUsers ? (
                  <div className="text-[13px] py-4 text-center" style={{ color: 'var(--ink-4)' }}>Cargando…</div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {users.map(u => {
                      const isExpanded = expandedUser === u.id;
                      const ef = editForms[u.id] ?? { name: u.name, role: u.role ?? '', is_admin: u.is_admin ?? false };
                      const isSelf = u.id === profile?.id;
                      const userPwErr = pwErr[u.id] ?? '';
                      const isChangingPw = !!pwForms[u.id];

                      return (
                        <div key={u.id} className="rounded-[10px] overflow-hidden"
                          style={{ border: '1px solid var(--line)', background: isExpanded ? 'var(--bg-2)' : 'var(--surface)' }}>

                          {/* Fila resumen */}
                          <div className="flex items-center gap-3 px-3 py-2">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-semibold flex-shrink-0"
                              style={{ background: avatarBg(u.hue) }}>
                              {u.initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--ink)' }}>{u.name}</div>
                              <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>{u.email ?? u.role}</div>
                            </div>
                            {u.is_admin && (
                              <span className="text-[10px] font-semibold px-2 py-px rounded-full flex-shrink-0"
                                style={{ background: 'var(--accent-bg)', color: 'var(--accent)' }}>
                                Admin
                              </span>
                            )}
                            <button
                              onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                              className="w-6 h-6 flex items-center justify-center rounded-[5px] border-0 bg-transparent flex-shrink-0"
                              style={{ color: 'var(--ink-3)' }}
                              title="Editar">
                              {isExpanded ? <ChevronDown size={13} /> : <Pencil size={12} />}
                            </button>
                          </div>

                          {/* Formulario expandido */}
                          {isExpanded && (
                            <div className="px-3 pb-4 flex flex-col gap-4 border-t" style={{ borderColor: 'var(--line)' }}>

                              {/* Datos básicos */}
                              <div className="pt-3 flex flex-col gap-2">
                                <div className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                                  Datos del usuario
                                </div>
                                <div className="flex gap-2">
                                  <div className="flex flex-col gap-[3px] flex-1">
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Nombre</label>
                                    <input type="text" value={ef.name}
                                      onChange={e => setEditForms(p => ({ ...p, [u.id]: { ...ef, name: e.target.value } }))}
                                      className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                                  </div>
                                  <div className="flex flex-col gap-[3px] flex-1">
                                    <label className="text-[11px] font-medium" style={{ color: 'var(--ink-3)' }}>Cargo</label>
                                    <input type="text" value={ef.role}
                                      onChange={e => setEditForms(p => ({ ...p, [u.id]: { ...ef, role: e.target.value } }))}
                                      className="h-7 px-2 rounded-[6px] text-[12px] outline-none"
                                      style={{ border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)', fontFamily: 'var(--font)' }} />
                                  </div>
                                </div>

                                {!isSelf && (
                                  <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <div className="relative w-8 h-4 rounded-full transition-colors flex-shrink-0"
                                      style={{ background: ef.is_admin ? 'var(--accent)' : 'var(--bg-3)' }}
                                      onClick={() => setEditForms(p => ({ ...p, [u.id]: { ...ef, is_admin: !ef.is_admin } }))}>
                                      <div className="absolute top-[2px] w-3 h-3 rounded-full transition-all"
                                        style={{ background: 'white', left: ef.is_admin ? '18px' : '2px' }} />
                                    </div>
                                    <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>Administrador</span>
                                  </label>
                                )}

                                <div className="flex gap-2 pt-1">
                                  {!isSelf && (
                                    <button onClick={() => handleDeleteUser(u.id)}
                                      className="h-7 px-2 rounded-[6px] text-[11.5px] border-0 flex items-center gap-1"
                                      style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                                      <Trash2 size={11} /> Eliminar
                                    </button>
                                  )}
                                  <button onClick={() => handleSaveUser(u.id)} disabled={savingUser === u.id}
                                    className="flex-1 h-7 rounded-[6px] text-[11.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                                    style={{ background: 'var(--accent)', color: 'var(--on-accent)', opacity: savingUser === u.id ? 0.6 : 1 }}>
                                    <Check size={11} />{savingUser === u.id ? 'Guardando…' : 'Guardar datos'}
                                  </button>
                                </div>
                              </div>

                              {/* Cambiar contraseña */}
                              <div className="pt-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--line)' }}>
                                <div className="flex items-center gap-2">
                                  <KeyRound size={12} style={{ color: 'var(--ink-4)' }} />
                                  <span className="text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-4)' }}>
                                    Cambiar contraseña
                                  </span>
                                </div>

                                {pwOk === u.id && (
                                  <div className="px-3 py-2 rounded-[7px] text-[11.5px]" style={{ background: 'oklch(0.96 0.03 160)', color: 'oklch(0.38 0.12 160)', border: '1px solid oklch(0.75 0.12 160)' }}>
                                    ✓ Contraseña actualizada correctamente
                                  </div>
                                )}
                                {userPwErr && (
                                  <div className="px-3 py-2 rounded-[7px] text-[11.5px]" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                                    {userPwErr}
                                  </div>
                                )}

                                <PasswordField
                                  value={pwForms[u.id] ?? ''}
                                  onChange={v => { setPwForms(p => ({ ...p, [u.id]: v })); setPwErr(p => ({ ...p, [u.id]: '' })); }}
                                  placeholder="Nueva contraseña"
                                />

                                <button
                                  onClick={() => handleChangePassword(u.id)}
                                  disabled={savingPw === u.id || !isChangingPw}
                                  className="h-7 rounded-[6px] text-[11.5px] font-semibold border-0 flex items-center justify-center gap-1 transition-opacity"
                                  style={{ background: 'oklch(0.55 0.14 245)', color: 'white', opacity: savingPw === u.id || !isChangingPw ? 0.4 : 1 }}>
                                  <KeyRound size={11} />
                                  {savingPw === u.id ? 'Actualizando…' : 'Actualizar contraseña'}
                                </button>

                                <div className="text-[10.5px]" style={{ color: 'var(--ink-4)' }}>
                                  💡 Usa "Generar" para crear una contraseña segura. Cópiala antes de guardar.
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
