#!/usr/bin/env bash
# Sobe um Supabase mínimo local (Postgres local + PostgREST + GoTrue + roteador) para testar o painel.
# Uso: scripts/localstack/start.sh   → grava .env.localstack na raiz do projeto
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=supa_local
SECRET=${LOCAL_JWT_SECRET:-local-dev-jwt-secret-with-at-least-32-chars}
PGPASS=postgres
psqlc() { PGPASSWORD=$PGPASS psql -h localhost -U postgres -v ON_ERROR_STOP=1 -q "$@"; }

service postgresql status >/dev/null || service postgresql start >/dev/null
docker rm -f sb-rest sb-auth >/dev/null 2>&1 || true
psqlc -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
psqlc -d $DB <<SQL
do \$\$ begin
  create role anon nologin noinherit; exception when duplicate_object then null; end \$\$;
do \$\$ begin
  create role authenticated nologin noinherit; exception when duplicate_object then null; end \$\$;
do \$\$ begin
  create role service_role nologin noinherit bypassrls; exception when duplicate_object then null; end \$\$;
do \$\$ begin
  create role authenticator login noinherit password 'authpw'; exception when duplicate_object then null; end \$\$;
do \$\$ begin
  create role supabase_auth_admin login createrole password 'authpw'; exception when duplicate_object then null; end \$\$;
grant anon, authenticated, service_role to authenticator;
grant create on database $DB to supabase_auth_admin;
create schema if not exists auth authorization supabase_auth_admin;
alter role supabase_auth_admin set search_path = auth;
SQL

docker run -d --name sb-auth --network host \
  -e GOTRUE_API_HOST=127.0.0.1 -e PORT=9999 -e API_EXTERNAL_URL=http://localhost:54321/auth/v1 \
  -e GOTRUE_DB_DRIVER=postgres -e GOTRUE_DB_DATABASE_URL="postgres://supabase_auth_admin:authpw@127.0.0.1:5432/$DB?search_path=auth" \
  -e GOTRUE_SITE_URL=http://localhost:3000 -e GOTRUE_JWT_SECRET="$SECRET" -e GOTRUE_JWT_EXP=3600 \
  -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e GOTRUE_JWT_ADMIN_ROLES=service_role \
  -e GOTRUE_MAILER_AUTOCONFIRM=true -e GOTRUE_DISABLE_SIGNUP=false \
  supabase/gotrue:v2.177.0 >/dev/null
for i in $(seq 1 30); do curl -sf http://127.0.0.1:9999/health >/dev/null && break; sleep 1; done
curl -sf http://127.0.0.1:9999/health >/dev/null || { docker logs sb-auth | tail -20; exit 1; }

psqlc -d $DB -f supabase/migrations/0001_schema.sql -f supabase/migrations/0002_hardening.sql
psqlc -d $DB <<SQL
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
SQL
psqlc -d $DB -f supabase/seed.sql

docker run -d --name sb-rest --network host \
  -e PGRST_DB_URI="postgres://authenticator:authpw@127.0.0.1:5432/$DB" -e PGRST_DB_SCHEMAS=public \
  -e PGRST_DB_ANON_ROLE=anon -e PGRST_JWT_SECRET="$SECRET" -e PGRST_SERVER_PORT=3001 \
  postgrest/postgrest:v12.2.12 >/dev/null

pkill -f "localstack/router.mjs" 2>/dev/null || true
nohup node scripts/localstack/router.mjs >/tmp/localstack-router.log 2>&1 &

jwt() { node -e '
const c=require("crypto");const b=(o)=>Buffer.from(JSON.stringify(o)).toString("base64url");
const h=b({alg:"HS256",typ:"JWT"}),p=b({role:process.argv[1],iss:"supabase",iat:1700000000,exp:2100000000});
console.log(h+"."+p+"."+c.createHmac("sha256",process.argv[2]).update(h+"."+p).digest("base64url"))' "$1" "$SECRET"; }
cat > .env.localstack <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$(jwt anon)
SUPABASE_SERVICE_ROLE_KEY=$(jwt service_role)
ENV
for i in $(seq 1 20); do curl -sf http://127.0.0.1:3001/ >/dev/null && break; sleep 1; done
echo "localstack pronto: .env.localstack"
