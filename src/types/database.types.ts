/* OrderFlow Supabase Auto-Generated Type Structure Definitions */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = 'vendor' | 'logistics_provider';
export type AvailabilityStatus = 'available' | 'busy' | 'unavailable';
export type DeliveryStatus =
  | 'draft'
  | 'searching'
  | 'opportunity_sent'
  | 'created'
  | 'provider_selected'
  | 'awaiting_pickup'
  | 'picked_up'
  | 'in_transit'
  | 'delivered'
  | 'cancelled';
export type DispatchMode = 'auto' | 'manual';
export type PackageType = 'parcel' | 'box' | 'bag' | 'fragile_item' | 'other';
export type OpportunityStatus = 'queued' | 'sent' | 'accepted' | 'declined' | 'expired' | 'skipped';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: UserRole;
          full_name: string;
          email: string;
          phone: string;
          avatar_url: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Row']>;
      };
      vendors: {
        Row: {
          id: string;
          business_name: string;
          business_category: string;
          operating_city: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['vendors']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['vendors']['Row']>;
      };
      logistics_providers: {
        Row: {
          id: string;
          provider_name: string;
          provider_type: string;
          coverage_area: string;
          service_areas: string[];
          vehicle_types: string[];
          package_categories: string[];
          logo_url: string | null;
          rating: number;
          review_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['logistics_providers']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['logistics_providers']['Row']>;
      };
      provider_availability: {
        Row: {
          provider_id: string;
          status: AvailabilityStatus;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['provider_availability']['Row'], 'updated_at'>;
        Update: Partial<Database['public']['Tables']['provider_availability']['Row']>;
      };
      deliveries: {
        Row: {
          id: string;
          tracking_code: string;
          vendor_id: string;
          provider_id: string | null;
          driver_id: string | null;
          status: DeliveryStatus;
          dispatch_mode: DispatchMode;
          pickup_address: string;
          pickup_city: string;
          pickup_contact_name: string | null;
          pickup_contact_phone: string | null;
          destination_address: string;
          destination_city: string;
          recipient_name: string;
          recipient_phone: string;
          delivery_notes: string | null;
          estimated_price: number;
          estimated_delivery_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['deliveries']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['deliveries']['Row']>;
      };
      dispatch_opportunities: {
        Row: {
          id: string;
          delivery_id: string;
          provider_id: string;
          rank_order: number;
          status: OpportunityStatus;
          sent_at: string | null;
          responded_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['dispatch_opportunities']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['dispatch_opportunities']['Row']>;
      };
    };
    Views: {
      public_tracking_view: {
        Row: {
          tracking_code: string;
          status: DeliveryStatus;
          estimated_delivery_time: string | null;
          created_at: string;
          updated_at: string;
          product_name: string;
          vendor_name: string;
          provider_name: string | null;
          provider_logo_url: string | null;
        };
      };
    };
    Functions: {
      create_delivery_with_package: {
        Args: {
          p_dispatch_mode: string;
          p_pickup_address: string;
          p_pickup_city: string;
          p_pickup_contact_name: string;
          p_pickup_contact_phone: string;
          p_destination_address: string;
          p_destination_city: string;
          p_recipient_name: string;
          p_recipient_phone: string;
          p_delivery_notes: string;
          p_estimated_price: number;
          p_estimated_delivery_time: string;
          p_product_name: string;
          p_item_category: string;
          p_package_type: string;
          p_quantity: number;
          p_weight_kg: number;
          p_length_cm: number;
          p_width_cm: number;
          p_height_cm: number;
          p_is_fragile: boolean;
          p_image_url: string;
          p_special_instructions: string;
        };
        Returns: Json;
      };
      get_public_tracking: {
        Args: { p_tracking_code: string };
        Returns: Database['public']['Views']['public_tracking_view']['Row'][];
      };
    };
  };
}
