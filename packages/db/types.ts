export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_emails: {
        Row: {
          body: string
          client_id: string | null
          created_at: string
          error: string | null
          id: string
          is_test: boolean
          resend_id: string | null
          sent_by: string | null
          status: string
          subject: string
          to_email: string
        }
        Insert: {
          body: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject: string
          to_email: string
        }
        Update: {
          body?: string
          client_id?: string | null
          created_at?: string
          error?: string | null
          id?: string
          is_test?: boolean
          resend_id?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_emails_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          application_test_mode: boolean
          blog_title: string | null
          business_display_name: string | null
          business_name: string
          business_vertical: string | null
          cancelled_at: string | null
          city: string
          claim_token: string | null
          claimed_at: string | null
          country: string
          created_at: string
          custom_domain: string | null
          domain_owner: string | null
          expires_at: string | null
          favicon_url: string | null
          funnel_session_id: string | null
          generated_at: string
          google_place_id: string | null
          gsc_property: string | null
          hard_delete_at: string | null
          hide_claim_banner: boolean
          brand: 'stoopcraft' | 'stupid-cheap-websites'
          id: string
          lat: number | null
          lng: number | null
          logo_url: string | null
          niche: string
          notification_email: string | null
          notification_phone: string | null
          owner_user_id: string | null
          phone: string | null
          plan: string | null
          pos_external_id: string | null
          pos_provider: string | null
          postal_code: string | null
          redirects: Json
          referral_utm_source: string | null
          render_mode: string
          sales_rep_id: string | null
          short_code: string | null
          slug: string
          sms_notifications_enabled: boolean
          state: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          application_test_mode?: boolean
          blog_title?: string | null
          business_display_name?: string | null
          business_name: string
          business_vertical?: string | null
          cancelled_at?: string | null
          city: string
          claim_token?: string | null
          claimed_at?: string | null
          country?: string
          created_at?: string
          custom_domain?: string | null
          domain_owner?: string | null
          expires_at?: string | null
          favicon_url?: string | null
          funnel_session_id?: string | null
          generated_at?: string
          google_place_id?: string | null
          gsc_property?: string | null
          hard_delete_at?: string | null
          hide_claim_banner?: boolean
          brand?: 'stoopcraft' | 'stupid-cheap-websites'
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          niche: string
          notification_email?: string | null
          notification_phone?: string | null
          owner_user_id?: string | null
          phone?: string | null
          plan?: string | null
          pos_external_id?: string | null
          pos_provider?: string | null
          postal_code?: string | null
          redirects?: Json
          referral_utm_source?: string | null
          render_mode?: string
          sales_rep_id?: string | null
          short_code?: string | null
          slug: string
          sms_notifications_enabled?: boolean
          state: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          application_test_mode?: boolean
          blog_title?: string | null
          business_display_name?: string | null
          business_name?: string
          business_vertical?: string | null
          cancelled_at?: string | null
          city?: string
          claim_token?: string | null
          claimed_at?: string | null
          country?: string
          created_at?: string
          custom_domain?: string | null
          domain_owner?: string | null
          expires_at?: string | null
          favicon_url?: string | null
          funnel_session_id?: string | null
          generated_at?: string
          google_place_id?: string | null
          gsc_property?: string | null
          hard_delete_at?: string | null
          hide_claim_banner?: boolean
          brand?: 'stoopcraft' | 'stupid-cheap-websites'
          id?: string
          lat?: number | null
          lng?: number | null
          logo_url?: string | null
          niche?: string
          notification_email?: string | null
          notification_phone?: string | null
          owner_user_id?: string | null
          phone?: string | null
          plan?: string | null
          pos_external_id?: string | null
          pos_provider?: string | null
          postal_code?: string | null
          redirects?: Json
          referral_utm_source?: string | null
          render_mode?: string
          sales_rep_id?: string | null
          short_code?: string | null
          slug?: string
          sms_notifications_enabled?: boolean
          state?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_ledger: {
        Row: {
          accrued_at: string
          client_id: string
          commission_cents: number
          commission_pct: number
          currency: string
          gross_cents: number
          id: string
          metadata: Json
          paid_at: string | null
          payout_id: string | null
          sales_rep_id: string
          status: string
          stripe_invoice_id: string
          vests_at: string
        }
        Insert: {
          accrued_at?: string
          client_id: string
          commission_cents: number
          commission_pct: number
          currency?: string
          gross_cents: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          payout_id?: string | null
          sales_rep_id: string
          status?: string
          stripe_invoice_id: string
          vests_at?: string
        }
        Update: {
          accrued_at?: string
          client_id?: string
          commission_cents?: number
          commission_pct?: number
          currency?: string
          gross_cents?: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          payout_id?: string | null
          sales_rep_id?: string
          status?: string
          stripe_invoice_id?: string
          vests_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_ledger_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_ledger_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      content: {
        Row: {
          about_body: string | null
          about_eyebrow: string | null
          about_title: string | null
          booking_method: string
          booking_url: string | null
          client_id: string
          created_at: string
          gallery_title: string | null
          hero_cta_text: string | null
          hero_cta_url: string | null
          hero_headline: string | null
          hero_headline_emphasis: string | null
          hero_subheadline: string | null
          hours: Json | null
          id: string
          is_published: boolean
          menu: Json | null
          menu_eyebrow: string | null
          menu_title: string | null
          ordering_links: Json | null
          reservations_method: string | null
          reservations_url: string | null
          sections: Json
          services: Json | null
          services_eyebrow: string | null
          services_title: string | null
          social_links: Json | null
          theme: Json
          updated_at: string
          version: number
        }
        Insert: {
          about_body?: string | null
          about_eyebrow?: string | null
          about_title?: string | null
          booking_method?: string
          booking_url?: string | null
          client_id: string
          created_at?: string
          gallery_title?: string | null
          hero_cta_text?: string | null
          hero_cta_url?: string | null
          hero_headline?: string | null
          hero_headline_emphasis?: string | null
          hero_subheadline?: string | null
          hours?: Json | null
          id?: string
          is_published?: boolean
          menu?: Json | null
          menu_eyebrow?: string | null
          menu_title?: string | null
          ordering_links?: Json | null
          reservations_method?: string | null
          reservations_url?: string | null
          sections?: Json
          services?: Json | null
          services_eyebrow?: string | null
          services_title?: string | null
          social_links?: Json | null
          theme?: Json
          updated_at?: string
          version?: number
        }
        Update: {
          about_body?: string | null
          about_eyebrow?: string | null
          about_title?: string | null
          booking_method?: string
          booking_url?: string | null
          client_id?: string
          created_at?: string
          gallery_title?: string | null
          hero_cta_text?: string | null
          hero_cta_url?: string | null
          hero_headline?: string | null
          hero_headline_emphasis?: string | null
          hero_subheadline?: string | null
          hours?: Json | null
          id?: string
          is_published?: boolean
          menu?: Json | null
          menu_eyebrow?: string | null
          menu_title?: string | null
          ordering_links?: Json | null
          reservations_method?: string | null
          reservations_url?: string | null
          sections?: Json
          services?: Json | null
          services_eyebrow?: string | null
          services_title?: string | null
          social_links?: Json | null
          theme?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "content_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          client_id: string | null
          created_at: string
          id: string
          ip_hash: string | null
          metadata: Json | null
          type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          created_at?: string
          id?: string
          ip_hash?: string | null
          metadata?: Json | null
          type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          method: string
          notes: string | null
          paid_at: string
          reference: string | null
          sales_rep_id: string
          total_cents: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          sales_rep_id: string
          total_cents: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          method?: string
          notes?: string | null
          paid_at?: string
          reference?: string | null
          sales_rep_id?: string
          total_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "payouts_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          alt_text: string | null
          bytes: number | null
          client_id: string
          created_at: string
          height: number | null
          id: string
          position: number
          purpose: string
          r2_key: string
          source: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          bytes?: number | null
          client_id: string
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          purpose?: string
          r2_key: string
          source?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          bytes?: number | null
          client_id?: string
          created_at?: string
          height?: number | null
          id?: string
          position?: number
          purpose?: string
          r2_key?: string
          source?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_credentials: {
        Row: {
          access_token: string
          client_id: string
          created_at: string
          expires_at: string | null
          last_synced_at: string | null
          provider: string
          refresh_token: string | null
        }
        Insert: {
          access_token: string
          client_id: string
          created_at?: string
          expires_at?: string | null
          last_synced_at?: string | null
          provider: string
          refresh_token?: string | null
        }
        Update: {
          access_token?: string
          client_id?: string
          created_at?: string
          expires_at?: string | null
          last_synced_at?: string | null
          provider?: string
          refresh_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_credentials_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body_html: string
          client_id: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body_html?: string
          client_id: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body_html?: string
          client_id?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      rep_leads: {
        Row: {
          business_name: string
          client_id: string | null
          created_at: string
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          sales_rep_id: string
          status: string
          updated_at: string
        }
        Insert: {
          business_name: string
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          sales_rep_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          client_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          sales_rep_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rep_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rep_leads_sales_rep_id_fkey"
            columns: ["sales_rep_id"]
            isOneToOne: false
            referencedRelation: "sales_reps"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          body: string
          client_id: string
          created_at: string
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          source: string
          status: string
        }
        Insert: {
          body: string
          client_id: string
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source: string
          status?: string
        }
        Update: {
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_runs: {
        Row: {
          candidates_seen: number
          candidates_skipped_seen: number
          canonical_city: string
          error_message: string | null
          finished_at: string | null
          force_recheck_seen: boolean
          id: string
          leads_found: number
          location_input: string
          mobile_only: boolean
          niche: string
          niche_preset: string | null
          no_website_only: boolean
          places_api_calls: number
          started_at: string
          status: string
          target_count: number
          twilio_api_calls: number
        }
        Insert: {
          candidates_seen?: number
          candidates_skipped_seen?: number
          canonical_city: string
          error_message?: string | null
          finished_at?: string | null
          force_recheck_seen?: boolean
          id?: string
          leads_found?: number
          location_input: string
          mobile_only?: boolean
          niche: string
          niche_preset?: string | null
          no_website_only?: boolean
          places_api_calls?: number
          started_at?: string
          status?: string
          target_count: number
          twilio_api_calls?: number
        }
        Update: {
          candidates_seen?: number
          candidates_skipped_seen?: number
          canonical_city?: string
          error_message?: string | null
          finished_at?: string | null
          force_recheck_seen?: boolean
          id?: string
          leads_found?: number
          location_input?: string
          mobile_only?: boolean
          niche?: string
          niche_preset?: string | null
          no_website_only?: boolean
          places_api_calls?: number
          started_at?: string
          status?: string
          target_count?: number
          twilio_api_calls?: number
        }
        Relationships: []
      }
      scraped_seen_places: {
        Row: {
          canonical_city: string
          decision: string
          first_seen_at: string
          last_run_id: string | null
          last_seen_at: string
          niche: string
          place_id: string
        }
        Insert: {
          canonical_city: string
          decision: string
          first_seen_at?: string
          last_run_id?: string | null
          last_seen_at?: string
          niche: string
          place_id: string
        }
        Update: {
          canonical_city?: string
          decision?: string
          first_seen_at?: string
          last_run_id?: string | null
          last_seen_at?: string
          niche?: string
          place_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraped_seen_places_last_run_id_fkey"
            columns: ["last_run_id"]
            isOneToOne: false
            referencedRelation: "scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      scraped_leads: {
        Row: {
          address: string | null
          business_name: string
          canonical_city: string
          line_type: string | null
          location_input: string
          niche: string
          normalized_phone: string
          phone: string
          place_id: string
          rating: number | null
          review_count: number | null
          scrape_run_id: string
          scraped_at: string
          uses_social_as_website: boolean
          website_uri: string | null
        }
        Insert: {
          address?: string | null
          business_name: string
          canonical_city: string
          line_type?: string | null
          location_input: string
          niche: string
          normalized_phone: string
          phone: string
          place_id: string
          rating?: number | null
          review_count?: number | null
          scrape_run_id: string
          scraped_at?: string
          uses_social_as_website?: boolean
          website_uri?: string | null
        }
        Update: {
          address?: string | null
          business_name?: string
          canonical_city?: string
          line_type?: string | null
          location_input?: string
          niche?: string
          normalized_phone?: string
          phone?: string
          place_id?: string
          rating?: number | null
          review_count?: number | null
          scrape_run_id?: string
          scraped_at?: string
          uses_social_as_website?: boolean
          website_uri?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scraped_leads_scrape_run_id_fkey"
            columns: ["scrape_run_id"]
            isOneToOne: false
            referencedRelation: "scrape_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: string
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      sales_reps: {
        Row: {
          approved_at: string | null
          code: string
          commission_pct: number
          created_at: string
          email: string | null
          id: string
          kind: string
          name: string | null
          payout_destination: string | null
          payout_method: string | null
          phone: string | null
          status: string
          stripe_connect_account_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          code: string
          commission_pct?: number
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string | null
          payout_destination?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          code?: string
          commission_pct?: number
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          name?: string | null
          payout_destination?: string | null
          payout_method?: string | null
          phone?: string | null
          status?: string
          stripe_connect_account_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppression_list: {
        Row: {
          created_at: string
          email: string | null
          id: string
          phone: string | null
          reason: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          reason: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          reason?: string
          source?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
