import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: admin } = await supabase
    .from('agents')
    .select('id, name, is_admin')
    .eq('gmail', user.email)
    .single()

  if (!admin?.is_admin) redirect('/dashboard')

  // All agents (non-admin)
  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, gmail')
    .eq('is_admin', false)
    .order('name')

  // Today's entries with agent names
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data: todayEntriesRaw } = await supabase
    .from('cash_entries')
    .select('id, amount, note, created_at, agent_id, agents(name)')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  const todayEntries = (todayEntriesRaw ?? []).map(e => ({
    ...e,
    agents: Array.isArray(e.agents) ? (e.agents[0] ?? null) : e.agents,
  }))

  // Script results for today
  const todayStr = today.toISOString().split('T')[0]
  const { data: scriptResult } = await supabase
    .from('script_results')
    .select('data, created_at')
    .eq('date', todayStr)
    .single()

  return (
    <AdminClient
      agents={agents ?? []}
      todayEntries={todayEntries}
      scriptResult={scriptResult ?? null}
    />
  )
}
