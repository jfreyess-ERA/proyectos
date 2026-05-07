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

export async function POST(req: NextRequest) {
  const admin = await verifyAdmin(req);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { email, name, role } = body;

  if (!email || !name) {
    return NextResponse.json({ error: 'Se requieren email y nombre' }, { status: 400 });
  }

  // Send Supabase invite email
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/login`,
  });

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 400 });

  const id = inviteData.user.id;

  // Derive initials and hue from name
  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const hue = Math.abs(name.split('').reduce((h: number, c: string) => h * 31 + c.charCodeAt(0), 0) % 360);

  // Upsert profile row (may already exist if invite was resent)
  const { data: profile, error: upsertError } = await supabaseAdmin
    .from('users')
    .upsert({
      id,
      name,
      role: role || 'Miembro del equipo',
      initials,
      hue,
      email,
      is_admin: false,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, profile }, { status: 201 });
}
