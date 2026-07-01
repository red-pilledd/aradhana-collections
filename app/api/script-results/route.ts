import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = 'https://jkoiessoijpypwtnziea.supabase.co'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Called by magikdigi_collections.js after each run.
// Authenticated by SCRIPT_API_SECRET and writes with the service-role key, so it
// keeps working once Row-Level Security is enabled on script_results.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SCRIPT_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: 'Server is not configured' }, { status: 500 })
  }

  const body = await request.json()
  const date = body.date ?? new Date().toISOString().split('T')[0]

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await supabase
    .from('script_results')
    .upsert({ date, data: body, created_at: new Date().toISOString() }, { onConflict: 'date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
