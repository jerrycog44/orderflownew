/**
 * OrderFlow — Supabase Database Types
 *
 * Mirrors the schema produced by applying, in order:
 *   - supabase/migrations/001_initial_schema.sql
 *   - supabase/migrations/002_fix_auth_flow.sql
 *   - supabase/migrations/003_dispatch_concurrency_and_security.sql
 *   - supabase/migrations/004_atomic_dispatch_and_security_hardening.sql
 *
 * Format matches `supabase gen types typescript` output so the typed client
 * (`createClient<Database>`) resolves table/RPC types correctly. Requirements
 * imposed by @supabase/postgrest-js:
 *   - Every table/view MUST declare `Relationships` (used for embedded selects).
 *   - Schema objects MUST be `type` aliases, not `interface`s (interfaces do not
 *     satisfy `Record<string, unknown>` and silently degrade the client types).
 *
 * When a live project is available, regenerate with:
 *   npx supabase gen types typescript --project-id <id> --schema public > src/types/database.types.ts
 * and diff against this file. The migrations remain the source of truth.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database['public']['Enums']['user_role'] | null; // nullable since migration 002
          full_name: string;
          email: string | null; // nullable since migration 002
          phone: string | null; // nullable since migration 002
          avatar_url: string | null;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database['public']['Enums']['user_role'] | null;
          full_name: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: Database['public']['Enums']['user_role'] | null;
          full_name?: string;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Insert: {
          id: string;
          business_name: string;
          business_category: string;
          operating_city: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          business_name?: string;
          business_category?: string;
          operating_city?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'vendors_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
        Insert: {
          id: string;
          provider_name: string;
          provider_type: string;
          coverage_area: string;
          service_areas?: string[];
          vehicle_types?: string[];
          package_categories?: string[];
          logo_url?: string | null;
          rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_name?: string;
          provider_type?: string;
          coverage_area?: string;
          service_areas?: string[];
          vehicle_types?: string[];
          package_categories?: string[];
          logo_url?: string | null;
          rating?: number;
          review_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'logistics_providers_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      provider_availability: {
        Row: {
          provider_id: string;
          status: Database['public']['Enums']['availability_status'];
          updated_at: string;
        };
        Insert: {
          provider_id: string;
          status?: Database['public']['Enums']['availability_status'];
          updated_at?: string;
        };
        Update: {
          provider_id?: string;
          status?: Database['public']['Enums']['availability_status'];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'provider_availability_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: true;
            referencedRelation: 'logistics_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      drivers: {
        Row: {
          id: string;
          provider_id: string;
          full_name: string;
          phone: string;
          vehicle_plate: string | null;
          vehicle_type: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          full_name: string;
          phone: string;
          vehicle_plate?: string | null;
          vehicle_type?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          full_name?: string;
          phone?: string;
          vehicle_plate?: string | null;
          vehicle_type?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'drivers_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'logistics_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      deliveries: {
        Row: {
          id: string;
          tracking_code: string;
          vendor_id: string;
          provider_id: string | null;
          driver_id: string | null;
          status: Database['public']['Enums']['delivery_status'];
          dispatch_mode: Database['public']['Enums']['dispatch_mode_enum'];
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
          idempotency_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tracking_code: string;
          vendor_id: string;
          provider_id?: string | null;
          driver_id?: string | null;
          status?: Database['public']['Enums']['delivery_status'];
          dispatch_mode?: Database['public']['Enums']['dispatch_mode_enum'];
          pickup_address: string;
          pickup_city: string;
          pickup_contact_name?: string | null;
          pickup_contact_phone?: string | null;
          destination_address: string;
          destination_city: string;
          recipient_name: string;
          recipient_phone: string;
          delivery_notes?: string | null;
          estimated_price: number;
          estimated_delivery_time?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tracking_code?: string;
          vendor_id?: string;
          provider_id?: string | null;
          driver_id?: string | null;
          status?: Database['public']['Enums']['delivery_status'];
          dispatch_mode?: Database['public']['Enums']['dispatch_mode_enum'];
          pickup_address?: string;
          pickup_city?: string;
          pickup_contact_name?: string | null;
          pickup_contact_phone?: string | null;
          destination_address?: string;
          destination_city?: string;
          recipient_name?: string;
          recipient_phone?: string;
          delivery_notes?: string | null;
          estimated_price?: number;
          estimated_delivery_time?: string | null;
          idempotency_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'deliveries_vendor_id_fkey';
            columns: ['vendor_id'];
            isOneToOne: false;
            referencedRelation: 'vendors';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deliveries_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'logistics_providers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'deliveries_driver_id_fkey';
            columns: ['driver_id'];
            isOneToOne: false;
            referencedRelation: 'drivers';
            referencedColumns: ['id'];
          },
        ];
      };
      package_details: {
        Row: {
          id: string;
          delivery_id: string;
          product_name: string;
          item_category: string;
          package_type: Database['public']['Enums']['package_type_enum'];
          quantity: number;
          weight_kg: number;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          is_fragile: boolean;
          image_url: string | null;
          special_instructions: string | null;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          product_name: string;
          item_category: string;
          package_type: Database['public']['Enums']['package_type_enum'];
          quantity?: number;
          weight_kg: number;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
          is_fragile?: boolean;
          image_url?: string | null;
          special_instructions?: string | null;
        };
        Update: {
          id?: string;
          delivery_id?: string;
          product_name?: string;
          item_category?: string;
          package_type?: Database['public']['Enums']['package_type_enum'];
          quantity?: number;
          weight_kg?: number;
          length_cm?: number | null;
          width_cm?: number | null;
          height_cm?: number | null;
          is_fragile?: boolean;
          image_url?: string | null;
          special_instructions?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'package_details_delivery_id_fkey';
            columns: ['delivery_id'];
            isOneToOne: true;
            referencedRelation: 'deliveries';
            referencedColumns: ['id'];
          },
        ];
      };
      dispatch_opportunities: {
        Row: {
          id: string;
          delivery_id: string;
          provider_id: string;
          rank_order: number;
          status: Database['public']['Enums']['opportunity_status_enum'];
          sent_at: string | null;
          responded_at: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          delivery_id: string;
          provider_id: string;
          rank_order: number;
          status?: Database['public']['Enums']['opportunity_status_enum'];
          sent_at?: string | null;
          responded_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          delivery_id?: string;
          provider_id?: string;
          rank_order?: number;
          status?: Database['public']['Enums']['opportunity_status_enum'];
          sent_at?: string | null;
          responded_at?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'dispatch_opportunities_delivery_id_fkey';
            columns: ['delivery_id'];
            isOneToOne: false;
            referencedRelation: 'deliveries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'dispatch_opportunities_provider_id_fkey';
            columns: ['provider_id'];
            isOneToOne: false;
            referencedRelation: 'logistics_providers';
            referencedColumns: ['id'];
          },
        ];
      };
      delivery_status_history: {
        Row: {
          id: string;
          seq: number;
          delivery_id: string;
          previous_status: Database['public']['Enums']['delivery_status'] | null;
          new_status: Database['public']['Enums']['delivery_status'];
          changed_by_user_id: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          seq?: number;
          delivery_id: string;
          previous_status?: Database['public']['Enums']['delivery_status'] | null;
          new_status: Database['public']['Enums']['delivery_status'];
          changed_by_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          seq?: number;
          delivery_id?: string;
          previous_status?: Database['public']['Enums']['delivery_status'] | null;
          new_status?: Database['public']['Enums']['delivery_status'];
          changed_by_user_id?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'delivery_status_history_delivery_id_fkey';
            columns: ['delivery_id'];
            isOneToOne: false;
            referencedRelation: 'deliveries';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'delivery_status_history_changed_by_user_id_fkey';
            columns: ['changed_by_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      // Postgres cannot prove view column nullability, so generated types mark all view columns nullable.
      public_tracking_view: {
        Row: {
          tracking_code: string | null;
          status: Database['public']['Enums']['delivery_status'] | null;
          estimated_delivery_time: string | null;
          created_at: string | null;
          updated_at: string | null;
          product_name: string | null;
          vendor_name: string | null;
          provider_name: string | null;
          provider_logo_url: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      get_public_tracking: {
        Args: { p_tracking_code: string };
        Returns: {
          tracking_code: string;
          status: Database['public']['Enums']['delivery_status'];
          estimated_delivery_time: string | null;
          created_at: string;
          updated_at: string;
          product_name: string;
          vendor_name: string;
          provider_name: string | null;
          provider_logo_url: string | null;
        }[];
      };
      has_active_dispatch_opportunity: {
        Args: { p_delivery_id: string; p_provider_id: string };
        Returns: boolean;
      };
      is_delivery_owner: {
        Args: { p_delivery_id: string; p_vendor_id: string };
        Returns: boolean;
      };
      accept_delivery_opportunity: {
        Args: { p_delivery_id: string; p_provider_id: string };
        Returns: {
          success: boolean;
          code?: string;
          error?: string;
          already_accepted?: boolean;
          delivery_id?: string;
          status?: Database['public']['Enums']['delivery_status'];
        };
      };
      decline_delivery_opportunity: {
        Args: { p_delivery_id: string; p_provider_id: string };
        Returns: {
          success: boolean;
          code?: string;
          error?: string;
          delivery_id?: string;
          status?: Database['public']['Enums']['delivery_status'];
        };
      };
      create_delivery_transactional: {
        Args: {
          p_pickup_address: string;
          p_pickup_city: string;
          p_destination_address: string;
          p_destination_city: string;
          p_recipient_name: string;
          p_recipient_phone: string;
          p_estimated_price: number;
          p_dispatch_mode: Database['public']['Enums']['dispatch_mode_enum'];
          p_product_name: string;
          p_item_category: string;
          p_package_type: Database['public']['Enums']['package_type_enum'];
          p_weight_kg: number;
          p_quantity?: number | null;
          p_length_cm?: number | null;
          p_width_cm?: number | null;
          p_height_cm?: number | null;
          p_is_fragile?: boolean | null;
          p_image_url?: string | null;
          p_special_instructions?: string | null;
          p_pickup_contact_name?: string | null;
          p_pickup_contact_phone?: string | null;
          p_delivery_notes?: string | null;
          p_estimated_delivery_time?: string | null;
          p_selected_provider_id?: string | null;
          p_candidate_provider_ids?: string[] | null;
          p_idempotency_key?: string | null;
        };
        Returns: {
          success: boolean;
          idempotent_replay: boolean;
          delivery_id: string;
          tracking_code: string;
          status: Database['public']['Enums']['delivery_status'];
          provider_id: string | null;
          current_opportunity_provider_id: string | null;
          candidate_provider_ids: string[];
          created_at: string;
          updated_at: string;
        };
      };
      transition_delivery_status: {
        Args: {
          p_delivery_id: string;
          p_new_status: Database['public']['Enums']['delivery_status'];
          p_notes?: string | null;
        };
        Returns: {
          success: boolean;
          code?: string;
          error?: string;
          unchanged?: boolean;
          delivery_id?: string;
          status?: Database['public']['Enums']['delivery_status'];
        };
      };
      get_marketplace_opportunities: {
        Args: { p_coverage_area?: string | null };
        Returns: {
          delivery_id: string;
          tracking_code: string;
          status: Database['public']['Enums']['delivery_status'];
          dispatch_mode: Database['public']['Enums']['dispatch_mode_enum'];
          pickup_city: string;
          destination_city: string;
          item_category: string;
          package_type: Database['public']['Enums']['package_type_enum'];
          quantity: number;
          weight_kg: number;
          length_cm: number | null;
          width_cm: number | null;
          height_cm: number | null;
          is_fragile: boolean;
          estimated_price: number;
          estimated_delivery_time: string | null;
          vendor_name: string;
          is_targeted_offer: boolean;
          offer_expires_at: string | null;
          created_at: string;
        }[];
      };
    };
    Enums: {
      user_role: 'vendor' | 'logistics_provider';
      availability_status: 'available' | 'busy' | 'unavailable';
      delivery_status:
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
      dispatch_mode_enum: 'auto' | 'manual';
      package_type_enum: 'parcel' | 'box' | 'bag' | 'fragile_item' | 'other';
      opportunity_status_enum: 'queued' | 'sent' | 'accepted' | 'declined' | 'expired' | 'skipped';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---------------------------------------------------------------------------
// Convenience helpers (same shape as supabase-generated helpers)
// ---------------------------------------------------------------------------

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

// Back-compat aliases (previous version of this file exported these names)
export type UserRole = Enums<'user_role'>;
export type AvailabilityStatus = Enums<'availability_status'>;
export type DeliveryStatus = Enums<'delivery_status'>;
export type DispatchMode = Enums<'dispatch_mode_enum'>;
export type PackageType = Enums<'package_type_enum'>;
export type OpportunityStatus = Enums<'opportunity_status_enum'>;

export type CreateDeliveryTransactionalResult =
  Database['public']['Functions']['create_delivery_transactional']['Returns'];
export type MarketplaceOpportunity =
  Database['public']['Functions']['get_marketplace_opportunities']['Returns'][number];
export type TransitionDeliveryStatusResult =
  Database['public']['Functions']['transition_delivery_status']['Returns'];
export type AcceptDeliveryOpportunityResult =
  Database['public']['Functions']['accept_delivery_opportunity']['Returns'];
export type DeclineDeliveryOpportunityResult =
  Database['public']['Functions']['decline_delivery_opportunity']['Returns'];

