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
}
void typeAssertions;

describe('database.types', () => {
  it('compiles (assertions are enforced by tsc)', () => {
    expect(typeof typeAssertions).toBe('function');
  });
});
