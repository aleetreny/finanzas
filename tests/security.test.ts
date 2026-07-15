import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/20260715120800_initial_schema.sql"), "utf8");

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
