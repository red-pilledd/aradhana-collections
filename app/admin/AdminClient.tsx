'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Agent = { id: string; name: string; gmail: string }
type Entry = { id: string; amount: number; note: string | null; created_at: string; agent_id: string; agents: { name: string } | null }
type ScriptResult = { data: unknown; created_at: string } | null

export default function AdminClient({
  agents,
  todayEntries,
  scriptResult,
}: {
  agents: Agent[]
  todayEntries: Entry[]
  scriptResult: ScriptResult
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'today' | 'agents'>('today')
  const [newName, setNewName] = useState('')
  const [newGmail, setNewGmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [agentList, setAgentList] = useState(agents)
  const [agentError, setAgentError] = useState('')

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function addAgent(e: React.FormEvent) {
    e.preventDefault()
    setAgentError('')
    if (!newName.trim() || !newGmail.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('agents')
      .insert({ name: newName.trim(), gmail: newGmail.trim().toLowerCase(), is_admin: false })
      .select('id, name, gmail')
      .single()
    if (error) { setAgentError('Failed to add. Gmail may already exist.'); setSaving(false); return }
    setAgentList([...agentList, data])
    setNewName('')
    setNewGmail('')
    setSaving(false)
  }

  async function removeAgent(id: string) {
    if (!confirm('Remove this agent?')) return
    const supabase = createClient()
    await supabase.from('agents').delete().eq('id', id)
    setAgentList(agentList.filter(a => a.id !== id))
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const cashTotal = todayEntries.reduce((s, e) => s + e.amount, 0)

  // Group today entries by agent
  const byAgent: Record<string, { name: string; total: number; entries: Entry[] }> = {}
  for (const e of todayEntries) {
    const name = e.agents?.name ?? 'Unknown'
    if (!byAgent[e.agent_id]) byAgent[e.agent_id] = { name, total: 0, entries: [] }
    byAgent[e.agent_id].total += e.amount
    byAgent[e.agent_id].entries.push(e)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">Aradhana Admin</h1>
          <p className="text-sm text-gray-500">Collections overview</p>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-red-500">Sign out</button>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex gap-2">
          {(['today', 'agents'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            >
              {t === 'today' ? "Today's Collections" : 'Manage Agents'}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div className="space-y-4">
            {/* Summary bar */}
            <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-6">
              <div>
                <p className="text-xs text-gray-500">Cash Handed In</p>
                <p className="text-xl font-bold text-gray-900">₹{cashTotal.toLocaleString('en-IN')}</p>
              </div>
              {scriptResult && (
                <div>
                  <p className="text-xs text-gray-500">Online Collections (script)</p>
                  <p className="text-xl font-bold text-green-700">
                    ₹{(typeof scriptResult.data === 'object' && scriptResult.data !== null && 'total' in scriptResult.data
                      ? (scriptResult.data as { total: number }).total
                      : 0
                    ).toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>

            {/* Per-agent breakdown */}
            {Object.keys(byAgent).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-gray-400 text-center">No cash entries today yet.</div>
            ) : (
              Object.values(byAgent).map(ag => (
                <div key={ag.name} className="bg-white rounded-2xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-800">{ag.name}</h3>
                    <span className="text-sm font-semibold text-gray-900">₹{ag.total.toLocaleString('en-IN')}</span>
                  </div>
                  <ul className="divide-y divide-gray-100">
                    {ag.entries.map(e => (
                      <li key={e.id} className="py-2 flex justify-between text-sm">
                        <div>
                          <span className="text-gray-900">₹{e.amount.toLocaleString('en-IN')}</span>
                          {e.note && <span className="text-gray-400 ml-2">{e.note}</span>}
                        </div>
                        <span className="text-gray-400">{formatDate(e.created_at)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'agents' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Add Agent</h2>
              <form onSubmit={addAgent} className="space-y-3">
                <input
                  type="text"
                  placeholder="Full name"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <input
                  type="email"
                  placeholder="Gmail address"
                  value={newGmail}
                  onChange={e => setNewGmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                {agentError && <p className="text-red-500 text-sm">{agentError}</p>}
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {saving ? 'Adding...' : 'Add Agent'}
                </button>
              </form>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-semibold text-gray-800 mb-4">Current Agents ({agentList.length})</h2>
              {agentList.length === 0 ? (
                <p className="text-sm text-gray-400">No agents added yet.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {agentList.map(a => (
                    <li key={a.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{a.name}</p>
                        <p className="text-xs text-gray-400">{a.gmail}</p>
                      </div>
                      <button
                        onClick={() => removeAgent(a.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
