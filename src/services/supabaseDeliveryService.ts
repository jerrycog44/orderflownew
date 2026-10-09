import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { DeliveryRecord } from '../types';

export type PublicTrackingRecord = {
  tracking_code: string;
  status: DeliveryRecord['status'];
  estimated_delivery_time: string | null;
  created_at: string;
  updated_at: string;
  product_name: string;
  vendor_name: string;
  provider_name: string | null;
  provider_logo_url: string | null;
};

export const supabaseDeliveryService = {
  async createDelivery(data: Omit<DeliveryRecord, 'id' | 'createdAt' | 'updatedAt'>) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Delivery was not saved.');
    }

    const p = data.package;
    const { data: result, error } = await (supabase as any).rpc('create_delivery_with_package', {
      p_dispatch_mode: data.dispatchMode || 'auto',
      p_pickup_address: data.pickup.address,
      p_pickup_city: data.pickup.city,
      p_pickup_contact_name: data.pickup.contactName || '',
      p_pickup_contact_phone: data.pickup.contactPhone || '',
      p_destination_address: data.destination.address,
      p_destination_city: data.destination.city,
      p_recipient_name: data.recipient.name,
      p_recipient_phone: data.recipient.phone,
      p_delivery_notes: data.deliveryNote || '',
      p_estimated_price: data.estimatedPrice,
      p_estimated_delivery_time: data.estimatedDeliveryTime || 'To be confirmed',
      p_product_name: p.productName,
      p_item_category: p.itemCategory,
      p_package_type: p.packageType,
      p_quantity: p.quantity,
      p_weight_kg: p.weightKg,
      p_length_cm: p.dimensionsCm.length,
      p_width_cm: p.dimensionsCm.width,
      p_height_cm: p.dimensionsCm.height,
      p_is_fragile: p.fragile,
      p_image_url: p.imageUrl || '',
      p_special_instructions: p.notes || '',
    });

    if (error) throw new Error(error.message);
    if (!result || typeof result !== 'object' || !('id' in result) || !('tracking_code' in result)) {
      throw new Error('Supabase returned an unexpected delivery response.');
    }

    return {
      id: String(result.id),
      trackingCode: String(result.tracking_code),
      status: String(result.status),
    };
  },

  async getVendorDeliveries(vendorId: string) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('deliveries')
      .select('*, package_details(*)')
      .eq('vendor_id', vendorId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
  },

  async getPublicTracking(code: string): Promise<PublicTrackingRecord | null> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await (supabase as any).rpc('get_public_tracking', {
      p_tracking_code: code.trim(),
    });

    if (error) throw new Error(error.message);
    return (data?.[0] as PublicTrackingRecord | undefined) ?? null;
  },
};
