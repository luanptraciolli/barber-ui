'use client'

import { useActionState } from 'react'
import { signIn } from './actions'

const inputCls = 'w-full rounded-md border border-green-line bg-green-deep px-4 py-3 text-lg focus:border-brass focus:outline-none'

export default function LoginPage() {
  const [error, action, pending] = useActionState(signIn, '')
  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center px-5">
      <div className="pole -mx-5 mb-10 h-3" aria-hidden />
      <h1 className="font-display text-5xl font-extrabold">Painel</h1>
      <p className="mt-2 text-sage">Entre para ver e organizar a agenda.</p>
      <form action={action} className="mt-8 space-y-5">
        <label className="block">
          <span className="mb-2 block text-sm text-sage">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm text-sage">Senha</span>
          <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
        </label>
        {error && <p role="status" className="text-[#f0a3a7]">{error}</p>}
        <button type="submit" disabled={pending}
          className="w-full rounded-md bg-brass px-6 py-4 text-lg font-semibold text-green-deep hover:bg-[#d9b23a] disabled:opacity-60">
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
