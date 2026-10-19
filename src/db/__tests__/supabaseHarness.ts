/**
 * Test harness: runs the REAL migration files against an in-process Postgres
 * (PGlite = PostgreSQL compiled to WASM) with a minimal emulation of the parts
 * of Supabase that the migrations depend on:
 *   - roles: anon, authenticated, service_role
 *   - auth.users + auth.uid() (reads request.jwt.claims like Supabase does)
 *   - Supabase's default privileges: anon/authenticated get ALL on new public
 *     tables and EXECUTE on new public functions. This matters: it is why the
 *     migrations must REVOKE from anon/authenticated explicitly.
 *   - the supabase_realtime publication
 *
 * Limitation: PGlite is a single connection, so true concurrent races cannot
 * be reproduced here. Serialization logic is verified by sequential
 * interleavings; parallel-connection race tests belong in a Docker/Supabase
 * CLI integration job.
 */
import { PGlite, type Transaction } from '@electric-sql/pglite';
import m001 from '../../../supabase/migrations/001_initial_schema.sql?raw';
import m002 from '../../../supabase/migrations/002_fix_auth_flow.sql?raw';
import m003 from '../../../supabase/migrations/003_dispatch_concurrency_and_security.sql?raw';
import m004 from '../../../supabase/migrations/004_atomic_dispatch_and_security_hardening.sql?raw';

const SUPABASE_SHIM = `
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE ROLE service_role NOLOGIN BYPASSRLS;

  CREATE SCHEMA auth;
  CREATE TABLE auth.users (
    id UUID PRIMARY KEY,
    email TEXT,
    raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::jsonb
  );
  CREATE FUNCTION auth.uid() RETURNS UUID
  LANGUAGE sql STABLE AS $$
    SELECT NULLIF(
      COALESCE(
        NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
      ), ''
    )::uuid
  $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;

  GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

  CREATE PUBLICATION supabase_realtime;
`;

export const MIGRATIONS = [m001, m002, m003, m004];

export async function createMigratedDatabase(): Promise<PGlite> {
  const db = await PGlite.create();
  await db.exec(SUPABASE_SHIM);
  for (const sql of MIGRATIONS) {
    await db.exec(sql);
  }
  return db;
}

export type Actor = { kind: 'user'; id: string } | { kind: 'anon' } | { kind: 'service' };

export const asUser = (id: string): Actor => ({ kind: 'user', id });
export const ANON: Actor = { kind: 'anon' };
export const SERVICE: Actor = { kind: 'service' };

/** Runs `fn` in a transaction impersonating the given PostgREST caller. */
export async function withActor<T>(
  db: PGlite,
  actor: Actor,
  fn: (tx: Transaction) => Promise<T>
): Promise<T> {
  return db.transaction(async (tx) => {
    if (actor.kind === 'user') {
      await tx.exec('SET LOCAL ROLE authenticated');
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: actor.id, role: 'authenticated' }),
      ]);
    } else if (actor.kind === 'anon') {
      await tx.exec('SET LOCAL ROLE anon');
    } else {
      await tx.exec('SET LOCAL ROLE service_role');
    }
    return fn(tx);
  });
}

export type RpcResult = {
  success: boolean;
  code?: string;
  error?: string;
  status?: string;
  [key: string]: unknown;
};

/** Calls a JSONB-returning RPC with named arguments, like supabase.rpc(). */
export async function rpc(
  db: PGlite,
  actor: Actor,
  fn: string,
  args: Record<string, unknown>
): Promise<RpcResult> {
  const names = Object.keys(args);
  const placeholders = names.map((name, i) => `${name} => $${i + 1}`).join(', ');
  return withActor(db, actor, async (tx) => {
    const res = await tx.query<{ r: RpcResult }>(
      `SELECT ${fn}(${placeholders}) AS r`,
      names.map((n) => args[n])
    );
    return res.rows[0].r;
  });
}

/** Superuser query (bypasses RLS) for arranging fixtures and asserting state. */
export async function sql<T>(db: PGlite, text: string, params: unknown[] = []): Promise<T[]> {
  const res = await db.query<T>(text, params);
  return res.rows;
}
