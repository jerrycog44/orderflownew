/**
 * Type-level regression tests for the Supabase Database schema types.
 *
 * These assertions are checked by `tsc -b` (part of `npm run build`), not at
 * runtime. If database.types.ts ever degrades so the typed client falls back to
 * `any` (missing `Relationships`, using `interface`, etc.), the
 * `@ts-expect-error` lines become unused and the build fails.
 */
import { describe, it, expect } from 'vitest';
import { supabase } from '../../lib/supabase';
import type { Tables, TablesInsert } from '../database.types';
import type { DeliveryStatus, User } from '../index';

// Never invoked — exists purely for the type checker.
function typeAssertions() {
  // Unknown table names must be rejected.
  // @ts-expect-error — 'not_a_table' does not exist in the schema
  supabase.from('not_a_table');

  // Unknown columns must be rejected on insert.
  void supabase.from('vendors').insert({
    id: 'x',
    business_name: 'a',
    business_category: 'b',
    operating_city: 'c',
    // @ts-expect-error — column does not exist on vendors
    not_a_column: true,
  });

  // Enum columns must reject invalid values.
  // @ts-expect-error — 'teleported' is not a delivery_status
  void supabase.from('deliveries').update({ status: 'teleported' }).eq('id', 'x');

  // RPC args must be typed.
  // @ts-expect-error — wrong argument name
  void supabase.rpc('get_public_tracking', { code: 'OF-1' });

  // New atomic dispatch RPCs must accept typed parameters
  void supabase.rpc('accept_delivery_opportunity', { p_delivery_id: 'del-1', p_provider_id: 'prov-1' });
  void supabase.rpc('decline_delivery_opportunity', { p_delivery_id: 'del-1', p_provider_id: 'prov-1' });
  void supabase.rpc('transition_delivery_status', { p_delivery_id: 'del-1', p_new_status: 'in_transit' });
  void supabase.rpc('get_marketplace_opportunities', { p_coverage_area: 'Lagos' });

  // @ts-expect-error — invalid status passed to transition_delivery_status
  void supabase.rpc('transition_delivery_status', { p_delivery_id: 'del-1', p_new_status: 'teleported' });

  // Migration 002: role & phone are nullable.
  const nullableRole: Tables<'profiles'>['role'] = null;
  const nullablePhone: Tables<'profiles'>['phone'] = null;
  const nullableUserPhone: User['phone'] = null;
  void nullableRole;
  void nullablePhone;
  void nullableUserPhone;

  // Previously-missing tables are present.
  const pkg: TablesInsert<'package_details'> = {
    delivery_id: 'd',
    product_name: 'p',
    item_category: 'c',
    package_type: 'box',
    weight_kg: 1,
  };
  void pkg;

  // Domain DeliveryStatus is identical to the DB enum.
  const s: DeliveryStatus = 'opportunity_sent';
  const dbS: Tables<'deliveries'>['status'] = s;
  void dbS;

  // Migration 005: POD secrets table, nullable legacy payment columns, and hardened RPCs.
  const podSecrets: Tables<'delivery_pod_secrets'> = {
    delivery_id: 'del-1',
    pin_code: '4829',
    recipient_token: 'a'.repeat(64),
    token_expires_at: '2026-04-17T00:00:00Z',
    token_revoked_at: null,
    created_at: '2026-04-10T00:00:00Z',
    updated_at: '2026-04-10T00:00:00Z',
  };
  void podSecrets;

  const legacyPaymentMethod: Tables<'deliveries'>['payment_method'] = null;
  const legacyPaymentStatus: Tables<'deliveries'>['payment_status'] = null;
  void legacyPaymentMethod;
  void legacyPaymentStatus;

  // @ts-expect-error — invalid payment_method enum value
  void supabase.from('deliveries').update({ payment_method: 'crypto' }).eq('id', 'x');

  void supabase.rpc('get_public_tracking', {
    p_tracking_code: 'OF-123456',
    p_recipient_token: 'b'.repeat(64),
  });
  void supabase.rpc('complete_delivery_with_pod', {
    p_delivery_id: 'del-1',
    p_verification_code: '4829',
    p_photo_url: 'data:image/jpeg;base64,abc',
  });
  void supabase.rpc('rotate_delivery_pod_secrets', { p_delivery_id: 'del-1' });

  // @ts-expect-error — dropped in Migration 005
  void supabase.rpc('has_active_dispatch_opportunity', { p_delivery_id: 'del-1' });
}
void typeAssertions;

describe('database.types', () => {
  it('compiles (assertions are enforced by tsc)', () => {
    expect(typeof typeAssertions).toBe('function');
  });
});
