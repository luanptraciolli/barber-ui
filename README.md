# Sistema de Agendamento — Barbearia

Site onde o cliente marca horário sozinho pelo celular e painel onde o dono vê e organiza a agenda.

- **Cliente** (`/`, `/agendar`): escolhe serviço, barbeiro (ou "sem preferência"), dia e horário, informa nome e WhatsApp. Não precisa criar conta.
- **Painel** (`/painel`): agenda do dia em colunas por barbeiro, semana, novo agendamento manual, cancelar, bloquear horários e configurações (dados da barbearia, serviços e preços, horário de trabalho).
- **Sem horário duplicado:** garantido pelo banco (constraint `EXCLUDE` em `appointments`), mesmo com dois cliques no mesmo segundo.

Stack: Next.js 15 (App Router), Tailwind 4, Supabase (Postgres + Auth + RLS) e Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com os dados do projeto Supabase
npm run dev
```

Variáveis (`.env.example`):

| Variável | Onde é usada |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave pública (publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | chave secreta (`sb_secret_...`), **só no servidor**; nunca commitar |

## Banco de dados

Migrations em `supabase/migrations/` (aplicar em ordem) e dados de demonstração em `supabase/seed.sql`. O seed apaga os dados e recria a "Barbearia Exemplo", com agendamentos nos próximos 5 dias úteis a partir de quando roda. Rode de novo na véspera da apresentação para a agenda parecer viva.

Criar acesso ao painel (dono ou administrador). A senha gerada é gravada em `ACESSOS-DEMO.local.md`, que fica fora do git:

```bash
npm run staff -- dono@barbearia.com owner
```

## Testes

```bash
npm test
```

- `tests/unit`: regra de horários, fuso de Brasília, reserva, "sem preferência", limite por telefone, validações.
- `tests/db`: anti-duplicidade e RLS contra um Postgres 16 local (`TEST_DATABASE_URL`, padrão `postgres://postgres:postgres@localhost:5432/postgres`).

Verificações ponta a ponta no navegador (com o servidor rodando):

```bash
node scripts/e2e-booking.cjs <pasta-screenshots>
```

```bash
node scripts/e2e-panel.cjs <pasta-screenshots> <AAAA-MM-DD>
```

```bash
node scripts/e2e-config.cjs <pasta-screenshots>
```

`scripts/localstack/start.sh` sobe um Supabase mínimo local (Postgres local + PostgREST + GoTrue em Docker) e grava `.env.localstack`, para testar login e RLS sem tocar no projeto real.

## Publicação (Vercel)

1. Suba o repositório para o GitHub.
2. Na Vercel: **Add New → Project**, importe o repositório e cadastre as 3 variáveis acima.
3. Deploy. O plano Hobby da Vercel é para uso não comercial: quando o cliente começar a pagar, passe para o plano Pro.

## Implantação para um cliente real

Veja o checklist em [`docs/roteiro-demo.md`](docs/roteiro-demo.md).
