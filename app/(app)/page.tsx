import { redirect } from 'next/navigation'

// (app)/page.tsx serves "/" — redirect to /dashboard
export default function AppRootPage() {
  redirect('/dashboard')
}
