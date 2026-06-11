import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user is an authorised agent
  const { data: agent } = await supabase
    .from('agents')
    .select('id, name, is_admin')
    .eq('gmail', user.email)
    .single()

  if (!agent) {
    // Not an authorised user
    await supabase.auth.signOut()
    redirect('/login?error=not_authorised')
  }

  if (agent.is_admin) {
    redirect('/admin')
  }

  // Fetch this agent's entries (latest 30)
  const { data: entries } = await supabase
    .from('cash_entries')
    .select('id, amount, note, created_at')
    .eq('agent_id', agent.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return <DashboardClient agent={agent} entries={entries ?? []} />
}
