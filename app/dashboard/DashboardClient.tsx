'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Entry = { id: string; amount: number; note: string | null; created_at: string }
type Agent = { id: string; name: string; is_admin: boolean }

export default function DashboardClient({
  agent,
  entries: initialEntries,
}: {
  agent: Agent
  entries: Entry[]
}) {
  const router = useRouter()
  const [entries, setEntries] = useState(initialEntries)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const parsed = parseFloat(amount)
    if (!parsed || parsed <= 0) { setError('Enter a valid amount'); return }

    setSubmitting(true)
    const supabase = createClient()
    const { data, error: err } = await supabase
      .from('cash_entries')
      .insert({ agent_id: agent.id, amount: parsed, note: note.trim() || null })
      .select('id, amount, note, created_at')
      .single()

    if (err) { setError('Failed to save. Try again.'); setSubmitting(false); return }

    setEntries([data, ...entries])
    setAmount('')
    setNote('')
    setSubmitting(false)
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-gray-900">Aradhana Collections</h1>
          <p className="text-sm text-gray-500">Welcome, {agent.name}</p>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-500 hover:text-red-500">
          Sign out
        </button>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Submit form */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-800 mb-4">Record Cash Handover</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-gray-600 block mb-1">Amount (₹)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-sm text-gray-600 block mb-1">Note (optional)</label>
              <input
                type="text"
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. Route A, extra collection"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {submitting ? 'Saving...' : 'Submit'}
            </button>
          </form>
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Your History</h2>
            <span className="text-sm text-gray-500">Total: <span className="font-semibold text-gray-900">₹{total.toLocaleString('en-IN')}</span></span>
          </div>
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No entries yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {entries.map(e => (
                <li key={e.id} className="py-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">₹{e.amount.toLocaleString('en-IN')}</p>
                    {e.note && <p className="text-xs text-gray-500 mt-0.5">{e.note}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(e.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
