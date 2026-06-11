import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = 'https://jkoiessoijpypwtnziea.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb2llc3NvaWpweXB3dG56aWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjQ4MDMsImV4cCI6MjA5Njc0MDgwM30.fajYoGs-L8y42zKwGLk39mhVxAyk2B0cbLTPdLCZgag'

export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
}
