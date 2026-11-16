// @vitest-environment node
/**
 * Database-level security, dispatch, POD & payment integrity tests for migrations 001–005.
 * Runs migrations 001–005 against PGlite (embedded PostgreSQL WASM) and exercises
 * RPCs, capability guards, triggers, and RLS policies across caller contexts.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  ANON,
  MIGRATION_005,
  SERVICE,
  applyMigration005,
  asUser,
  createDatabaseThrough004,
  createMigratedDatabase,
  rpc,
  sql,
  withActor,
  type RpcResult,
} from './supabaseHarness';

const VENDOR_A = '00000000-0000-4000-8000-00000000000a';
const VENDOR_B = '00000000-0000-4000-8000-00000000000b';
const PROV_1 = '00000000-0000-4000-8000-000000000001';
const PROV_2 = '00000000-0000-4000-8000-000000000002';
const PROV_BUSY = '00000000-0000-4000-8000-000000000003';
const OUTSIDER = '00000000-0000-4000-8000-0000000000ff';
const UNKNOWN_PROVIDER = '00000000-0000-4000-8000-0000000000ee';

const TRACKING_CODE = /^OF-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;
const PIN_REGEX = /^[1-9][0-9]{3}$/;
const TOKEN_REGEX = /^[0-9a-f]{64}$/;

let db: PGlite;
let recipientCounter = 0;

async function seed(targetDb: PGlite = db): Promise<void> {
  await targetDb.exec(`
    INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
      ('${VENDOR_A}', 'vendor.a@test.ng', '{"full_name":"Vendor A"}'),
      ('${VENDOR_B}', 'vendor.b@test.ng', '{"full_name":"Vendor B"}'),
      ('${PROV_1}', 'prov.1@test.ng', '{"full_name":"Provider One"}'),
      ('${PROV_2}', 'prov.2@test.ng', '{"full_name":"Provider Two"}'),
      ('${PROV_BUSY}', 'prov.busy@test.ng', '{"full_name":"Busy Provider"}'),
      ('${OUTSIDER}', 'outsider@test.ng', '{"full_name":"No Role"}');

    UPDATE profiles SET role = 'vendor' WHERE id IN ('${VENDOR_A}', '${VENDOR_B}');
    UPDATE profiles SET role = 'logistics_provider' WHERE id IN ('${PROV_1}', '${PROV_2}', '${PROV_BUSY}');

    INSERT INTO vendors (id, business_name, business_category, operating_city) VALUES
      ('${VENDOR_A}', 'Ada Fabrics', 'fashion', 'Lagos'),
      ('${VENDOR_B}', 'Bola Gadgets', 'electronics', 'Abuja');

    INSERT INTO logistics_providers (id, provider_name, provider_type, coverage_area) VALUES
      ('${PROV_1}', 'SwiftHaul', 'company', 'Lagos'),
      ('${PROV_2}', 'MetroRide', 'company', 'Lagos'),
      ('${PROV_BUSY}', 'SlowPoke', 'individual', 'Lagos');

    INSERT INTO provider_availability (provider_id, status) VALUES
      ('${PROV_1}', 'available'),
      ('${PROV_2}', 'available'),
      ('${PROV_BUSY}', 'busy');
  `);
}

function nextRecipient(): string {
  recipientCounter += 1;
  return `Recipient ${recipientCounter}`;
}

async function createDelivery(
  overrides: Record<string, unknown> = {},
  actor = asUser(VENDOR_A)
): Promise<RpcResult> {
  return rpc(db, actor, 'create_delivery_transactional', {
    p_pickup_address: '12 Admiralty Way',
    p_pickup_city: 'Lagos',
    p_destination_address: '4 Allen Avenue',
    p_destination_city: 'Lagos',
    p_recipient_name: nextRecipient(),
    p_recipient_phone: '+2348012345678',
    p_estimated_price: 4500,
    p_dispatch_mode: 'auto',
    p_product_name: 'Ankara bundle',
    p_item_category: 'fashion',
    p_package_type: 'parcel',
    p_weight_kg: 2.5,
    p_candidate_provider_ids: `{${PROV_1},${PROV_2}}`,
    ...overrides,
  });
}

async function deliveryRow(id: string) {
  const rows = await sql<{
    status: string;
    provider_id: string | null;
    estimated_price: string;
    payment_method: string | null;
    payment_status: string | null;
    pod_failed_attempts: number;
    pod_photo_url: string | null;
    pod_completed_at: string | null;
  }>(
    db,
    `SELECT status, provider_id, estimated_price, payment_method, payment_status,
            pod_failed_attempts, pod_photo_url, pod_completed_at
     FROM deliveries WHERE id = $1`,
    [id]
  );
  return rows[0];
}

async function opportunities(id: string) {
  return sql<{ provider_id: string; status: string; expires_at: string | null }>(
    db,
    'SELECT provider_id, status, expires_at FROM dispatch_opportunities WHERE delivery_id = $1 ORDER BY rank_order',
    [id]
  );
}

async function history(id: string) {
  return sql<{
    previous_status: string | null;
    new_status: string;
    changed_by_user_id: string | null;
    notes: string;
  }>(
    db,
    'SELECT previous_status, new_status, changed_by_user_id, notes FROM delivery_status_history WHERE delivery_id = $1 ORDER BY seq',
    [id]
  );
}

async function expectSqlError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  await expect(promise).rejects.toThrow(pattern);
}

beforeAll(async () => {
  db = await createMigratedDatabase();
  await seed();
}, 60_000);

// ---------------------------------------------------------------------------
describe('create_delivery_transactional', () => {
  it('creates delivery, package, POD secrets, ranked queue and audit trail atomically', async () => {
    const res = await createDelivery({
      p_candidate_provider_ids: `{${PROV_1},${PROV_2},${UNKNOWN_PROVIDER},${PROV_1}}`,
      p_payment_method: 'cash_on_delivery',
      p_require_photo_proof: true,
    });

    expect(res.success).toBe(true);
    expect(res.idempotent_replay).toBe(false);
    expect(res.status).toBe('opportunity_sent');
    expect(res.tracking_code).toMatch(TRACKING_CODE);
    expect(res.payment_method).toBe('cash_on_delivery');
    expect(res.payment_status).toBe('pending');
    expect(res.require_photo_proof).toBe(true);
    expect(res.pod_verification_code).toMatch(PIN_REGEX);
    expect(res.recipient_tracking_token).toMatch(TOKEN_REGEX);
    expect(res.current_opportunity_provider_id).toBe(PROV_1);
    expect(res.candidate_provider_ids).toEqual([PROV_1, PROV_2]);

    const id = res.delivery_id as string;
    const pkg = await sql(db, 'SELECT 1 FROM package_details WHERE delivery_id = $1', [id]);
    expect(pkg).toHaveLength(1);

    const secret = await sql<{ pin_code: string; recipient_token: string }>(
      db,
      'SELECT pin_code, recipient_token FROM delivery_pod_secrets WHERE delivery_id = $1',
      [id]
    );
    expect(secret).toHaveLength(1);
    expect(secret[0].pin_code).toBe(res.pod_verification_code);
    expect(secret[0].recipient_token).toBe(res.recipient_tracking_token);

    const opps = await opportunities(id);
    expect(opps.map((o) => o.status)).toEqual(['sent', 'queued']);
    expect(opps[0].expires_at).not.toBeNull();

    const hist = await history(id);
    expect(hist.map((h) => h.new_status)).toEqual(['searching', 'opportunity_sent']);
    expect(hist[0].changed_by_user_id).toBe(VENDOR_A);
  });

  it('rejects prepaid_online on creation until verified gateway webhook integration exists', async () => {
    await expectSqlError(
      createDelivery({ p_payment_method: 'prepaid_online' }),
      /prepaid payment is unavailable/i
    );
  });

  it('rolls back everything when any part fails (no orphaned delivery or secret)', async () => {
    const recipient = 'Atomicity Probe';
    await expectSqlError(
      createDelivery({ p_recipient_name: recipient, p_weight_kg: 0 }),
      /check constraint/i
    );
    const orphans = await sql(db, 'SELECT 1 FROM deliveries WHERE recipient_name = $1', [recipient]);
    expect(orphans).toHaveLength(0);
  });

  it('is idempotent for a repeated idempotency key and returns identical POD secrets', async () => {
    const first = await createDelivery({ p_idempotency_key: 'checkout-123' });
    const retry = await createDelivery({ p_idempotency_key: 'checkout-123' });

    expect(retry.success).toBe(true);
    expect(retry.idempotent_replay).toBe(true);
    expect(retry.delivery_id).toBe(first.delivery_id);
    expect(retry.pod_verification_code).toBe(first.pod_verification_code);
    expect(retry.recipient_tracking_token).toBe(first.recipient_tracking_token);
    const rows = await sql(db, `SELECT 1 FROM deliveries WHERE idempotency_key = 'checkout-123'`);
    expect(rows).toHaveLength(1);
  });

  it('retries on tracking-code collision', async () => {
    const taken = await createDelivery();
    await db.transaction(async (tx) => {
      await tx.exec(`
        CREATE OR REPLACE FUNCTION _generate_tracking_code() RETURNS TEXT
        LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
        BEGIN
          IF COALESCE(current_setting('test.collided', true), '') = '' THEN
            PERFORM set_config('test.collided', 'yes', true);
            RETURN '${taken.tracking_code as string}';
          END IF;
          RETURN 'OF-RTRY-0001';
        END;
        $$;
      `);
      await tx.exec('SET LOCAL ROLE authenticated');
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: VENDOR_A, role: 'authenticated' }),
      ]);
      const res = await tx.query<{ r: RpcResult }>(
        `SELECT create_delivery_transactional(
           p_pickup_address => 'a', p_pickup_city => 'Lagos', p_destination_address => 'b',
           p_destination_city => 'Lagos', p_recipient_name => 'Collision', p_recipient_phone => '+2348000000000',
           p_estimated_price => 100, p_dispatch_mode => 'auto', p_product_name => 'x',
           p_item_category => 'misc', p_package_type => 'box', p_weight_kg => 1) AS r`
      );
      expect(res.rows[0].r.tracking_code).toBe('OF-RTRY-0001');
      await tx.rollback();
    });
  });

  it('rejects non-vendors and anonymous callers', async () => {
    await expectSqlError(createDelivery({}, asUser(PROV_1)), /Only registered vendors/);
    await expectSqlError(createDelivery({}, asUser(OUTSIDER)), /Only registered vendors/);
    await expectSqlError(createDelivery({}, ANON), /permission denied/i);
  });

  it('skips busy candidates when advancing the queue', async () => {
    const res = await createDelivery({ p_candidate_provider_ids: `{${PROV_BUSY},${PROV_1}}` });
    expect(res.current_opportunity_provider_id).toBe(PROV_1);
    const opps = await opportunities(res.delivery_id as string);
    expect(opps.map((o) => o.status)).toEqual(['skipped', 'sent']);
  });

  it('manual mode requires a real provider and assigns directly', async () => {
    await expectSqlError(
      createDelivery({ p_dispatch_mode: 'manual', p_selected_provider_id: UNKNOWN_PROVIDER }),
      /valid selected provider/
    );
    const res = await createDelivery({ p_dispatch_mode: 'manual', p_selected_provider_id: PROV_2 });
    expect(res.status).toBe('awaiting_pickup');
    expect(res.provider_id).toBe(PROV_2);
  });
});

// ---------------------------------------------------------------------------
describe('accept_delivery_opportunity & decline_delivery_opportunity', () => {
  it('rejects acting on behalf of another provider and mutates nothing', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const res = await rpc(db, asUser(PROV_2), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });
    expect(res).toMatchObject({ success: false, code: 'forbidden' });
    expect(await deliveryRow(id)).toMatchObject({ status: 'opportunity_sent', provider_id: null });
  });

  it('assigns exactly once, audits acceptance, and burns dispatch capability', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const ok = await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });
    expect(ok).toMatchObject({ success: true, status: 'provider_selected', already_accepted: false });
    expect(await deliveryRow(id)).toMatchObject({ status: 'provider_selected', provider_id: PROV_1 });

    // Capability table must be completely empty after consumption
    const leftover = await sql(db, 'SELECT * FROM orderflow_internal.trusted_capabilities');
    expect(leftover).toHaveLength(0);

    const rival = await rpc(db, asUser(PROV_2), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_2,
    });
    expect(rival).toMatchObject({ success: false, code: 'already_assigned' });
  });

  it('advances the queue once per decline, then exhausts to searching', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const first = await rpc(db, asUser(PROV_1), 'decline_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });
    expect(first).toMatchObject({ success: true, status: 'opportunity_sent' });

    const second = await rpc(db, asUser(PROV_2), 'decline_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_2,
    });
    expect(second).toMatchObject({ success: true, status: 'searching' });
  });

  it('expires stale offers via server-only sweep', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await sql(
      db,
      `UPDATE dispatch_opportunities SET expires_at = NOW() - INTERVAL '1 second' WHERE delivery_id = $1 AND status = 'sent'`,
      [id]
    );

    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) => tx.query('SELECT expire_stale_dispatch_opportunities()')),
      /permission denied/i
    );

    const swept = await withActor(db, SERVICE, (tx) =>
      tx.query<{ n: number }>('SELECT expire_stale_dispatch_opportunities() AS n')
    );
    expect(swept.rows[0].n).toBeGreaterThanOrEqual(1);
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['expired', 'sent']);
  });
});

// ---------------------------------------------------------------------------
describe('RLS, table revocations & capability security (migration 005)', () => {
  it('blocks direct client INSERT, UPDATE, and DELETE on deliveries, package_details, dispatch_opportunities, and delivery_pod_secrets', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });

    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) =>
        tx.query('UPDATE deliveries SET estimated_price = 1 WHERE id = $1', [id])
      ),
      /permission denied/i
    );

    await expectSqlError(
      withActor(db, asUser(VENDOR_A), (tx) =>
        tx.query(`UPDATE deliveries SET status = 'provider_selected' WHERE id = $1`, [id])
      ),
      /permission denied/i
    );

    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) =>
        tx.query(`UPDATE dispatch_opportunities SET status = 'accepted' WHERE delivery_id = $1`, [id])
      ),
      /permission denied/i
    );

    await expectSqlError(
      withActor(db, asUser(VENDOR_A), (tx) =>
        tx.query(`DELETE FROM delivery_pod_secrets WHERE delivery_id = $1`, [id])
      ),
      /permission denied/i
    );

    await expectSqlError(
      withActor(db, asUser(VENDOR_A), (tx) =>
        tx.query(`DELETE FROM profiles WHERE id = $1`, [VENDOR_A])
      ),
      /permission denied/i
    );
  });

  it('denies all access to orderflow_internal schema, table, and helpers for anon, authenticated, and service_role', async () => {
    for (const actor of [ANON, asUser(VENDOR_A), asUser(PROV_1), SERVICE]) {
      await expectSqlError(
        withActor(db, actor, (tx) =>
          tx.query('SELECT * FROM orderflow_internal.trusted_capabilities')
        ),
        /permission denied/i
      );
      await expectSqlError(
        withActor(db, actor, (tx) =>
          tx.query(`SELECT orderflow_internal.grant_capability('${VENDOR_A}', 'pod_complete')`)
        ),
        /permission denied/i
      );
    }
  });

  it('neutralizes custom GUC spoofing (orderflow.dispatch_context, verified_payment_webhook, cleared JWT claims)', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    // Even if a SECURITY DEFINER helper existed without capabilities, setting custom GUCs or clearing JWT claims cannot bypass triggers:
    await expectSqlError(
      withActor(db, SERVICE, async (tx) => {
        await tx.exec(`SELECT set_config('orderflow.dispatch_context', 'on', true)`);
        await tx.exec(`SELECT set_config('orderflow.verified_payment_webhook', 'on', true)`);
        await tx.query(`UPDATE deliveries SET payment_status = 'collected' WHERE id = $1`, [id]);
      }),
      /payment_status can only become collected/i
    );

    await expectSqlError(
      withActor(db, SERVICE, async (tx) => {
        await tx.exec(`SELECT set_config('orderflow.dispatch_context', 'on', true)`);
        await tx.query(`UPDATE deliveries SET status = 'delivered' WHERE id = $1`, [id]);
      }),
      /complete_delivery_with_pod|POD completion capability/i
    );
  });

  it('enforces delivery_pod_secrets RLS: only owning vendor can SELECT; assigned provider, other vendors, and anon see 0 rows', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });

    const ownerSecret = await withActor(db, asUser(VENDOR_A), (tx) =>
      tx.query<{ pin_code: string }>('SELECT pin_code FROM delivery_pod_secrets WHERE delivery_id = $1', [id])
    );
    expect(ownerSecret.rows).toHaveLength(1);
    expect(ownerSecret.rows[0].pin_code).toBe(d.pod_verification_code);

    const courierSecret = await withActor(db, asUser(PROV_1), (tx) =>
      tx.query('SELECT * FROM delivery_pod_secrets WHERE delivery_id = $1', [id])
    );
    expect(courierSecret.rows).toHaveLength(0);

    const rivalVendorSecret = await withActor(db, asUser(VENDOR_B), (tx) =>
      tx.query('SELECT * FROM delivery_pod_secrets WHERE delivery_id = $1', [id])
    );
    expect(rivalVendorSecret.rows).toHaveLength(0);

    await expectSqlError(
      withActor(db, ANON, (tx) =>
        tx.query('SELECT * FROM delivery_pod_secrets WHERE delivery_id = $1', [id])
      ),
      /permission denied/i
    );
  });

  it('blocks provider reputation spoofing both directly AND inside nested SECURITY DEFINER functions', async () => {
    // 1. Direct authenticated UPDATE on own logistics_providers row cannot modify rating or review_count
    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) =>
        tx.query(`UPDATE logistics_providers SET rating = 5.00, review_count = 999 WHERE id = $1`, [PROV_1])
      ),
      /Provider rating and review_count cannot be modified/i
    );

    // Non-reputation profile updates by the provider still work cleanly
    await withActor(db, asUser(PROV_1), (tx) =>
      tx.query(`UPDATE logistics_providers SET coverage_area = 'Ibadan & Lagos' WHERE id = $1`, [PROV_1])
    );

    // 2. Nested SECURITY DEFINER regression test:
    // Even if a future SECURITY DEFINER RPC owned by postgres updates logistics_providers without granting
    // 'provider_reputation' capability, guard_provider_reputation MUST still block rating/review_count edits!
    await db.transaction(async (tx) => {
      await tx.exec(`
        CREATE FUNCTION public._test_untrusted_secdef_provider_bump()
        RETURNS VOID
        LANGUAGE plpgsql
        SECURITY DEFINER
        SET search_path = public
        AS $$
        BEGIN
          UPDATE public.logistics_providers
          SET review_count = review_count + 100
          WHERE id = auth.uid();
        END;
        $$;
        GRANT EXECUTE ON FUNCTION public._test_untrusted_secdef_provider_bump() TO authenticated;
      `);

      await tx.exec('SET LOCAL ROLE authenticated');
      await tx.query(`SELECT set_config('request.jwt.claims', $1, true)`, [
        JSON.stringify({ sub: PROV_1, role: 'authenticated' }),
      ]);

      await expectSqlError(
        tx.query('SELECT public._test_untrusted_secdef_provider_bump()'),
        /Provider rating and review_count cannot be modified/i
      );

      await tx.rollback();
    });

    // 3. Provider onboarding INSERT succeeds with default (5.00, 0) and rejects inflated initial review_count
    const NEW_PROV = '00000000-0000-4000-8000-000000000077';
    await db.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data)
      VALUES ('${NEW_PROV}', 'newprov@test.ng', '{"full_name":"New Provider"}');
    `);

    await expectSqlError(
      withActor(db, asUser(NEW_PROV), (tx) =>
        tx.query(
          `INSERT INTO logistics_providers (id, provider_name, provider_type, coverage_area, rating, review_count)
           VALUES ($1, 'Spoofed Fleet', 'courier', 'Ibadan', 5.00, 250)`,
          [NEW_PROV]
        )
      ),
      /must initialize to defaults \(5\.00, 0\)/i
    );

    await withActor(db, asUser(NEW_PROV), (tx) =>
      tx.query(
        `INSERT INTO logistics_providers (id, provider_name, provider_type, coverage_area)
         VALUES ($1, 'Honest Fleet', 'courier', 'Ibadan')`,
        [NEW_PROV]
      )
    );
  });
});

// ---------------------------------------------------------------------------
describe('transition_delivery_status, complete_delivery_with_pod & rotate_delivery_pod_secrets', () => {
  async function inTransitDelivery(overrides: Record<string, unknown> = {}) {
    const d = await createDelivery(overrides);
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });
    const trans = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
      p_notes: 'Rider en route',
    });
    expect(trans).toMatchObject({ success: true, status: 'in_transit' });
    return d;
  }

  it('rejects transition_delivery_status to delivered (must use complete_delivery_with_pod)', async () => {
    const d = await inTransitDelivery();
    const id = d.delivery_id as string;

    const bypassAttempt = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'delivered',
    });
    expect(bypassAttempt).toMatchObject({ success: false, code: 'pod_required' });
    expect((await deliveryRow(id)).status).toBe('in_transit');
  });

  it('rejects hardcoded 0000 PIN, locks out after 5 wrong attempts, and unlocks via rotate_delivery_pod_secrets', async () => {
    const d = await inTransitDelivery({ p_payment_method: 'cash_on_delivery' });
    const id = d.delivery_id as string;
    const oldPin = d.pod_verification_code as string;
    const oldToken = d.recipient_tracking_token as string;

    // 1. Attempt hardcoded '0000' bypass -> rejected & increments pod_failed_attempts to 1
    const zeroAttempt = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: '0000',
    });
    expect(zeroAttempt).toMatchObject({
      success: false,
      code: 'invalid_pin',
      attempts_remaining: 4,
    });
    expect((await deliveryRow(id)).pod_failed_attempts).toBe(1);

    // 2. 4 more wrong guesses -> reaches 5 failed attempts and locks out
    const wrongPin = oldPin === '9999' ? '8888' : '9999';
    for (let i = 2; i <= 5; i += 1) {
      const res = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
        p_delivery_id: id,
        p_verification_code: wrongPin,
      });
      expect(res.success).toBe(false);
      if (i < 5) {
        expect(res.code).toBe('invalid_pin');
      } else {
        expect(res.code).toBe('too_many_attempts');
        expect(res.attempts_remaining).toBe(0);
      }
    }
    expect((await deliveryRow(id)).pod_failed_attempts).toBe(5);

    // Even supplying the OLD valid PIN while locked out is rejected!
    const whileLocked = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: oldPin,
    });
    expect(whileLocked).toMatchObject({ success: false, code: 'too_many_attempts' });

    // Non-owner cannot rotate POD secrets
    const courierRotate = await rpc(db, asUser(PROV_1), 'rotate_delivery_pod_secrets', {
      p_delivery_id: id,
    });
    expect(courierRotate).toMatchObject({ success: false, code: 'not_found' });

    // 3. Owning vendor rotates POD secrets -> generates fresh PIN + token, resets failed attempts to 0
    const rotated = await rpc(db, asUser(VENDOR_A), 'rotate_delivery_pod_secrets', {
      p_delivery_id: id,
    });
    expect(rotated.success).toBe(true);
    const newPin = rotated.pod_verification_code as string;
    const newToken = rotated.recipient_tracking_token as string;
    expect(newPin).toMatch(PIN_REGEX);
    expect(newToken).toMatch(TOKEN_REGEX);
    expect(newToken).not.toBe(oldToken);
    expect((await deliveryRow(id)).pod_failed_attempts).toBe(0);

    // 4. Complete delivery with the rotated PIN -> marks delivered and collects COD
    const completed = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: newPin,
      p_notes: 'Handed to recipient at gate',
    });
    expect(completed).toMatchObject({
      success: true,
      status: 'delivered',
      payment_status: 'collected',
    });

    const afterRow = await deliveryRow(id);
    expect(afterRow.status).toBe('delivered');
    expect(afterRow.payment_status).toBe('collected');
    expect(afterRow.pod_completed_at).not.toBeNull();

    // Cannot transition backwards once delivered
    const backwards = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
    });
    expect(backwards).toMatchObject({ success: false, code: 'invalid_transition' });
  });

  it('enforces photo proof when required, rejects dangerous photo URLs, and keeps pay_at_pickup payment_status pending on POD', async () => {
    const d = await inTransitDelivery({
      p_payment_method: 'pay_at_pickup',
      p_require_photo_proof: true,
    });
    const id = d.delivery_id as string;
    const pin = d.pod_verification_code as string;

    const missingPhoto = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: pin,
    });
    expect(missingPhoto).toMatchObject({ success: false, code: 'photo_required' });

    const xssPhoto = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: pin,
      p_photo_url: 'javascript:alert(1)',
    });
    expect(xssPhoto).toMatchObject({ success: false, code: 'invalid_photo_url' });

    const ok = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: pin,
      p_photo_url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    });
    expect(ok).toMatchObject({
      success: true,
      status: 'delivered',
      payment_status: 'pending', // pay_at_pickup is NOT COD, so POD does not mark it collected
    });
  });

  it('vendor cancellation closes outstanding offers and revokes recipient tracking token', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    const res = await rpc(db, asUser(VENDOR_A), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'cancelled',
      p_notes: 'Customer changed their mind',
    });
    expect(res).toMatchObject({ success: true, status: 'cancelled' });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['expired', 'expired']);

    const secret = await sql<{ token_revoked_at: string | null }>(
      db,
      'SELECT token_revoked_at FROM delivery_pod_secrets WHERE delivery_id = $1',
      [id]
    );
    expect(secret[0].token_revoked_at).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('get_public_tracking Case A / B / C disclosure matrix', () => {
  it('enforces exact Case A (no token), Case B (valid token pre/post delivery), and Case C (invalid/expired/revoked) disclosure rules', async () => {
    const d = await createDelivery({
      p_payment_method: 'cash_on_delivery',
      p_require_photo_proof: true,
    });
    const id = d.delivery_id as string;
    const code = d.tracking_code as string;
    const pin = d.pod_verification_code as string;
    const token = d.recipient_tracking_token as string;

    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_1,
    });
    await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
    });

    // CASE A: Tracking-code-only request (no recipient token)
    const caseA = (
      await withActor(db, ANON, (tx) =>
        tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1)', [code])
      )
    ).rows[0];

    expect(caseA).toBeDefined();
    expect(caseA.tracking_code).toBe(code);
    expect(caseA.status).toBe('in_transit');
    expect(caseA.recipient_access_granted).toBe(false);
    expect(caseA.payment_method).toBeNull();
    expect(caseA.payment_status).toBeNull();
    expect(caseA.amount_due).toBeNull();
    expect(caseA.require_photo_proof).toBeNull();
    expect(caseA.has_photo_proof).toBeNull();
    expect(caseA.pod_photo_url).toBeNull();
    expect(caseA.pod_verification_code).toBeNull();
    // Never returns recipient_token or PII
    expect(caseA).not.toHaveProperty('recipient_token');
    expect(caseA).not.toHaveProperty('recipient_tracking_token');
    expect(caseA).not.toHaveProperty('recipient_phone');
    expect(caseA).not.toHaveProperty('destination_address');

    // CASE B (Active in_transit): Valid 64-hex recipient token
    const caseBActive = (
      await withActor(db, ANON, (tx) =>
        tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1, $2)', [code, token])
      )
    ).rows[0];

    expect(caseBActive.recipient_access_granted).toBe(true);
    expect(caseBActive.payment_method).toBe('cash_on_delivery');
    expect(caseBActive.payment_status).toBe('pending');
    expect(caseBActive.amount_due).toBe('4500.00');
    expect(caseBActive.require_photo_proof).toBe(true);
    expect(caseBActive.has_photo_proof).toBe(false);
    expect(caseBActive.pod_photo_url).toBeNull();
    expect(caseBActive.pod_verification_code).toBe(pin);
    expect(caseBActive).not.toHaveProperty('recipient_token');

    // CASE C (Invalid 64-hex token & malformed token): Indistinguishable from Case A
    const wrongHex = token.startsWith('a') ? `b${token.slice(1)}` : `a${token.slice(1)}`;
    for (const badToken of [wrongHex, 'not-a-valid-hex-token']) {
      const caseC = (
        await withActor(db, ANON, (tx) =>
          tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1, $2)', [
            code,
            badToken,
          ])
        )
      ).rows[0];
      expect(caseC.recipient_access_granted).toBe(false);
      expect(caseC.pod_verification_code).toBeNull();
      expect(caseC.payment_method).toBeNull();
      expect(caseC.amount_due).toBeNull();
      expect(caseC.pod_photo_url).toBeNull();
    }

    // Complete delivery with POD photo -> PIN must be immediately extinguished even in Case B!
    const photoUrl = 'https://example.supabase.co/storage/v1/object/public/pod/proof1.jpg';
    const done = await rpc(db, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: id,
      p_verification_code: pin,
      p_photo_url: photoUrl,
    });
    expect(done.success).toBe(true);

    // CASE B (Delivered): PIN is NULL, amount_due is NULL, pod_photo_url IS returned
    const caseBDelivered = (
      await withActor(db, ANON, (tx) =>
        tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1, $2)', [code, token])
      )
    ).rows[0];
    expect(caseBDelivered.status).toBe('delivered');
    expect(caseBDelivered.recipient_access_granted).toBe(true);
    expect(caseBDelivered.pod_verification_code).toBeNull();
    expect(caseBDelivered.amount_due).toBeNull();
    expect(caseBDelivered.payment_status).toBe('collected');
    expect(caseBDelivered.has_photo_proof).toBe(true);
    expect(caseBDelivered.pod_photo_url).toBe(photoUrl);

    // CASE A (Delivered, no token): pod_photo_url and payment fields MUST STILL BE NULL!
    const caseADelivered = (
      await withActor(db, ANON, (tx) =>
        tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1)', [code])
      )
    ).rows[0];
    expect(caseADelivered.status).toBe('delivered');
    expect(caseADelivered.recipient_access_granted).toBe(false);
    expect(caseADelivered.pod_photo_url).toBeNull();
    expect(caseADelivered.has_photo_proof).toBeNull();
    expect(caseADelivered.payment_status).toBeNull();

    // CASE C (Expired token): expire token and verify sensitive fields become NULL
    await sql(
      db,
      `UPDATE delivery_pod_secrets SET token_expires_at = NOW() - INTERVAL '1 minute' WHERE delivery_id = $1`,
      [id]
    );
    const caseCExpired = (
      await withActor(db, ANON, (tx) =>
        tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1, $2)', [code, token])
      )
    ).rows[0];
    expect(caseCExpired.recipient_access_granted).toBe(false);
    expect(caseCExpired.pod_photo_url).toBeNull();
    expect(caseCExpired.payment_status).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('legacy pre-005 data preservation, phone deduplication & idempotency', () => {
  it('preserves NULL payment fields on historical pre-005 rows, backfills active POD secrets, and deduplicates formatted phones', async () => {
    const legacyDb = await createDatabaseThrough004();
    await seed(legacyDb);

    // Insert two profiles whose spaced/dashed phone numbers normalize to the SAME E.164 string
    const USER_DUP_1 = '00000000-0000-4000-8000-0000000000d1';
    const USER_DUP_2 = '00000000-0000-4000-8000-0000000000d2';
    await legacyDb.exec(`
      INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
        ('${USER_DUP_1}', 'dup1@test.ng', '{"full_name":"Dup One"}'),
        ('${USER_DUP_2}', 'dup2@test.ng', '{"full_name":"Dup Two"}');
      UPDATE profiles SET phone = '+234 803 555 0199', created_at = NOW() - INTERVAL '2 days' WHERE id = '${USER_DUP_1}';
      UPDATE profiles SET phone = '+234-803-555-0199', created_at = NOW() - INTERVAL '1 day' WHERE id = '${USER_DUP_2}';
    `);

    // Create two pre-005 deliveries: one historical delivered, one active in_transit
    const HIST_ID = '00000000-0000-4000-8000-000000000901';
    const ACTIVE_ID = '00000000-0000-4000-8000-000000000902';
    await legacyDb.exec(`
      INSERT INTO deliveries (
        id, tracking_code, vendor_id, provider_id, status, dispatch_mode,
        pickup_address, pickup_city, destination_address, destination_city,
        recipient_name, recipient_phone, estimated_price
      ) VALUES
        ('${HIST_ID}', 'OF-HIST-0001', '${VENDOR_A}', '${PROV_1}', 'delivered', 'manual',
         '1 Old Rd', 'Ibadan', '2 Old Rd', 'Ibadan', 'Legacy Buyer', '+2348011111111', 2500),
        ('${ACTIVE_ID}', 'OF-ACTV-0002', '${VENDOR_A}', '${PROV_1}', 'in_transit', 'manual',
         '3 Live Rd', 'Ibadan', '4 Live Rd', 'Ibadan', 'Active Buyer', '+2348022222222', 3200);

      INSERT INTO package_details (delivery_id, product_name, item_category, package_type, weight_kg) VALUES
        ('${HIST_ID}', 'Historical Parcel', 'general', 'parcel', 1.0),
        ('${ACTIVE_ID}', 'Active Parcel', 'general', 'parcel', 1.5);
    `);

    // Apply Migration 005 onto the pre-005 database
    await applyMigration005(legacyDb);

    // 1. Duplicate phone numbers normalized cleanly without UNIQUE collision
    const phones = await sql<{ id: string; phone: string | null }>(
      legacyDb,
      `SELECT id, phone FROM profiles WHERE id IN ($1, $2) ORDER BY id`,
      [USER_DUP_1, USER_DUP_2]
    );
    expect(phones[0].phone).toBe('+2348035550199');
    expect(phones[1].phone).toBeNull();

    // 2. Historical delivered row retains NULL payment_method and NULL payment_status, and has NO backfilled secret
    const histRow = (
      await sql<{ payment_method: string | null; payment_status: string | null }>(
        legacyDb,
        'SELECT payment_method, payment_status FROM deliveries WHERE id = $1',
        [HIST_ID]
      )
    )[0];
    expect(histRow.payment_method).toBeNull();
    expect(histRow.payment_status).toBeNull();
    const histSecret = await sql(
      legacyDb,
      'SELECT 1 FROM delivery_pod_secrets WHERE delivery_id = $1',
      [HIST_ID]
    );
    expect(histSecret).toHaveLength(0);

    // Retroactive payment modification on legacy row is rejected
    await expectSqlError(
      withActor(legacyDb, SERVICE, (tx) =>
        tx.query(`UPDATE deliveries SET payment_method = 'cash_on_delivery', payment_status = 'pending' WHERE id = $1`, [
          HIST_ID,
        ])
      ),
      /Historical unrecorded payment fields cannot be retroactively populated/i
    );

    // 3. Active pre-005 row got backfilled POD secrets AND can complete handover while keeping NULL payment fields!
    const activeSecret = (
      await sql<{ pin_code: string; recipient_token: string }>(
        legacyDb,
        'SELECT pin_code, recipient_token FROM delivery_pod_secrets WHERE delivery_id = $1',
        [ACTIVE_ID]
      )
    )[0];
    expect(activeSecret.pin_code).toMatch(PIN_REGEX);
    expect(activeSecret.recipient_token).toMatch(TOKEN_REGEX);

    const completeLegacyActive = await rpc(legacyDb, asUser(PROV_1), 'complete_delivery_with_pod', {
      p_delivery_id: ACTIVE_ID,
      p_verification_code: activeSecret.pin_code,
    });
    expect(completeLegacyActive).toMatchObject({
      success: true,
      status: 'delivered',
      payment_status: null,
    });

    await legacyDb.close();
  });

  it('re-running migration 005 is idempotent and does NOT overwrite active POD secrets', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    const originalPin = d.pod_verification_code;
    const originalToken = d.recipient_tracking_token;

    await db.exec(MIGRATION_005);

    const afterReRun = (
      await sql<{ pin_code: string; recipient_token: string }>(
        db,
        'SELECT pin_code, recipient_token FROM delivery_pod_secrets WHERE delivery_id = $1',
        [id]
      )
    )[0];
    expect(afterReRun.pin_code).toBe(originalPin);
    expect(afterReRun.recipient_token).toBe(originalToken);
  });
});

// ---------------------------------------------------------------------------
describe('privilege & search_path hygiene', () => {
  it('drops has_active_dispatch_opportunity, caller-binds is_delivery_owner, and pins search_path on all functions', async () => {
    const dropped = await sql(
      db,
      `SELECT 1 FROM pg_proc WHERE proname = 'has_active_dispatch_opportunity'`
    );
    expect(dropped).toHaveLength(0);

    // Caller-bound is_delivery_owner: Vendor B cannot probe whether Vendor A owns a delivery
    const d = await createDelivery();
    const probe = await withActor(db, asUser(VENDOR_B), (tx) =>
      tx.query<{ r: boolean }>('SELECT is_delivery_owner($1, $2) AS r', [d.delivery_id, VENDOR_A])
    );
    expect(probe.rows[0].r).toBe(false);

    // Every function in public and orderflow_internal pins search_path
    const unpinned = await sql<{ nspname: string; proname: string }>(
      db,
      `SELECT n.nspname, p.proname
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname IN ('public', 'orderflow_internal')
         AND p.prokind = 'f'
         AND (p.proconfig IS NULL OR NOT EXISTS (
           SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%'
         ))`
    );
    expect(unpinned).toEqual([]);
  });
});
