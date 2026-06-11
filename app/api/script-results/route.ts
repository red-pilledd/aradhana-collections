import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Called by magikdigi_collections.js after each run
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.SCRIPT_API_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const today = new Date().toISOString().split('T')[0]

  const supabase = await createClient()
  const { error } = await supabase
    .from('script_results')
    .upsert({ date: today, data: body, created_at: new Date().toISOString() }, { onConflict: 'date' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
