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
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "chat_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hire_verifications: {
        Row: {
          candidate_id_number: string | null
          candidate_name: string
          created_at: string
          criminal_flag: boolean
          id: string
          nepotism_flag: boolean
          outcome: string
          position: string
          qualifications: string[]
          reasons: Json
          requested_by: string
          risk_score: number
        }
        Insert: {
          candidate_id_number?: string | null
          candidate_name: string
          created_at?: string
          criminal_flag?: boolean
          id?: string
          nepotism_flag?: boolean
          outcome: string
          position: string
          qualifications?: string[]
          reasons?: Json
          requested_by: string
          risk_score?: number
        }
        Update: {
          candidate_id_number?: string | null
          candidate_name?: string
          created_at?: string
          criminal_flag?: boolean
          id?: string
          nepotism_flag?: boolean
          outcome?: string
          position?: string
          qualifications?: string[]
          reasons?: Json
          requested_by?: string
          risk_score?: number
        }
        Relationships: []
      }
      identity_verifications: {
        Row: {
          algo_valid: boolean
          citizenship: string | null
          claimed_name: string | null
          created_at: string
          date_of_birth: string | null
          duplicate_count: number
          gender: string | null
          id: string
          id_number: string
          outcome: string
          reasons: Json
          requested_by: string
          risk_score: number
        }
        Insert: {
          algo_valid: boolean
          citizenship?: string | null
          claimed_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_count?: number
          gender?: string | null
          id?: string
          id_number: string
          outcome: string
          reasons?: Json
          requested_by: string
          risk_score?: number
        }
        Update: {
          algo_valid?: boolean
          citizenship?: string | null
          claimed_name?: string | null
          created_at?: string
          date_of_birth?: string | null
          duplicate_count?: number
          gender?: string | null
          id?: string
          id_number?: string
          outcome?: string
          reasons?: Json
          requested_by?: string
          risk_score?: number
        }
        Relationships: []
      }
      integrity_audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          outcome: string | null
          payload: Json
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          outcome?: string | null
          payload?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          outcome?: string | null
          payload?: Json
          user_id?: string | null
        }
        Relationships: []
      }
      invoice_verifications: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_number: string
          outcome: string
          po_number: string | null
          reasons: Json
          requested_by: string
          risk_score: number
          vendor_name: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_number: string
          outcome: string
          po_number?: string | null
          reasons?: Json
          requested_by: string
          risk_score?: number
          vendor_name?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_number?: string
          outcome?: string
          po_number?: string | null
          reasons?: Json
          requested_by?: string
          risk_score?: number
          vendor_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sa_id_registry: {
        Row: {
          citizenship: string | null
          date_of_birth: string | null
          first_seen_at: string
          full_name: string | null
          gender: string | null
          id_number: string
          last_seen_at: string
          notes: string | null
          status: string
        }
        Insert: {
          citizenship?: string | null
          date_of_birth?: string | null
          first_seen_at?: string
          full_name?: string | null
          gender?: string | null
          id_number: string
          last_seen_at?: string
          notes?: string | null
          status?: string
        }
        Update: {
          citizenship?: string | null
          date_of_birth?: string | null
          first_seen_at?: string
          full_name?: string | null
          gender?: string | null
          id_number?: string
          last_seen_at?: string
          notes?: string | null
          status?: string
        }
        Relationships: []
      }
      tender_access_log: {
        Row: {
          allowed: boolean
          channel: string
          classification: string
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          tender_ref: string
          user_clearance: string
        }
        Insert: {
          allowed: boolean
          channel: string
          classification: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          tender_ref: string
          user_clearance: string
        }
        Update: {
          allowed?: boolean
          channel?: string
          classification?: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          tender_ref?: string
          user_clearance?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_verifications: {
        Row: {
          amount: number | null
          bank_verified: boolean
          cipc_exists: boolean
          company_age_days: number | null
          company_name: string
          created_at: string
          id: string
          outcome: string
          reasons: Json
          registration_number: string | null
          requested_by: string
          risk_score: number
          tax_clearance: boolean
        }
        Insert: {
          amount?: number | null
          bank_verified?: boolean
          cipc_exists?: boolean
          company_age_days?: number | null
          company_name: string
          created_at?: string
          id?: string
          outcome: string
          reasons?: Json
          registration_number?: string | null
          requested_by: string
          risk_score?: number
          tax_clearance?: boolean
        }
        Update: {
          amount?: number | null
          bank_verified?: boolean
          cipc_exists?: boolean
          company_age_days?: number | null
          company_name?: string
          created_at?: string
          id?: string
          outcome?: string
          reasons?: Json
          registration_number?: string | null
          requested_by?: string
          risk_score?: number
          tax_clearance?: boolean
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "auditor" | "officer" | "public"
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
    Enums: {
      app_role: ["admin", "auditor", "officer", "public"],
    },
  },
} as const
