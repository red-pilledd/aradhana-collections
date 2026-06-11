import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    'https://jkoiessoijpypwtnziea.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imprb2llc3NvaWpweXB3dG56aWVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODExNjQ4MDMsImV4cCI6MjA5Njc0MDgwM30.fajYoGs-L8y42zKwGLk39mhVxAyk2B0cbLTPdLCZgag',
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
