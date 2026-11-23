'use client'

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-xl content-center px-5">
      <div className="pole -mx-5 mb-10 h-3" aria-hidden />
      <h1 className="font-display text-5xl font-extrabold">Algo saiu do lugar</h1>
      <p className="mt-3 text-sage">Não conseguimos carregar esta página agora. Tente de novo em instantes.</p>
      <button type="button" onClick={reset}
        className="mt-8 rounded-md bg-brass px-6 py-4 text-lg font-semibold text-green-deep hover:bg-[#d9b23a]">
        Tentar de novo
      </button>
    </main>
  )
}
