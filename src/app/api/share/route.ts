import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token requerido' }, { status: 400 });

  // Validate token + get project_id
  const { data: share } = await supabaseAdmin
    .from('project_shares')
    .select('project_id')
    .eq('token', token)
    .eq('active', true)
    .maybeSingle();

  if (!share) return NextResponse.json({ error: 'Enlace inválido o expirado' }, { status: 404 });

  // Fetch project
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('*')
    .eq('id', share.project_id)
    .single();

  // Fetch tasks
  const { data: tasks } = await supabaseAdmin
    .from('tasks')
    .select('*')
    .eq('project_id', share.project_id)
    .order('ref');

  return NextResponse.json({ project, tasks: tasks ?? [] });
}
