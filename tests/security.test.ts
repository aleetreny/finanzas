import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260715132856_initial_schema.sql"), "utf8");
const onboarding = readFileSync(resolve(process.cwd(), "supabase/migrations/20260719234120_multi_user_onboarding.sql"), "utf8");
const publicSignup = readFileSync(resolve(process.cwd(), "supabase/migrations/20260724101315_public_signup_features_and_recurring.sql"), "utf8");
const retiredPublicSignup = readFileSync(resolve(process.cwd(), "supabase/migrations/20260809114042_retire_public_signup.sql"), "utf8");
const ownerGuard = readFileSync(resolve(process.cwd(), "supabase/migrations/20260809114317_harden_owner_account_guard.sql"), "utf8");
const config = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8");

describe("Supabase security migration", () => {
  it("enables RLS for every public application table", () => {
    const tables = [...migration.matchAll(/create table public\.(\w+)/g)].map((match) => match[1]);
    const rlsTables = new Set([...migration.matchAll(/alter table public\.(\w+) enable row level security/g)].map((match) => match[1]));
    expect(tables.length).toBeGreaterThan(10);
    expect(tables.every((table) => rlsTables.has(table))).toBe(true);
  });

  it("uses ownership predicates and never exposes a service role key", () => {
    expect(migration).toContain("(select auth.uid()) = user_id");
    expect(migration).not.toMatch(/service_role/i);
    expect(migration).toContain("revoke all on function public.claim_initial_dataset() from public, anon");
  });
});

describe("acceso autenticado", () => {
  it("restringe la función de alta al rol authenticated", () => {
    expect(onboarding).toContain("revoke all on function public.bootstrap_user_workspace() from public, anon");
    expect(onboarding).toContain("grant execute on function public.bootstrap_user_workspace() to authenticated");
    expect(onboarding).not.toMatch(/service_role/i);
  });

  it("es idempotente y respeta la reclamación única del histórico", () => {
    expect(onboarding).toContain("perform public.claim_initial_dataset()");
    const idempotentInserts = onboarding.match(/on conflict do nothing/g) ?? [];
    expect(idempotentInserts.length).toBeGreaterThanOrEqual(4);
  });
});

describe("espacio personal y recurrentes", () => {
  it("reserva Málaga para quien reclamó el histórico", () => {
    expect(publicSignup).toContain("has_malaga_access := owner_user_id = current_user_id");
    expect(publicSignup).toContain("and category_scope = 'property'");
    expect(publicSignup).toContain("'has_malaga_access', has_malaga_access");
    expect(publicSignup).toContain("revoke execute on function public.claim_initial_dataset() from authenticated");
  });

  it("genera recurrentes bajo RLS y evita duplicados", () => {
    expect(publicSignup).toContain("security invoker");
    expect(publicSignup).toContain("where recurring.user_id = (select auth.uid())");
    expect(publicSignup).toContain("on conflict (user_id, source, source_external_id) do nothing");
    expect(publicSignup).toContain("grant execute on function public.generate_due_recurring_transactions() to authenticated");
  });

  it("retira las invitaciones públicas sin borrar sus registros históricos", () => {
    expect(retiredPublicSignup).toContain("drop function if exists public.consume_signup_attempt(text)");
    expect(retiredPublicSignup).toContain("revoke all on table public.signup_rate_limits from service_role");
    expect(retiredPublicSignup).toContain("create trigger restrict_auth_user_creation");
    expect(retiredPublicSignup).toContain("This project only permits its existing owner account.");
    expect(retiredPublicSignup).not.toMatch(/drop table/i);
    expect(ownerGuard).toContain("pg_advisory_xact_lock(hashtext('finanzas:owner-account')::bigint)");
    expect(config).toMatch(/\[auth\][\s\S]*?enable_signup = false/);
    expect(config).toMatch(/\[auth\.email\][\s\S]*?enable_signup = false/);
  });
});
