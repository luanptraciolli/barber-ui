import 'server-only'
import { redirect } from 'next/navigation'
import { createServerClient } from '../supabase/server'

/** Garante usuário logado com perfil owner/admin; retorna o client sujeito à RLS. */
export async function requireStaff() {
  const db = await createServerClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) redirect('/painel/login')
  const { data: profile } = await db.from('profiles').select('role').eq('user_id', user.id).maybeSingle()
  if (!profile) redirect('/painel/login?sem-acesso=1')
  return { db, user, role: profile.role as 'owner' | 'admin' }
}
