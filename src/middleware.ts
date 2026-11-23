import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/** Renova a sessão do Supabase e exige login em /painel (exceto /painel/login). */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname !== '/painel/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/painel/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = { matcher: ['/painel/:path*'], runtime: 'nodejs' }
