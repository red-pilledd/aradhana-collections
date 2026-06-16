'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Agent = { id: string; name: string; gmail: string }
type Entry = { id: string; amount: number; note: string | null; created_at: string; agent_id: string; agents: { name: string } | null }
type ScriptData = {
  grandTotal?: number
  cableTotal?: number
  kvTotal?: number
  upiTotal?: number
  cashInHand?: number
  empAgg?: Record<string, { customers: number; digitalTV: number; broadband: number }>
  perAccount?: Record<string, { count: number; amount: number }>
  kvPerAccount?: Record<string, { count: number; amount: number }>
}
type ScriptResult = { data: ScriptData; created_at: string; date?: string } | null

type LedgerRow = { dateStr: string; expected: number; received: number }
type LedgerData = { rows: LedgerRow[]; totalExpected: number; totalReceived: number; netBalance: number }

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function toDisplayDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${d} ${months[+m - 1]} ${y}`
}

export default function AdminClient({
  agents: initialAgents,
  todayEntries,
  scriptResult: initialScriptResult,
}: {
  agents: Agent[]
  todayEntries: Entry[]
  scriptResult: ScriptResult
}) {
  const router = useRouter()
  const todayStr = toDateStr(new Date())

  const [tab, setTab] = useState<'today' | 'agents' | 'accounts'>('today')
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [entries, setEntries] = useState<Entry[]>(todayEntries)
  const [scriptResult, setScriptResult] = useState<ScriptResult>(initialScriptResult)
  const [loading, setLoading] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGmail, setNewGmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [agentList, setAgentList] = useState(initialAgents)
  const [agentError, setAgentError] = useState('')

  const [ledgerData, setLedgerData] = useState<LedgerData | null>(null)
  const [loadingLedger, setLoadingLedger] = useState(false)

  const loadLedger = useCallback(async () => {
    if (ledgerData) return
    setLoadingLedger(true)
    const supabase = createClient()
    const [{ data: sr }, { data: ce }] = await Promise.all([
      supabase.from('script_results').select('date, data').order('date', { ascending: false }),
      supabase.from('cash_entries').select('amount, created_at')
    ])

    const dayMap: Record<string, LedgerRow> = {}

    // Process expenses (expected cash from online collection)
    for (const res of (sr || [])) {
      const dateStr = res.date
      if (!dayMap[dateStr]) dayMap[dateStr] = { dateStr, expected: 0, received: 0 }
      dayMap[dateStr].expected += (res.data?.cashInHand ?? 0)
    }

    // Process receipts (cash entries)
    for (const entry of (ce || [])) {
      // Adjust timezone safely for IST (+5:30)
      const localIso = new Date(new Date(entry.created_at).getTime() + 5.5 * 60 * 60 * 1000).toISOString()
      const dateStr = localIso.split('T')[0]
      if (!dayMap[dateStr]) dayMap[dateStr] = { dateStr, expected: 0, received: 0 }
      dayMap[dateStr].received += entry.amount
    }

    const rows = Object.values(dayMap).sort((a, b) => b.dateStr.localeCompare(a.dateStr))
    let totalExpected = 0
    let totalReceived = 0
    for (const r of rows) {
      totalExpected += r.expected
      totalReceived += r.received
    }

    setLedgerData({ rows, totalExpected, totalReceived, netBalance: totalExpected - totalReceived })
    setLoadingLedger(false)
  }, [ledgerData])

  useEffect(() => {
    if (tab === 'accounts' && !ledgerData && !loadingLedger) {
      loadLedger()
    }
  }, [tab, ledgerData, loadingLedger, loadLedger])

  const fetchDate = useCallback(async (dateStr: string) => {
    setLoading(true)
    const supabase = createClient()

    const dayStart = new Date(dateStr + 'T00:00:00+05:30').toISOString()
    const dayEnd   = new Date(dateStr + 'T23:59:59+05:30').toISOString()

    const [{ data: entriesRaw }, { data: sr }] = await Promise.all([
      supabase
        .from('cash_entries')
        .select('id, amount, note, created_at, agent_id, agents(name)')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: false }),
      supabase
        .from('script_results')
        .select('data, created_at')
        .eq('date', dateStr)
        .single(),
    ])

    const fixedEntries = (entriesRaw ?? []).map(e => ({
      ...e,
      agents: Array.isArray(e.agents) ? (e.agents[0] ?? null) : e.agents,
    }))

    setEntries(fixedEntries as Entry[])
    setScriptResult(sr ?? null)
    setLoading(false)
  }, [])

  async function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const d = e.target.value
    setSelectedDate(d)
    await fetchDate(d)
  }

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

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const cashTotal = entries.reduce((s, e) => s + e.amount, 0)

  const byAgent: Record<string, { name: string; total: number; entries: Entry[] }> = {}
  for (const e of entries) {
    const name = e.agents?.name ?? 'Unknown'
    if (!byAgent[e.agent_id]) byAgent[e.agent_id] = { name, total: 0, entries: [] }
    byAgent[e.agent_id].total += e.amount
    byAgent[e.agent_id].entries.push(e)
  }

  const sd = scriptResult?.data

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
          {(['today', 'accounts', 'agents'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 border hover:bg-gray-50'}`}
            >
              {t === 'today' ? 'Collections' : t === 'accounts' ? 'Accounts Ledger' : 'Manage Agents'}
            </button>
          ))}
        </div>

        {tab === 'today' && (
          <div className="space-y-4">
            {/* Date picker */}
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-3">
              <label className="text-sm text-gray-500 whitespace-nowrap">Viewing date</label>
              <input
                type="date"
                value={selectedDate}
                max={todayStr}
                onChange={handleDateChange}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 font-medium">{toDisplayDate(selectedDate)}</span>
              {loading && <span className="text-xs text-gray-400 ml-auto">Loading...</span>}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-2xl shadow-sm p-5 space-y-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-gray-500">Cash Handed In (agents)</p>
                  <p className="text-xl font-bold text-gray-900">₹{cashTotal.toLocaleString('en-IN')}</p>
                </div>
                {sd && (
                  <div>
                    <p className="text-xs text-gray-500">Online Collections</p>
                    <p className="text-xl font-bold text-green-700">₹{(sd.grandTotal ?? 0).toLocaleString('en-IN')}</p>
                  </div>
                )}
              </div>

              {sd && (
                <div className="border-t pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Cable (KCCL)</p>
                      <p className="font-semibold text-gray-800">₹{(sd.cableTotal ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Internet (KV)</p>
                      <p className="font-semibold text-gray-800">₹{(sd.kvTotal ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">UPI Received</p>
                      <p className="font-semibold text-blue-600">₹{(sd.upiTotal ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-400">Cash in Hand</p>
                      <p className="font-semibold text-orange-600">₹{(sd.cashInHand ?? 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {sd.kvPerAccount && Object.keys(sd.kvPerAccount).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Internet — per account (Kerala Vision)</p>
                      <ul className="divide-y divide-gray-100">
                        {Object.entries(sd.kvPerAccount).map(([acc, v]) => (
                          <li key={acc} className="py-2 flex justify-between text-sm">
                            <span className="text-gray-500 uppercase">{acc} <span className="text-gray-400 normal-case">({v.count} records)</span></span>
                            <span className="font-medium text-gray-900">₹{v.amount.toLocaleString('en-IN')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {sd.empAgg && Object.keys(sd.empAgg).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-2">Agent-wise (Cable collections)</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-400 border-b">
                              <th className="text-left pb-1 font-medium">Agent</th>
                              <th className="text-right pb-1 font-medium">Cust</th>
                              <th className="text-right pb-1 font-medium">Digital TV</th>
                              <th className="text-right pb-1 font-medium">Broadband</th>
                              <th className="text-right pb-1 font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {Object.entries(sd.empAgg).map(([name, v]) => (
                              <tr key={name}>
                                <td className="py-2 text-gray-800">{name}</td>
                                <td className="py-2 text-right text-gray-500">{v.customers}</td>
                                <td className="py-2 text-right text-gray-600">₹{v.digitalTV.toLocaleString('en-IN')}</td>
                                <td className="py-2 text-right text-gray-600">₹{v.broadband.toLocaleString('en-IN')}</td>
                                <td className="py-2 text-right font-semibold text-gray-900">₹{(v.digitalTV + v.broadband).toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-gray-400">Script ran: {formatTime(scriptResult!.created_at)}</p>
                </div>
              )}

              {!sd && !loading && (
                <p className="text-xs text-gray-400 border-t pt-3">No online collection data for this date.</p>
              )}
            </div>

            {/* Agent cash entries */}
            {Object.keys(byAgent).length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-gray-400 text-center">
                No cash entries for this date.
              </div>
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
                        <span className="text-gray-400">{formatTime(e.created_at)}</span>
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

        {tab === 'accounts' && (
          <div className="space-y-4">
            {!ledgerData ? (
              <div className="text-sm text-gray-500 text-center py-6">Loading ledger...</div>
            ) : (
              <>
                <div className="bg-white rounded-2xl shadow-sm p-5 flex gap-8 flex-wrap">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Expected (Recharges)</p>
                    <p className="text-2xl font-bold text-gray-900">₹{ledgerData.totalExpected.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Total Cash Received</p>
                    <p className="text-2xl font-bold text-green-600">₹{ledgerData.totalReceived.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Outstanding Balance</p>
                    <p className={`text-2xl font-bold ${ledgerData.netBalance > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                      ₹{ledgerData.netBalance.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 font-medium">Date</th>
                        <th className="px-4 py-3 font-medium text-right">Expected</th>
                        <th className="px-4 py-3 font-medium text-right">Received</th>
                        <th className="px-4 py-3 font-medium text-right">Net Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {ledgerData.rows.map(r => (
                        <tr key={r.dateStr} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-900 font-medium whitespace-nowrap">{toDisplayDate(r.dateStr)}</td>
                          <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">₹{r.expected.toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-green-600 whitespace-nowrap">₹{r.received.toLocaleString('en-IN')}</td>
                          <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${r.expected - r.received > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                            ₹{(r.expected - r.received).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {ledgerData.rows.length === 0 && (
                    <div className="text-center py-6 text-sm text-gray-400">No account data found.</div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
