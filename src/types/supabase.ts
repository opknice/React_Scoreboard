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
      leagues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          season: string | null
          settings: Json
          slug: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          season?: string | null
          settings?: Json
          slug?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          season?: string | null
          settings?: Json
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          label1: string
          label2: string
          label3: string
          league_id: string
          match_date: string | null
          match_number: number
          score_a: number
          score_b: number
          status: string
          team_a_id: string | null
          team_a_name: string
          team_b_id: string | null
          team_b_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label1?: string
          label2?: string
          label3?: string
          league_id: string
          match_date?: string | null
          match_number: number
          score_a?: number
          score_b?: number
          status?: string
          team_a_id?: string | null
          team_a_name: string
          team_b_id?: string | null
          team_b_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label1?: string
          label2?: string
          label3?: string
          league_id?: string
          match_date?: string | null
          match_number?: number
          score_a?: number
          score_b?: number
          status?: string
          team_a_id?: string | null
          team_a_name?: string
          team_b_id?: string | null
          team_b_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_a_id_fkey"
            columns: ["team_a_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_team_b_id_fkey"
            columns: ["team_b_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          color_primary: string
          color_secondary: string
          created_at: string
          logo_browser_crop_metadata: Json | null
          overlay_crop_metadata: Json | null
          id: string
          league_id: string
          logo_url: string | null
          name: string
          short_name: string | null
          updated_at: string
        }
        Insert: {
          color_primary?: string
          color_secondary?: string
          created_at?: string
          logo_browser_crop_metadata?: Json | null
          overlay_crop_metadata?: Json | null
          id?: string
          league_id: string
          logo_url?: string | null
          name: string
          short_name?: string | null
          updated_at?: string
        }
        Update: {
          color_primary?: string
          color_secondary?: string
          created_at?: string
          logo_browser_crop_metadata?: Json | null
          overlay_crop_metadata?: Json | null
          id?: string
          league_id?: string
          logo_url?: string | null
          name?: string
          short_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_league_id_fkey"
            columns: ["league_id"]
            isOneToOne: false
            referencedRelation: "leagues"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          id: string
          league_id: string
          team_id: string
          jersey_number: number
          name: string
          position: string
          image_url: string | null
          image_public_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          team_id: string
          jersey_number: number
          name: string
          position: string
          image_url?: string | null
          image_public_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          team_id?: string
          jersey_number?: number
          name?: string
          position?: string
          image_url?: string | null
          image_public_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_team_league_fkey"
            columns: ["team_id", "league_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id", "league_id"]
          }
        ]
      }
      player_match_stats: {
        Row: {
          id: string
          league_id: string
          match_id: string
          player_id: string
          team_id: string
          goals: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          match_id: string
          player_id: string
          team_id: string
          goals?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          match_id?: string
          player_id?: string
          team_id?: string
          goals?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_match_stats_player_league_fkey"
            columns: ["player_id", "league_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "league_id"]
          },
          {
            foreignKeyName: "player_match_stats_match_league_fkey"
            columns: ["match_id", "league_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id", "league_id"]
          }
        ]
      }
      user_permissions: {
        Row: {
          created_at: string
          display_name: string
          email: string
          id: string
          last_login: string
          photo_url: string
          status: string
          trial_started_at: number | null
          updated_at: string
          uploaded_image_count: number
          uploaded_player_image_count: number
        }
        Insert: {
          created_at?: string
          display_name?: string
          email: string
          id?: string
          last_login?: string
          photo_url?: string
          status?: string
          trial_started_at?: number | null
          updated_at?: string
          uploaded_image_count?: number
          uploaded_player_image_count?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          id?: string
          last_login?: string
          photo_url?: string
          status?: string
          trial_started_at?: number | null
          updated_at?: string
          uploaded_image_count?: number
          uploaded_player_image_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_user_permissions: {
        Args: never
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          last_login: string
          photo_url: string
          status: string
          trial_started_at: number | null
          updated_at: string
          uploaded_image_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "user_permissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      admin_set_user_access_status: {
        Args: { p_email: string; p_status: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          last_login: string
          photo_url: string
          status: string
          trial_started_at: number | null
          updated_at: string
          uploaded_image_count: number
        }[]
        SetofOptions: {
          from: "*"
          to: "user_permissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      ensure_user_permission: {
        Args: { p_display_name?: string; p_email: string; p_photo_url?: string }
        Returns: {
          created_at: string
          display_name: string
          email: string
          id: string
          last_login: string
          photo_url: string
          status: string
          trial_started_at: number | null
          updated_at: string
          uploaded_image_count: number
        }
        SetofOptions: {
          from: "*"
          to: "user_permissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      increment_uploaded_image_count: { Args: never; Returns: number }
      can_upload_player_image: { Args: never; Returns: boolean }
      increment_uploaded_player_image_count: { Args: never; Returns: number }
      is_super_admin_email: { Args: { p_email: string }; Returns: boolean }
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
