import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user is an authorised agent
  const { data: agent, error: agentError } = await supabase
    .from('agents')
    .select('id, name, is_admin')
    .eq('gmail', user.email)
    .single()

  if (!agent) {
    await supabase.auth.signOut()
    const msg = agentError?.message ?? 'no-row'
    redirect(`/login?error=${encodeURIComponent(msg + ' | ' + (user.email ?? 'no-email'))}`)
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
