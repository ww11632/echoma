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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      ai_audit_logs: {
        Row: {
          api_endpoint: string
          completion_tokens: number | null
          created_at: string
          detected_keywords: string[] | null
          error_message: string | null
          id: string
          input_length: number
          input_summary: string
          language: string
          model_name: string
          prompt_tokens: number | null
          response_category: string
          response_length: number
          risk_level: string
          security_check_passed: boolean
          total_tokens: number | null
          truncation_reason: string | null
          user_id: string
          was_truncated: boolean
        }
        Insert: {
          api_endpoint: string
          completion_tokens?: number | null
          created_at?: string
          detected_keywords?: string[] | null
          error_message?: string | null
          id?: string
          input_length: number
          input_summary: string
          language?: string
          model_name: string
          prompt_tokens?: number | null
          response_category: string
          response_length: number
          risk_level: string
          security_check_passed: boolean
          total_tokens?: number | null
          truncation_reason?: string | null
          user_id: string
          was_truncated?: boolean
        }
        Update: {
          api_endpoint?: string
          completion_tokens?: number | null
          created_at?: string
          detected_keywords?: string[] | null
          error_message?: string | null
          id?: string
          input_length?: number
          input_summary?: string
          language?: string
          model_name?: string
          prompt_tokens?: number | null
          response_category?: string
          response_length?: number
          risk_level?: string
          security_check_passed?: boolean
          total_tokens?: number | null
          truncation_reason?: string | null
          user_id?: string
          was_truncated?: boolean
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          encrypted_key: string
          id: string
          is_active: boolean
          key_name: string
          last_rotated_at: string | null
          next_rotation_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          encrypted_key: string
          id?: string
          is_active?: boolean
          key_name: string
          last_rotated_at?: string | null
          next_rotation_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          encrypted_key?: string
          id?: string
          is_active?: boolean
          key_name?: string
          last_rotated_at?: string | null
          next_rotation_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      emotion_records: {
        Row: {
          blob_id: string | null
          created_at: string
          description: string | null
          emotion: Database["public"]["Enums"]["emotion_type"]
          encrypted_data: string | null
          id: string
          intensity: number
          is_public: boolean
          payload_hash: string | null
          proof_status: Database["public"]["Enums"]["proof_status"]
          sui_ref: string | null
          updated_at: string
          user_id: string
          walrus_url: string | null
        }
        Insert: {
          blob_id?: string | null
          created_at?: string
          description?: string | null
          emotion: Database["public"]["Enums"]["emotion_type"]
          encrypted_data?: string | null
          id?: string
          intensity: number
          is_public?: boolean
          payload_hash?: string | null
          proof_status?: Database["public"]["Enums"]["proof_status"]
          sui_ref?: string | null
          updated_at?: string
          user_id: string
          walrus_url?: string | null
        }
        Update: {
          blob_id?: string | null
          created_at?: string
          description?: string | null
          emotion?: Database["public"]["Enums"]["emotion_type"]
          encrypted_data?: string | null
          id?: string
          intensity?: number
          is_public?: boolean
          payload_hash?: string | null
          proof_status?: Database["public"]["Enums"]["proof_status"]
          sui_ref?: string | null
          updated_at?: string
          user_id?: string
          walrus_url?: string | null
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
      emotion_type:
        | "joy"
        | "sadness"
        | "anger"
        | "anxiety"
        | "confusion"
        | "peace"
      proof_status: "pending" | "confirmed" | "failed"
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
      emotion_type: [
        "joy",
        "sadness",
        "anger",
        "anxiety",
        "confusion",
        "peace",
      ],
      proof_status: ["pending", "confirmed", "failed"],
    },
  },
} as const
