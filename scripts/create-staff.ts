// Cria (ou redefine a senha de) um usuário do painel.
// Uso: npm run staff -- <email> <owner|admin>   → a senha gerada é gravada em ACESSOS-DEMO.local.md
import { appendFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const [email, role] = process.argv.slice(2)
  if (!email || !['owner', 'admin'].includes(role)) throw new Error('uso: <email> <owner|admin>')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers)
        if (h.get('Authorization') === `Bearer ${key}`) h.delete('Authorization')
        return fetch(input, { ...init, headers: h })
      },
    },
  })
  const password = randomBytes(9).toString('base64url')
  const list = await db.auth.admin.listUsers()
  if (list.error) throw list.error
  let user = list.data.users.find((u) => u.email === email)
  if (user) {
    const r = await db.auth.admin.updateUserById(user.id, { password })
    if (r.error) throw r.error
  } else {
    const r = await db.auth.admin.createUser({ email, password, email_confirm: true })
    if (r.error) throw r.error
    user = r.data.user
  }
  const p = await db.from('profiles').upsert({ user_id: user!.id, role })
  if (p.error) throw p.error
  const outFile = process.env.STAFF_OUT ?? 'ACESSOS-DEMO.local.md'
  appendFileSync(outFile, `- ${role}: ${email} / senha: ${password}\n`)
  console.log(`ok: ${email} (${role}) — senha gravada em ${outFile}`)
}
main().catch((e) => { console.error(e.message ?? e); process.exit(1) })
