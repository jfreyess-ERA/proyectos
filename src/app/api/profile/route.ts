import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function PATCH(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user?.email) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });

  const { name, role } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Nombre requerido' }, { status: 400 });

  const parts = name.trim().split(' ');
  const initials = parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.trim().slice(0, 2).toUpperCase();

  const { error } = await supabaseAdmin
    .from('users')
    .update({ name: name.trim(), role: role ?? '', initials })
    .eq('email', user.email);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
