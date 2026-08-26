export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type TableDefinition<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      leagues: TableDefinition<
        {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          is_public: boolean;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          is_public?: boolean;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        },
        {
          name?: string;
          owner_id?: string;
          slug?: string;
          is_public?: boolean;
          is_active?: boolean;
          updated_at?: string;
        }
      >;
      profiles: TableDefinition<
        {
          id: string;
          email: string;
          display_name: string;
          photo_url: string;
          created_at: string;
          updated_at: string;
        },
        {
          id: string;
          email: string;
          display_name?: string;
          photo_url?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          email?: string;
          display_name?: string;
          photo_url?: string;
          updated_at?: string;
        }
      >;
      user_access: TableDefinition<
        {
          user_id: string;
          status: 'allowed' | 'pending' | 'denied';
          trial_started_at: string | null;
          last_login_at: string | null;
          uploaded_image_count: number;
          created_at: string;
          updated_at: string;
        },
        {
          user_id: string;
          status?: 'allowed' | 'pending' | 'denied';
          trial_started_at?: string | null;
          last_login_at?: string | null;
          uploaded_image_count?: number;
          created_at?: string;
          updated_at?: string;
        },
        {
          status?: 'allowed' | 'pending' | 'denied';
          trial_started_at?: string | null;
          last_login_at?: string | null;
          uploaded_image_count?: number;
          updated_at?: string;
        }
      >;
      user_roles: TableDefinition<
        { user_id: string; role: 'super_admin' | 'operator' | 'viewer'; created_at: string },
        { user_id: string; role: 'super_admin' | 'operator' | 'viewer'; created_at?: string },
        { role?: 'super_admin' | 'operator' | 'viewer' }
      >;
      league_memberships: TableDefinition<
        { user_id: string; league_id: string; role: 'operator' | 'viewer'; created_at: string },
        { user_id: string; league_id: string; role?: 'operator' | 'viewer'; created_at?: string },
        { role?: 'operator' | 'viewer' }
      >;
      teams: TableDefinition<
        {
          id: string;
          league_id: string;
          team_key: string;
          name: string;
          logo_url: string;
          crop_metadata: Json | null;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          league_id: string;
          team_key: string;
          name: string;
          logo_url?: string;
          crop_metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        },
        {
          team_key?: string;
          name?: string;
          logo_url?: string;
          crop_metadata?: Json | null;
          updated_at?: string;
        }
      >;
      matches: TableDefinition<
        {
          id: string;
          league_id: string;
          match_date: string | null;
          team_a: string;
          team_b: string;
          score_a: number;
          score_b: number;
          round_label: string;
          match_url: string;
          logo_a: string;
          logo_b: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          league_id: string;
          match_date?: string | null;
          team_a: string;
          team_b: string;
          score_a?: number;
          score_b?: number;
          round_label?: string;
          match_url?: string;
          logo_a?: string;
          logo_b?: string;
          created_at?: string;
          updated_at?: string;
        },
        {
          league_id?: string;
          match_date?: string | null;
          team_a?: string;
          team_b?: string;
          score_a?: number;
          score_b?: number;
          round_label?: string;
          match_url?: string;
          logo_a?: string;
          logo_b?: string;
          updated_at?: string;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      record_user_login: { Args: Record<string, never>; Returns: undefined };
      increment_image_upload_count: { Args: { amount?: number }; Returns: number };
      admin_set_user_access: { Args: { target_user_id: string; next_status: 'allowed' | 'pending' | 'denied' }; Returns: undefined };
      create_overlay_access_token: { Args: { target_league_id: string; ttl_seconds?: number }; Returns: { access_token: string; expires_at: string }[] };
      read_overlay_snapshot: { Args: { request_token: string }; Returns: Json | null };
      revoke_overlay_access_tokens: { Args: { target_league_id: string }; Returns: undefined };
      set_league_public_overlay: { Args: { target_league_id: string; enabled: boolean }; Returns: undefined };
      read_public_overlay_snapshot: { Args: { target_league_id: string }; Returns: Json | null };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
