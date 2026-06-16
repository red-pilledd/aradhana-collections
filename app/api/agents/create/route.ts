import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = 'https://jkoiessoijpypwtnziea.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb2llc3NvaWpweXB3dG56aWVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTE2NDgwMywiZXhwIjoyMDk2NzQwODAzfQ.S91gwemXYWyUouy936UuvOzXlufrbodB9twyaV9H_Zw'

export async function POST(request: NextRequest) {
  const { name, username, password } = await request.json()

  if (!name || !username || !password) {
    return NextResponse.json({ error: 'Name, username and password are required' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const fakeEmail = `${username.trim().toLowerCase()}@aradhana.local`

  // 1. Create auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: fakeEmail,
    password: password,
    email_confirm: true,
    user_metadata: { name, username: username.trim().toLowerCase() }
  })

  if (authError) {
    if (authError.message?.includes('already been registered')) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: authError.message }, { status: 500 })
  }

  // 2. Insert into agents table
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .insert({
      name: name.trim(),
      gmail: fakeEmail,
      is_admin: false,
    })
    .select('id, name, gmail')
    .single()

  if (agentError) {
    // Rollback: delete the auth user if agents insert fails
    await supabase.auth.admin.deleteUser(authUser.user.id)
    return NextResponse.json({ error: 'Failed to create agent record: ' + agentError.message }, { status: 500 })
  }

  return NextResponse.json({ agent, username: username.trim().toLowerCase() })
}
