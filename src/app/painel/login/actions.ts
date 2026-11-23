'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

export async function signIn(_: string, form: FormData): Promise<string> {
  const email = String(form.get('email') ?? '').trim().slice(0, 200)
  const password = String(form.get('password') ?? '').slice(0, 200)
  const db = await createServerClient()
  const { error } = await db.auth.signInWithPassword({ email, password })
  if (error) return 'E-mail ou senha incorretos.'
  redirect('/painel')
}
