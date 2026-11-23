import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'

const ADMIN_URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/postgres'

const SUPABASE_STUB = `
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
`

async function ensureRoles(c: pg.Client) {
  for (const r of ['anon', 'authenticated']) {
    await c.query(`do $$ begin create role ${r} nologin; exception when duplicate_object then null; end $$`)
  }
}

/** Cria um banco descartável com stub do Supabase + migrations, roda fn e derruba o banco. */
export async function withTestDb(fn: (client: pg.Client) => Promise<void>) {
  const name = `barbearia_test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  const admin = new pg.Client({ connectionString: ADMIN_URL })
  await admin.connect()
  await ensureRoles(admin)
  await admin.query(`create database ${name}`)
  const url = new URL(ADMIN_URL)
  url.pathname = `/${name}`
  const client = new pg.Client({ connectionString: url.toString() })
  await client.connect()
  try {
    await client.query(SUPABASE_STUB)
    const dir = path.resolve(__dirname, '../../supabase/migrations')
    for (const f of ['0001_schema.sql']) await client.query(readFileSync(path.join(dir, f), 'utf8'))
    // Supabase concede privilégios de tabela a anon/authenticated por padrão; a RLS é quem restringe.
    await client.query(`grant usage on schema public to anon, authenticated;
      grant all on all tables in schema public to anon, authenticated;
      grant execute on all functions in schema public to anon, authenticated;`)
    await fn(client)
  } finally {
    await client.end()
    await admin.query(`drop database if exists ${name} with (force)`)
    await admin.end()
  }
}
