import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Root redirect — authenticated users go to app dashboard, others to login
export default async function RootPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  } else {
    redirect('/login')
  }
}
