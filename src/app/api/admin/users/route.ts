import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function verifyAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return null;

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user?.email) return null;

  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('is_admin')
    .eq('email', user.email)
    .maybeSingle();

  return profile?.is_admin ? user : null;
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .order('name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { email, password, name, role } = body;

  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
  }

  // Create Supabase auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

  // Derive initials and a stable hue from name
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const hue = Math.abs(name.split('').reduce((h: number, c: string) => h * 31 + c.charCodeAt(0), 0) % 360);

  // Insert into public users table
  const id = authData.user.id;
  const { data: profile, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      id,
      name,
      role: role || 'Miembro del equipo',
      initials,
      hue,
      email,
      is_admin: false,
    })
    .select()
    .single();

  if (insertError) {
    // Clean up auth user if profile insert failed
    await supabaseAdmin.auth.admin.deleteUser(id);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(profile, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { id, name, role, is_admin, weekly_capacity_hours, password } = body;
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  // If only changing password, skip profile update
  if (password) {
    if (password.length < 6) return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(id, { password });
    if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });
    if (!name && !role && is_admin === undefined && weekly_capacity_hours === undefined) return NextResponse.json({ ok: true });
  }

  const fields: Record<string, unknown> = {};
  if (name  !== undefined) fields.name     = name;
  if (role  !== undefined) fields.role     = role;
  if (is_admin !== undefined) fields.is_admin = is_admin;
  if (weekly_capacity_hours !== undefined) fields.weekly_capacity_hours = weekly_capacity_hours;

  // Recalculate initials if name changed
  if (name) {
    const parts = name.trim().split(' ');
    fields.initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 });

  // Don't allow deleting yourself
  const { data: { user } } = await supabaseAdmin.auth.getUser(
    req.headers.get('authorization')!.replace('Bearer ', '')
  );
  if (user?.id === id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propia cuenta' }, { status: 400 });
  }

  await supabaseAdmin.from('users').delete().eq('id', id);
  await supabaseAdmin.auth.admin.deleteUser(id);

  return NextResponse.json({ ok: true });
}
