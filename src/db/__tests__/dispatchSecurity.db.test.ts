// @vitest-environment node
/**
 * Database-level security & dispatch tests for migration 004.
 * Runs migrations 001-004 against real Postgres (PGlite) and exercises the
 * RPCs, triggers and RLS policies as the different PostgREST callers would.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import {
  ANON,
  MIGRATIONS,
  SERVICE,
  asUser,
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

let db: PGlite;
let recipientCounter = 0;

async function seed(): Promise<void> {
  await db.exec(`
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
  const rows = await sql<{ status: string; provider_id: string | null; estimated_price: string }>(
    db,
    'SELECT status, provider_id, estimated_price FROM deliveries WHERE id = $1',
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
  return sql<{ previous_status: string | null; new_status: string; changed_by_user_id: string | null; notes: string }>(
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
  it('creates delivery, package, ranked queue and audit trail atomically', async () => {
    const res = await createDelivery({
      p_candidate_provider_ids: `{${PROV_1},${PROV_2},${UNKNOWN_PROVIDER},${PROV_1}}`,
    });

    expect(res.success).toBe(true);
    expect(res.idempotent_replay).toBe(false);
    expect(res.status).toBe('opportunity_sent');
    expect(res.tracking_code).toMatch(TRACKING_CODE);
    expect(res.current_opportunity_provider_id).toBe(PROV_1);
    // unknown provider dropped, duplicate removed, rank preserved
    expect(res.candidate_provider_ids).toEqual([PROV_1, PROV_2]);

    const id = res.delivery_id as string;
    const pkg = await sql(db, 'SELECT 1 FROM package_details WHERE delivery_id = $1', [id]);
    expect(pkg).toHaveLength(1);

    const opps = await opportunities(id);
    expect(opps.map((o) => o.status)).toEqual(['sent', 'queued']);
    expect(opps[0].expires_at).not.toBeNull();

    const hist = await history(id);
    expect(hist.map((h) => h.new_status)).toEqual(['searching', 'opportunity_sent']);
    expect(hist[0].changed_by_user_id).toBe(VENDOR_A);
  });

  it('rolls back everything when any part fails (no orphaned delivery)', async () => {
    const recipient = 'Atomicity Probe';
    // weight_kg = 0 violates the package_details CHECK constraint AFTER the
    // delivery row has been inserted inside the function.
    await expectSqlError(
      createDelivery({ p_recipient_name: recipient, p_weight_kg: 0 }),
      /check constraint/i
    );
    const orphans = await sql(db, 'SELECT 1 FROM deliveries WHERE recipient_name = $1', [recipient]);
    expect(orphans).toHaveLength(0);
  });

  it('is idempotent for a repeated idempotency key', async () => {
    const first = await createDelivery({ p_idempotency_key: 'checkout-123' });
    const retry = await createDelivery({ p_idempotency_key: 'checkout-123' });

    expect(retry.success).toBe(true);
    expect(retry.idempotent_replay).toBe(true);
    expect(retry.delivery_id).toBe(first.delivery_id);
    const rows = await sql(db, `SELECT 1 FROM deliveries WHERE idempotency_key = 'checkout-123'`);
    expect(rows).toHaveLength(1);
  });

  it('retries on tracking-code collision', async () => {
    // Force the generator to return an already-used code on its first call.
    const taken = await createDelivery();
    await db.transaction(async (tx) => {
      await tx.exec(`
        CREATE OR REPLACE FUNCTION _generate_tracking_code() RETURNS TEXT
        LANGUAGE plpgsql VOLATILE AS $$
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
        JSON.stringify({ sub: VENDOR_A }),
      ]);
      const res = await tx.query<{ r: RpcResult }>(
        `SELECT create_delivery_transactional(
           p_pickup_address => 'a', p_pickup_city => 'Lagos', p_destination_address => 'b',
           p_destination_city => 'Lagos', p_recipient_name => 'Collision', p_recipient_phone => '+2348000000000',
           p_estimated_price => 100, p_dispatch_mode => 'auto', p_product_name => 'x',
           p_item_category => 'misc', p_package_type => 'box', p_weight_kg => 1) AS r`
      );
      expect(res.rows[0].r.tracking_code).toBe('OF-RTRY-0001');
      await tx.rollback(); // restores the real generator
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
describe('accept_delivery_opportunity (authorization)', () => {
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

  it('rejects a provider without the live offer (queued only)', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    const res = await rpc(db, asUser(PROV_2), 'accept_delivery_opportunity', {
      p_delivery_id: id,
      p_provider_id: PROV_2,
    });
    expect(res).toMatchObject({ success: false, code: 'no_active_offer' });
    expect((await deliveryRow(id)).provider_id).toBeNull();
  });

  it('rejects users who are not logistics providers', async () => {
    const d = await createDelivery();
    const res = await rpc(db, asUser(OUTSIDER), 'accept_delivery_opportunity', {
      p_delivery_id: d.delivery_id,
      p_provider_id: OUTSIDER,
    });
    expect(res).toMatchObject({ success: false, code: 'not_a_provider' });
  });

  it('is not executable by anonymous callers', async () => {
    const d = await createDelivery();
    await expectSqlError(
      rpc(db, ANON, 'accept_delivery_opportunity', { p_delivery_id: d.delivery_id, p_provider_id: PROV_1 }),
      /permission denied/i
    );
  });

  it('assigns exactly once and audits the acceptance', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const ok = await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(ok).toMatchObject({ success: true, status: 'provider_selected', already_accepted: false });
    expect(await deliveryRow(id)).toMatchObject({ status: 'provider_selected', provider_id: PROV_1 });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['accepted', 'expired']);

    const last = (await history(id)).at(-1);
    expect(last).toMatchObject({ new_status: 'provider_selected', changed_by_user_id: PROV_1 });
    expect(last?.notes).toMatch(/accepted by provider/);

    const again = await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(again).toMatchObject({ success: true, already_accepted: true });

    const rival = await rpc(db, asUser(PROV_2), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_2 });
    expect(rival).toMatchObject({ success: false, code: 'already_assigned' });
  });

  it('rejects an expired offer and advances the queue', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await sql(db, `UPDATE dispatch_opportunities SET expires_at = NOW() - INTERVAL '1 second' WHERE delivery_id = $1 AND status = 'sent'`, [id]);

    const res = await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(res).toMatchObject({ success: false, code: 'offer_expired' });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['expired', 'sent']);
    expect((await deliveryRow(id)).provider_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('decline_delivery_opportunity (authorization & serialization)', () => {
  it('rejects declining on behalf of another provider', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    const res = await rpc(db, asUser(PROV_2), 'decline_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(res).toMatchObject({ success: false, code: 'forbidden' });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['sent', 'queued']);
  });

  it('rejects a provider that holds no live offer', async () => {
    const d = await createDelivery();
    const res = await rpc(db, asUser(PROV_2), 'decline_delivery_opportunity', {
      p_delivery_id: d.delivery_id,
      p_provider_id: PROV_2,
    });
    expect(res).toMatchObject({ success: false, code: 'no_active_offer' });
  });

  it('advances the queue exactly once per decline, then exhausts to the open pool', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const first = await rpc(db, asUser(PROV_1), 'decline_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(first).toMatchObject({ success: true, status: 'opportunity_sent' });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['declined', 'sent']);

    // A repeated decline (double click / retry) must not advance again.
    const repeat = await rpc(db, asUser(PROV_1), 'decline_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(repeat).toMatchObject({ success: false, code: 'no_active_offer' });

    // The declined provider can no longer accept the targeted offer.
    const lateAccept = await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(lateAccept).toMatchObject({ success: false, code: 'no_active_offer' });

    const second = await rpc(db, asUser(PROV_2), 'decline_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_2 });
    expect(second).toMatchObject({ success: true, status: 'searching' });
    expect((await deliveryRow(id)).status).toBe('searching');
  });

  it('a decline after acceptance cannot overwrite the assignment', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });

    const res = await rpc(db, asUser(PROV_1), 'decline_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    expect(res).toMatchObject({ success: false, code: 'not_available' });
    expect(await deliveryRow(id)).toMatchObject({ status: 'provider_selected', provider_id: PROV_1 });
  });
});

// ---------------------------------------------------------------------------
describe('open marketplace pool', () => {
  it('lets an available provider claim an unassigned searching delivery', async () => {
    const d = await createDelivery({ p_candidate_provider_ids: null });
    const id = d.delivery_id as string;
    expect(d.status).toBe('searching');

    const busy = await rpc(db, asUser(PROV_BUSY), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_BUSY });
    expect(busy).toMatchObject({ success: false, code: 'provider_unavailable' });

    const claim = await rpc(db, asUser(PROV_2), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_2 });
    expect(claim).toMatchObject({ success: true, status: 'provider_selected' });
    expect((await opportunities(id)).map((o) => [o.provider_id, o.status])).toEqual([[PROV_2, 'accepted']]);
  });
});

// ---------------------------------------------------------------------------
describe('offer expiry sweep', () => {
  it('expires stale offers, advances queues and is server-only', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await sql(db, `UPDATE dispatch_opportunities SET expires_at = NOW() - INTERVAL '1 second' WHERE delivery_id = $1 AND status = 'sent'`, [id]);

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
describe('RLS: customer PII visibility', () => {
  const PII_COLUMNS = [
    'recipient_name',
    'recipient_phone',
    'pickup_address',
    'destination_address',
    'pickup_contact_name',
    'pickup_contact_phone',
    'delivery_notes',
    'special_instructions',
    'image_url',
  ];

  it('hides raw delivery and package rows from non-assigned providers, even with a live offer', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    for (const provider of [PROV_1, PROV_2, PROV_BUSY]) {
      const rows = await withActor(db, asUser(provider), async (tx) => ({
        deliveries: (await tx.query('SELECT * FROM deliveries WHERE id = $1', [id])).rows,
        packages: (await tx.query('SELECT * FROM package_details WHERE delivery_id = $1', [id])).rows,
      }));
      expect(rows.deliveries).toHaveLength(0);
      expect(rows.packages).toHaveLength(0);
    }
  });

  it('exposes only redacted fields through the marketplace RPC', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;

    const offered = await withActor(db, asUser(PROV_1), (tx) =>
      tx.query<Record<string, unknown>>('SELECT * FROM get_marketplace_opportunities(NULL)')
    );
    const row = offered.rows.find((r) => r.delivery_id === id);
    expect(row).toBeDefined();
    expect(row?.is_targeted_offer).toBe(true);
    for (const column of PII_COLUMNS) {
      expect(row).not.toHaveProperty(column);
    }

    // PROV_2 is only queued: the exclusive offer is not visible to them.
    const queued = await withActor(db, asUser(PROV_2), (tx) =>
      tx.query<Record<string, unknown>>('SELECT * FROM get_marketplace_opportunities(NULL)')
    );
    expect(queued.rows.find((r) => r.delivery_id === id)).toBeUndefined();

    // Non-providers get nothing.
    const outsider = await withActor(db, asUser(OUTSIDER), (tx) =>
      tx.query('SELECT * FROM get_marketplace_opportunities(NULL)')
    );
    expect(outsider.rows).toHaveLength(0);
  });

  it('reveals full details to the assigned provider and the owning vendor only', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });

    const assigned = await withActor(db, asUser(PROV_1), (tx) =>
      tx.query<{ recipient_phone: string }>('SELECT recipient_phone FROM deliveries WHERE id = $1', [id])
    );
    expect(assigned.rows[0]?.recipient_phone).toBe('+2348012345678');

    const owner = await withActor(db, asUser(VENDOR_A), (tx) =>
      tx.query('SELECT 1 FROM deliveries WHERE id = $1', [id])
    );
    expect(owner.rows).toHaveLength(1);

    const otherVendor = await withActor(db, asUser(VENDOR_B), (tx) =>
      tx.query('SELECT 1 FROM deliveries WHERE id = $1', [id])
    );
    expect(otherVendor.rows).toHaveLength(0);

    const anon = await withActor(db, ANON, (tx) => tx.query('SELECT 1 FROM deliveries WHERE id = $1', [id]));
    expect(anon.rows).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('direct table updates (defense in depth)', () => {
  async function assignedDelivery(): Promise<string> {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    return id;
  }

  it('assigned provider cannot change price, customer data or reassign', async () => {
    const id = await assignedDelivery();
    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) => tx.query('UPDATE deliveries SET estimated_price = 1 WHERE id = $1', [id])),
      /may only update status and driver/
    );
    await expectSqlError(
      withActor(db, asUser(PROV_1), (tx) =>
        tx.query('UPDATE deliveries SET provider_id = $2 WHERE id = $1', [id, PROV_2])
      ),
      /dispatch engine|row-level security/i
    );
    expect((await deliveryRow(id)).estimated_price).toBe('4500.00');
  });

  it('vendor cannot self-assign dispatch statuses', async () => {
    const d = await createDelivery({ p_candidate_provider_ids: null }); // 'searching'
    await expectSqlError(
      withActor(db, asUser(VENDOR_A), (tx) =>
        tx.query(`UPDATE deliveries SET status = 'provider_selected' WHERE id = $1`, [d.delivery_id])
      ),
      /dispatch engine/
    );
  });

  it('providers can no longer rewrite their own opportunity rows', async () => {
    const d = await createDelivery();
    const res = await withActor(db, asUser(PROV_1), (tx) =>
      tx.query(`UPDATE dispatch_opportunities SET status = 'accepted' WHERE delivery_id = $1`, [d.delivery_id])
    );
    expect(res.affectedRows ?? 0).toBe(0);
    expect((await opportunities(d.delivery_id as string))[0].status).toBe('sent');
  });
});

// ---------------------------------------------------------------------------
describe('transition_delivery_status', () => {
  async function assignedDelivery(): Promise<string> {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    await rpc(db, asUser(PROV_1), 'accept_delivery_opportunity', { p_delivery_id: id, p_provider_id: PROV_1 });
    return id;
  }

  it('records actor and note in exactly one audit row', async () => {
    const id = await assignedDelivery();
    const before = (await history(id)).length;

    const res = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
      p_notes: 'Rider left the hub',
    });
    expect(res).toMatchObject({ success: true, status: 'in_transit' });

    const hist = await history(id);
    expect(hist).toHaveLength(before + 1);
    expect(hist.at(-1)).toMatchObject({
      previous_status: 'provider_selected',
      new_status: 'in_transit',
      changed_by_user_id: PROV_1,
      notes: 'Rider left the hub',
    });
  });

  it('enforces who may perform each transition', async () => {
    const id = await assignedDelivery();

    // provider_selected -> in_transit is a VALID transition, but only for the assigned provider.
    const vendorMovesPackage = await rpc(db, asUser(VENDOR_A), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
    });
    expect(vendorMovesPackage).toMatchObject({ success: false, code: 'forbidden' });

    const stranger = await rpc(db, asUser(PROV_2), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
    });
    expect(stranger).toMatchObject({ success: false, code: 'not_found' });

    const dispatchStatus = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'provider_selected',
    });
    expect(dispatchStatus).toMatchObject({ success: false, code: 'use_dispatch_rpc' });

    const providerCancels = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'cancelled',
    });
    expect(providerCancels).toMatchObject({ success: false, code: 'forbidden' });
  });

  it('rejects invalid transitions and post-pickup cancellation', async () => {
    const id = await assignedDelivery();
    await rpc(db, asUser(PROV_1), 'transition_delivery_status', { p_delivery_id: id, p_new_status: 'in_transit' });

    const cancel = await rpc(db, asUser(VENDOR_A), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'cancelled',
    });
    expect(cancel).toMatchObject({ success: false, code: 'forbidden' });

    await rpc(db, asUser(PROV_1), 'transition_delivery_status', { p_delivery_id: id, p_new_status: 'delivered' });
    const backwards = await rpc(db, asUser(PROV_1), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'in_transit',
    });
    expect(backwards).toMatchObject({ success: false, code: 'invalid_transition' });
  });

  it('vendor cancellation closes outstanding offers', async () => {
    const d = await createDelivery();
    const id = d.delivery_id as string;
    const res = await rpc(db, asUser(VENDOR_A), 'transition_delivery_status', {
      p_delivery_id: id,
      p_new_status: 'cancelled',
      p_notes: 'Customer changed their mind',
    });
    expect(res).toMatchObject({ success: true, status: 'cancelled' });
    expect((await opportunities(id)).map((o) => o.status)).toEqual(['expired', 'expired']);

    const market = await withActor(db, asUser(PROV_1), (tx) =>
      tx.query<{ delivery_id: string }>('SELECT delivery_id FROM get_marketplace_opportunities(NULL)')
    );
    expect(market.rows.find((r) => r.delivery_id === id)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
describe('privilege hygiene', () => {
  it('internal helpers are not callable by clients', async () => {
    for (const fn of ['_generate_tracking_code()', `_advance_dispatch_queue('${VENDOR_A}')`]) {
      await expectSqlError(
        withActor(db, asUser(VENDOR_A), (tx) => tx.query(`SELECT ${fn}`)),
        /permission denied/i
      );
    }
  });

  it('public tracking still works anonymously and exposes no PII', async () => {
    const d = await createDelivery();
    const res = await withActor(db, ANON, (tx) =>
      tx.query<Record<string, unknown>>('SELECT * FROM get_public_tracking($1)', [d.tracking_code])
    );
    expect(res.rows).toHaveLength(1);
    expect(res.rows[0]).not.toHaveProperty('recipient_phone');
    expect(res.rows[0]).not.toHaveProperty('destination_address');
  });

  it('migration 004 is safe to re-run', async () => {
    await db.exec(MIGRATIONS[3]);
    const d = await createDelivery();
    expect(d.success).toBe(true);
  });
});
