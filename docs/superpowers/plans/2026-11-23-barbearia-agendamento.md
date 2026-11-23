# Sistema de Agendamento para Barbearia — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Site público onde o cliente agenda sozinho um horário com um dos 2 barbeiros, e painel com login onde o dono vê e gerencia a agenda. Inclui uma demo pronta para apresentar.

**Architecture:** Next.js (App Router) com server actions. A regra de disponibilidade é uma função pura em TypeScript (`computeSlots`), usada tanto para mostrar horários quanto para validar a reserva no servidor. O Postgres (Supabase) garante a ausência de duplicidade com uma constraint `EXCLUDE`. O cliente público nunca lê agendamentos: tudo passa por server actions com service role. O painel usa Supabase Auth + RLS.

**Tech Stack:** Next.js 15 + TypeScript + Tailwind CSS 4, `@supabase/supabase-js` + `@supabase/ssr`, `date-fns` 4 + `@date-fns/tz`, Vitest, `pg` (testes de banco contra Postgres 16 local), Playwright (verificação final).

**Spec:** `docs/superpowers/specs/2026-11-23-barbearia-agendamento-design.md`

## Global Constraints

- Toda a interface em português do Brasil. Identificadores de código e nomes de tabelas/colunas em inglês.
- Fuso fixo `America/Sao_Paulo` para tudo que envolve dia e hora. O servidor (Vercel) roda em UTC: nunca usar `new Date().getHours()` nem métodos locais para regra de negócio.
- Horários começam em intervalos de **15 min**; antecedência mínima padrão **60 min**; janela padrão **30 dias** (vêm de `settings`).
- Máximo de **3** agendamentos futuros confirmados por telefone (só para origem `online`).
- O cliente informa apenas nome e telefone, e vê o aviso de privacidade: "Usamos seu nome e telefone apenas para gerenciar seu agendamento."
- Mobile-first: todo fluxo público tem que funcionar bem em 375px de largura.
- Custo zero: Supabase Free + Vercel Hobby na fase de demo.
- Preços guardados em centavos (`price_cents integer`), exibidos como `R$ 45,00`.

## Review Focus

1. **Fuso horário:** com o servidor em UTC, um expediente das 09:00 em São Paulo tem que gerar o primeiro horário às 09:00 de Brasília (12:00Z). Teste na Task 2.
2. **Serviço que não cabe:** um corte de 50 min não pode ser oferecido às 11:30 se o expediente pausa às 12:00 ou termina às 19:00. Teste na Task 2.
3. **Corrida no mesmo horário:** dois clientes confirmam o mesmo horário ao mesmo tempo. Um entra e o outro recebe a mensagem amigável "Esse horário acabou de ser reservado, escolha outro". Testes nas Tasks 3 e 4.
4. **Cancelado libera o horário:** um agendamento cancelado não bloqueia nem a constraint nem a grade. Testes nas Tasks 2 e 3.
5. **Formatos de telefone:** `(11) 98765-4321`, `+55 11 98765 4321` e `11987654321` são o mesmo telefone, tanto para o limite de 3 quanto para gravar. Testes nas Tasks 1 e 4.

Também: um bloqueio com `barber_id = null` (barbearia inteira, ex.: véspera de Natal) se aplica aos dois barbeiros (Task 4).

---

## Estrutura de arquivos

```
barbearia/
  supabase/migrations/0001_schema.sql      tabelas, constraint, RLS
  supabase/seed.sql                        demo "Barbearia Exemplo"
  src/lib/phone.ts                         normalizar/formatar telefone BR
  src/lib/whatsapp.ts                      link wa.me
  src/lib/money.ts                         formatar centavos
  src/lib/time.ts                          helpers de fuso (TZ, dayOfWeek, atTime)
  src/lib/availability.ts                  computeSlots, mergeAnySlots, pickBarber (puro)
  src/lib/booking/types.ts                 tipos de domínio + BookingRepo
  src/lib/booking/service.ts               getAvailableSlots, createBooking (usa repo)
  src/lib/booking/supabase-repo.ts         BookingRepo com service role
  src/lib/supabase/{server,browser,admin}.ts
  src/middleware.ts                        protege /painel
  src/app/page.tsx                         home pública
  src/app/agendar/page.tsx + BookingWizard.tsx + actions.ts
  src/app/painel/login/page.tsx
  src/app/painel/(app)/layout.tsx          checa papel owner/admin
  src/app/painel/(app)/page.tsx            agenda do dia (2 colunas)
  src/app/painel/(app)/semana/page.tsx
  src/app/painel/(app)/actions.ts          cancelar, manual, bloquear
  src/app/painel/(app)/configuracoes/...   serviços, horários, barbearia
  tests/unit/*.test.ts
  tests/db/{harness.ts,schema.test.ts}
  tests/fakes/memory-repo.ts
```

---

### Task 1: Projeto base + utilitários de telefone, WhatsApp e dinheiro

**Files:**
- Create: projeto Next.js em `/home/user/barbearia` (preservando `docs/`), `vitest.config.ts`, `src/lib/phone.ts`, `src/lib/whatsapp.ts`, `src/lib/money.ts`
- Test: `tests/unit/phone.test.ts`, `tests/unit/whatsapp.test.ts`, `tests/unit/money.test.ts`

**Interfaces:**
- Produces:
  - `normalizePhone(raw: string): string | null`: retorna só dígitos com DDD, 10 ou 11 dígitos, sem `55`; `null` se inválido.
  - `formatPhone(digits: string): string`: `"11987654321"` → `"(11) 98765-4321"`.
  - `whatsappLink(phoneDigits: string, text: string): string`: `https://wa.me/55<digits>?text=<encodeURIComponent(text)>`.
  - `formatBRL(cents: number): string`: `4500` → `"R$ 45,00"`, usando `Intl.NumberFormat('pt-BR', {style:'currency', currency:'BRL'})`. Normalizar o NBSP para espaço comum.

- [ ] **Step 1:** `git init`. Rodar `npx create-next-app@15 . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` (se reclamar da pasta não vazia, gerar em pasta temporária e mover para cá). Instalar `vitest`, `pg`, `@types/pg`, `date-fns@4`, `@date-fns/tz`, `@supabase/supabase-js`, `@supabase/ssr`. Script `"test": "vitest run"` com `TZ=UTC` setado em `vitest.config.ts` (`process.env.TZ = 'UTC'` no topo).
- [ ] **Step 2: Testes que falham**

```ts
expect(normalizePhone('(11) 98765-4321')).toBe('11987654321')
expect(normalizePhone('+55 11 98765 4321')).toBe('11987654321')
expect(normalizePhone('11987654321')).toBe('11987654321')
expect(normalizePhone('1132654321')).toBe('1132654321')
expect(normalizePhone('98765-4321')).toBeNull()
expect(normalizePhone('abc')).toBeNull()
expect(formatPhone('11987654321')).toBe('(11) 98765-4321')
expect(whatsappLink('11987654321', 'Olá, tudo bem?')).toBe('https://wa.me/5511987654321?text=Ol%C3%A1%2C%20tudo%20bem%3F')
expect(formatBRL(4500)).toBe('R$ 45,00')
```

- [ ] **Step 3:** `npm test` → FAIL (módulos inexistentes).
- [ ] **Step 4:** Implementar os três módulos.
- [ ] **Step 5:** `npm test` → PASS; `npm run build` → sucesso.
- [ ] **Step 6:** Commit `feat: projeto base e utilitários de telefone, whatsapp e moeda`. `.gitignore` deve conter `.env*.local`.

---

### Task 2: Regra de disponibilidade (pura)

**Files:**
- Create: `src/lib/time.ts`, `src/lib/availability.ts`
- Test: `tests/unit/availability.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const TZ = 'America/Sao_Paulo'
  export function atTime(date: string /*YYYY-MM-DD*/, hhmm: string): Date   // instante absoluto daquele horário em SP
  export function weekdayOf(date: string): number                          // 0=domingo, no fuso SP
  export function todayInTz(now: Date): string                             // YYYY-MM-DD em SP

  export type Interval = { start: Date; end: Date }
  export type WorkingHour = { weekday: number; start: string; end: string } // "HH:mm"
  export function computeSlots(i: {
    date: string; durationMin: number; workingHours: WorkingHour[];
    busy: Interval[]; now: Date; minAdvanceMin: number; stepMin?: number // default 15
  }): Date[]
  export function mergeAnySlots(perBarber: Record<string, Date[]>): Date[]   // união ordenada, sem repetição
  export function pickBarber(free: string[], countsToday: Record<string, number>): string // menor contagem; empate = primeiro de `free`
  ```
- `busy` já inclui agendamentos **confirmados** e bloqueios; o chamador filtra cancelados (Task 4). `computeSlots` só filtra `workingHours` pelo `weekdayOf(date)`.

Regra: para cada intervalo de expediente do dia, gerar inícios a cada `stepMin` a partir do início do intervalo; manter `s` se `s + durationMin <= fim do intervalo`, se `[s, s+dur)` não intersecta nenhum `busy` (fim exclusivo, então encostar é permitido) e se `s >= now + minAdvanceMin`.

- [ ] **Step 1: Testes que falham** (todas as datas são seg 2026-12-07; expediente `09:00–12:00` e `13:00–19:00`, weekday 1)

```ts
// fuso: primeiro horário 09:00 SP = 12:00Z
expect(slots[0].toISOString()).toBe('2026-12-07T12:00:00.000Z')
// 30 min, sem ocupação: 09:00..11:30 (11) + 13:00..18:30 (23) = 34 horários
expect(slots).toHaveLength(34)
// 50 min: último da manhã é 11:00 (11:15 terminaria 12:05), último da tarde 18:00
expect(fmt(slots)).toContain('11:00'); expect(fmt(slots)).not.toContain('11:15')
expect(fmt(slots).at(-1)).toBe('18:00')
// serviço 30 min, ocupado 10:00–10:30 → somem 09:45 (09:45–10:15 sobrepõe) e 10:00, 09:30 e 10:30 permanecem
// antecedência: now = 2026-12-07 09:20 SP, minAdvance 60 → primeiro horário 10:30
// dia sem expediente (domingo 2026-12-06) → []
// ocupação adjacente (busy 09:00–09:30) não remove 09:30
expect(mergeAnySlots({ a: [t('09:00'), t('09:30')], b: [t('09:00'), t('10:00')] }).map(fmtOne)).toEqual(['09:00','09:30','10:00'])
expect(pickBarber(['a','b'], { a: 3, b: 1 })).toBe('b')
expect(pickBarber(['a','b'], { a: 2, b: 2 })).toBe('a')
expect(pickBarber(['a','b'], {})).toBe('a')
```
(`fmt` = formatar em `HH:mm` no fuso SP, helper do próprio teste usando `@date-fns/tz`.)

- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implementar com `TZDate` de `@date-fns/tz`.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: cálculo de horários disponíveis`.

---

### Task 3: Schema do banco, anti-duplicidade e RLS

**Files:**
- Create: `supabase/migrations/0001_schema.sql`, `tests/db/harness.ts`, `tests/db/schema.test.ts`

**Interfaces:**
- Produces (tabelas, todas com `id uuid default gen_random_uuid()` exceto onde indicado):
  - `barbers(name text, photo_url text, active bool default true, sort_order int default 0)`
  - `services(name text, duration_min int check (>0), price_cents int check (>=0), active bool default true, sort_order int default 0)`
  - `working_hours(barber_id → barbers on delete cascade, weekday smallint check 0–6, start_time time, end_time time, check end>start)`
  - `time_blocks(barber_id uuid null → barbers, starts_at timestamptz, ends_at timestamptz, reason text, check ends>starts)`
  - `appointments(barber_id → barbers, service_id → services, customer_name text, customer_phone text, period tstzrange not null, status text check in ('confirmed','cancelled') default 'confirmed', source text check in ('online','manual'), created_at timestamptz default now())` + `EXCLUDE USING gist (barber_id WITH =, period WITH &&) WHERE (status = 'confirmed')`, constraint nomeada `appointments_no_overlap`. Índice em `customer_phone`.
  - `settings(id int primary key default 1 check (id = 1), shop_name text, whatsapp text, address text, logo_url text, min_advance_min int default 60, booking_window_days int default 30)`
  - `profiles(user_id uuid primary key → auth.users on delete cascade, role text check in ('owner','admin'))`
  - Função `public.is_staff() returns boolean` (`security definer`, `stable`): existe `profiles` com `user_id = auth.uid()`.
  - RLS habilitado em todas. `anon`/`authenticated` podem dar `select` em `barbers`/`services` com `active` e em `settings`. Para `is_staff()`: todas as operações em todas as tabelas, exceto `profiles`, que fica só com `select` do próprio registro.
- `tests/db/harness.ts` exporta `withTestDb(fn: (client: pg.Client) => Promise<void>)`: cria um banco temporário no Postgres 16 local e aplica um stub de Supabase (`create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$ language sql;` + roles `anon`, `authenticated` se não existirem). Depois aplica a migration e, no fim, derruba o banco. Conexão via `TEST_DATABASE_URL` (padrão `postgres://postgres:postgres@localhost:5432/postgres`). Se o Postgres local não estiver rodando, iniciar com `service postgresql start` e definir a senha do usuário `postgres`.

- [ ] **Step 1: Testes que falham** em `tests/db/schema.test.ts`:
  - Inserir dois agendamentos `confirmed`, mesmo barbeiro, `[10:00,10:30)` e `[10:15,10:45)` → o segundo falha com código `23P01`.
  - Mesmo par com o primeiro `cancelled` → ambos entram.
  - `[10:00,10:30)` e `[10:30,11:00)` → ambos entram.
  - Mesmo horário, barbeiros diferentes → ambos entram.
  - Com `set role anon`, `select * from appointments` retorna 0 linhas, mesmo existindo dados; `select` em `services` retorna só os ativos.
  - Com `set role authenticated` + `request.jwt.claim.sub` de um user com profile `owner` → vê os agendamentos; sem profile → 0 linhas.
- [ ] **Step 2:** `npm test -- tests/db` → FAIL.
- [ ] **Step 3:** Escrever a migration.
- [ ] **Step 4:** `npm test` → tudo PASS.
- [ ] **Step 5:** Commit `feat: schema com anti-duplicidade e RLS`.

---

### Task 4: Serviço de agendamento (disponibilidade + reserva) com repositório

**Files:**
- Create: `src/lib/booking/types.ts`, `src/lib/booking/service.ts`, `tests/fakes/memory-repo.ts`
- Test: `tests/unit/booking-service.test.ts`

**Interfaces:**
- Consumes: Task 1 `normalizePhone`; Task 2 `computeSlots`, `mergeAnySlots`, `pickBarber`, `atTime`, `todayInTz`, `Interval`, `WorkingHour`.
- Produces:
  ```ts
  export type Service = { id: string; name: string; durationMin: number; priceCents: number }
  export type Barber = { id: string; name: string; photoUrl: string | null }
  export type Settings = { shopName: string; whatsapp: string; address: string; logoUrl: string | null; minAdvanceMin: number; bookingWindowDays: number }
  export type DayData = {
    workingHours: Record<string, WorkingHour[]>      // por barberId
    busy: Record<string, Interval[]>                 // confirmados + bloqueios (bloqueios com barber_id null já replicados para todos)
    countsToday: Record<string, number>              // confirmados no dia por barbeiro
  }
  export interface BookingRepo {
    getSettings(): Promise<Settings>
    getService(id: string): Promise<Service | null>         // só ativos
    listBarbers(): Promise<Barber[]>                         // só ativos, por sort_order
    loadDay(date: string, barberIds: string[]): Promise<DayData>
    countFutureByPhone(phone: string, now: Date): Promise<number>
    insertAppointment(a: { barberId: string; serviceId: string; customerName: string; customerPhone: string; start: Date; end: Date; source: 'online' | 'manual' }): Promise<{ ok: true; id: string } | { ok: false; reason: 'conflict' }>
  }
  export type SlotOption = { start: string /*ISO*/; label: string /*HH:mm*/ }
  export async function getAvailableSlots(repo: BookingRepo, a: { serviceId: string; barberId: string | 'any'; date: string; now: Date; ignoreAdvance?: boolean }): Promise<SlotOption[]>
  export type BookingResult =
    | { ok: true; appointmentId: string; barberName: string; start: string }
    | { ok: false; error: 'SLOT_TAKEN' | 'INVALID_PHONE' | 'INVALID_NAME' | 'TOO_MANY' | 'OUT_OF_RANGE' | 'NOT_FOUND' }
  export async function createBooking(repo: BookingRepo, a: { serviceId: string; barberId: string | 'any'; start: string; customerName: string; customerPhone: string; now: Date; source: 'online' | 'manual' }): Promise<BookingResult>
  export const BOOKING_ERRORS: Record<Exclude<BookingResult, {ok:true}>['error'], string> // mensagens pt-BR
  ```
- `getAvailableSlots`: data fora de `[hoje, hoje + bookingWindowDays]` → `[]`. Com `ignoreAdvance`, `minAdvanceMin` = 0 (painel; continua sem mostrar passado).
- `createBooking`: `customerName.trim()` com menos de 2 caracteres → `INVALID_NAME`; `normalizePhone` null → `INVALID_PHONE`; `source === 'online'` e `countFutureByPhone >= 3` → `TOO_MANY`. Recalcula os horários e, se `start` não estiver entre eles, retorna `SLOT_TAKEN`. Com `'any'`: candidatos = barbeiros cujo cálculo contém `start`, ordenados por `pickBarber`; tenta inserir em ordem, e se der `conflict` passa ao próximo; se esgotar, `SLOT_TAKEN`. O manual usa `ignoreAdvance` e ignora o limite por telefone.
- Mensagens fixas: `SLOT_TAKEN`: "Esse horário acabou de ser reservado, escolha outro."; `TOO_MANY`: "Você já tem 3 horários marcados. Fale com a barbearia pelo WhatsApp."; `INVALID_PHONE`: "Informe um telefone com DDD."; `INVALID_NAME`: "Informe seu nome."; `OUT_OF_RANGE`: "Data fora do período de agendamento."; `NOT_FOUND`: "Serviço indisponível."

- [ ] **Step 1:** `tests/fakes/memory-repo.ts`: `MemoryRepo implements BookingRepo`, com dados em arrays e `insertAppointment` que retorna `conflict` em sobreposição de confirmados, imitando a constraint.
- [ ] **Step 2: Testes que falham:**
  - Bloqueio com barberId null cobrindo 09:00–12:00 → nenhum barbeiro tem horários da manhã (testar via um `loadDay` do fake que replica, e documentar que o repo Supabase precisa fazer o mesmo).
  - `'any'` com A ocupado às 10:00 e B livre → a reserva vai para B.
  - `'any'` com ambos livres e A com mais agendamentos no dia → vai para B.
  - Duas chamadas `createBooking` concorrentes (`Promise.all`) para o mesmo barbeiro e horário → exatamente uma `ok`, a outra `SLOT_TAKEN`.
  - Telefone `+55 (11) 98765-4321` é gravado como `11987654321`; com 3 futuros já existentes para `11987654321`, uma nova reserva online com `(11) 98765-4321` → `TOO_MANY`; a manual passa.
  - Agendamento cancelado no fake não aparece em `busy` e o horário volta a ser oferecido.
  - `start` que não está na grade (ex.: 10:07) → `SLOT_TAKEN`.
- [ ] **Step 3:** `npm test` → FAIL.
- [ ] **Step 4:** Implementar `service.ts`.
- [ ] **Step 5:** `npm test` → PASS.
- [ ] **Step 6:** Commit `feat: serviço de agendamento`.

---

### Task 5: Supabase real, seed da demo e repositório Supabase

**Files:**
- Create: `supabase/seed.sql`, `src/lib/supabase/admin.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/booking/supabase-repo.ts`, `.env.example`, `scripts/smoke-repo.ts`

**Interfaces:**
- Consumes: Task 3 schema; Task 4 `BookingRepo`.
- Produces:
  - `createAdminClient()` (service role, **só no servidor**; o arquivo começa com `import 'server-only'`), `createServerClient()` (cookies via `@supabase/ssr`, para o painel) e `createBrowserClient()`.
  - `supabaseRepo(client: SupabaseClient): BookingRepo`. Em `loadDay`: só `status = 'confirmed'`, sobreposição com o dia em SP (`atTime(date,'00:00')` a `atTime(date+1,'00:00')`), e bloqueios com `barber_id is null` replicados para cada barbeiro. Inserir `period` como string `[start,end)`; erro com `code === '23P01'` → `{ ok:false, reason:'conflict' }`.
  - Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Seed: settings ("Barbearia Exemplo", WhatsApp fictício `11900000000`, endereço "Rua Exemplo, 123 — Centro"); barbeiros "Rafael" e "Diego"; expediente ter–sáb `09:00–12:00` + `13:00–19:00` para ambos (domingo e segunda fechados); serviços: Corte 30min R$ 45; Barba 20min R$ 30; Corte + Barba 50min R$ 70; Pezinho 15min R$ 15; Sobrancelha 15min R$ 15. Agendamentos de demo **relativos a `now()`** (próximos 5 dias úteis, ~40% da grade ocupada, nomes fictícios), para a agenda parecer viva no dia da reunião.

- [ ] **Step 1:** **Pedir confirmação ao usuário** antes de criar o projeto Supabase (via MCP Supabase `create_project`, região `sa-east-1`, plano free). Aplicar a migration 0001 com `apply_migration` e rodar o seed com `execute_sql`. Obter a URL e as chaves com `get_project_url` / `get_publishable_keys`. A service role key é pedida ao usuário, colada por ele em `.env.local` (nunca no chat nem em commit).
- [ ] **Step 2:** Implementar os clients e `supabaseRepo`.
- [ ] **Step 3:** `scripts/smoke-repo.ts` (rodar com `npx tsx`): lista os barbeiros, calcula os horários de amanhã para "Corte" e cria e cancela um agendamento. Esperado: imprime 2 barbeiros, ≥1 horário e "ok".
- [ ] **Step 4:** Rodar `get_advisors` (security) no projeto → nenhum alerta de RLS desligado.
- [ ] **Step 5:** Commit `feat: integração supabase e seed da demo`.

---

### Task 6: Fluxo público de agendamento

**Files:**
- Create: `src/app/page.tsx`, `src/app/agendar/page.tsx`, `src/app/agendar/BookingWizard.tsx`, `src/app/agendar/actions.ts`, componentes em `src/components/`
- Modify: `src/app/layout.tsx` (fontes, `lang="pt-BR"`, metadados), `src/app/globals.css`

**Interfaces:**
- Consumes: Task 4 `getAvailableSlots`, `createBooking`, `BOOKING_ERRORS`; Task 5 `supabaseRepo(createAdminClient())`; Task 1 `whatsappLink`, `formatBRL`.
- Produces (server actions em `actions.ts`, `'use server'`):
  - `fetchSlots(serviceId: string, barberId: string | 'any', date: string): Promise<SlotOption[]>`
  - `submitBooking(input: { serviceId; barberId; start; customerName; customerPhone }): Promise<BookingResult>`, sempre com `source: 'online'` e `now: new Date()` decididos no servidor.

- [ ] **Step 1:** Invocar a skill `frontend-design:frontend-design` para a identidade visual: tema escuro e masculino de barbearia, com uma cor de destaque, tipografia marcante e sem cara de template.
- [ ] **Step 2:** Home: logo/nome, endereço, botão "Agendar horário" e lista de serviços com preço.
- [ ] **Step 3:** Wizard em 5 passos (Serviço → Barbeiro/"Sem preferência" → Dia + horário → Seus dados → Confirmado), com botão voltar e o estado na URL (`?s=&b=&d=`), para o "voltar" do navegador funcionar. O seletor de dias é uma faixa horizontal com os próximos `bookingWindowDays` dias e mostra os fechados desabilitados. Se `submitBooking` retornar `SLOT_TAKEN`, mostrar a mensagem, voltar ao passo do horário e recarregar a grade.
- [ ] **Step 4:** Tela final: resumo (serviço, barbeiro, data por extenso "sábado, 13 de dezembro às 10:30", preço) + botão "Enviar confirmação no WhatsApp" com `whatsappLink(settings.whatsapp, "Olá! Agendei <serviço> com <barbeiro> em <data> às <hora>. Nome: <nome>.")`.
- [ ] **Step 5:** Verificar com Playwright em viewport 375×812: completar um agendamento contra o Supabase dev, conferir que o registro existe (`execute_sql`) e que, ao repetir com o mesmo horário em outra aba, aparece a mensagem `SLOT_TAKEN`. Tirar screenshots de cada passo.
- [ ] **Step 6:** Commit `feat: fluxo público de agendamento`.

---

### Task 7: Painel — login e agenda

**Files:**
- Create: `src/middleware.ts`, `src/app/painel/login/page.tsx`, `src/app/painel/(app)/layout.tsx`, `src/app/painel/(app)/page.tsx`, `src/app/painel/(app)/semana/page.tsx`, `src/app/painel/(app)/actions.ts`, `src/lib/booking/agenda.ts`
- Test: `tests/unit/agenda.test.ts`

**Interfaces:**
- Consumes: Task 4 `getAvailableSlots`, `createBooking`; Task 5 `createServerClient`, `supabaseRepo`.
- Produces:
  - `groupByBarber(appts: AgendaItem[], barbers: Barber[]): Record<string, AgendaItem[]>`, ordenado por início, em `agenda.ts`, onde `AgendaItem = { id; barberId; serviceName; customerName; customerPhone; start: string; end: string; status; source }`.
  - Actions (todas verificam `is_staff` e usam o client do usuário logado, para a RLS valer): `cancelAppointment(id: string)`; `createManualBooking(input)`, que chama `createBooking` com `source:'manual'`; `createBlock({ barberId: string | null; startsAt: string; endsAt: string; reason: string })`.
- O middleware redireciona `/painel/*` (exceto `/painel/login`) para `/painel/login` sem sessão. O layout redireciona para o login se `is_staff()` for falso.

- [ ] **Step 1: Teste que falha:** `groupByBarber` com 3 itens fora de ordem e 2 barbeiros → cada barbeiro com a lista ordenada; barbeiro sem itens → `[]`.
- [ ] **Step 2:** `npm test` → FAIL; implementar; → PASS.
- [ ] **Step 3:** Login por e-mail e senha (Supabase Auth). Criar dois usuários no projeto dev, `admin` e `owner` de demo, e inserir em `profiles` via `execute_sql`; as senhas são passadas ao usuário fora do repositório.
- [ ] **Step 4:** Agenda do dia: duas colunas lado a lado (rolagem horizontal no celular), com linhas de hora; o card mostra hora, cliente, serviço e botões "WhatsApp" (`whatsappLink(customerPhone, "Olá <nome>, ...")`) e "Cancelar" (com confirmação). Navegação ‹ dia › e "Hoje". Bloqueios aparecem hachurados. Botões "Novo agendamento" (modal: serviço, barbeiro, horário de `getAvailableSlots(..., ignoreAdvance: true)`, nome, telefone) e "Bloquear horário".
- [ ] **Step 5:** Semana: grade de 7 dias com contagem e lista compacta por dia; clicar abre o dia.
- [ ] **Step 6:** Verificação Playwright: acessar `/painel` sem login redireciona; logar como owner; o agendamento da Task 6 aparece; cancelar remove e o horário volta a aparecer no `/agendar`; criar um bloqueio para "toda a barbearia" some com os horários dos dois barbeiros no `/agendar`.
- [ ] **Step 7:** Commit `feat: painel com login e agenda`.

---

### Task 8: Painel — configurações

**Files:**
- Create: `src/app/painel/(app)/configuracoes/page.tsx` (abas), `servicos/`, `horarios/`, `barbearia/` com suas actions

**Interfaces:**
- Consumes: Task 5 `createServerClient`; Task 1 `formatBRL`, `normalizePhone`.
- Produces: actions `saveService({ id?; name; durationMin; priceCents; active })`, `saveWorkingHours(barberId: string, hours: WorkingHour[])` (substitui todos os registros do barbeiro numa transação via RPC ou delete+insert), `saveSettings(Partial<Settings>)`.
- Validação: `durationMin` múltiplo de 5 entre 5 e 240; preço digitado como `45,00` e convertido para centavos; um intervalo de horário com fim ≤ início é rejeitado com mensagem; o WhatsApp passa por `normalizePhone`.
- Mudar horários não apaga agendamentos existentes. Se houver agendamento futuro fora do novo expediente, mostrar o aviso "Existem N agendamentos fora do novo horário" (só aviso).

- [ ] **Step 1: Teste que falha** (`tests/unit/config-validation.test.ts`) para `parsePriceToCents('45,00') === 4500`, `parsePriceToCents('45') === 4500`, `parsePriceToCents('abc') === null` e `validateHours([{weekday:1,start:'12:00',end:'09:00'}])` retornando um erro; ambos em `src/lib/config-validation.ts`.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Telas: lista de serviços com editar/desativar/novo; horários por barbeiro em grade por dia da semana (até 2 intervalos por dia); dados da barbearia.
- [ ] **Step 4:** Verificação Playwright: mudar o preço de "Corte" no painel → a home mostra o novo preço; fechar a quinta para "Diego" → `/agendar` não oferece Diego na quinta.
- [ ] **Step 5:** Commit `feat: configurações do painel`.

---

### Task 9: Publicação e roteiro da demo

**Files:**
- Create: `README.md` (setup, variáveis, como rodar os testes, como fazer a implantação para um cliente real), `docs/roteiro-demo.md`

- [ ] **Step 1:** `npm test` e `npm run build` → tudo verde.
- [ ] **Step 2:** **Com o usuário:** criar um repositório no GitHub e fazer o push; o usuário importa o repositório na Vercel e cadastra as 3 variáveis de ambiente (a service role fica só na Vercel). Esse passo depende das contas do usuário.
- [ ] **Step 3:** Contra a URL publicada, em viewport de celular: home → agendar → confirmar → painel mostra o agendamento. Screenshots em `deviceScaleFactor: 2` para o usuário.
- [ ] **Step 4:** `docs/roteiro-demo.md`: roteiro de 5 minutos para a reunião (abrir o link no celular do dono, ele mesmo marca um horário, mostrar no painel, mostrar bloqueio da véspera de Natal) e checklist de implantação após a venda (trocar nome, logo, WhatsApp, serviços, preços e horários; criar o usuário do dono; apagar os agendamentos de demo).
- [ ] **Step 5:** Commit `docs: readme e roteiro da demo`.
