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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_logs: {
        Row: {
          action: string
          created_at: string
          document_id: string | null
          id: number
          share_code_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          document_id?: string | null
          id?: number
          share_code_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string | null
          id?: number
          share_code_id?: string
          user_id?: string
        }
        Relationships: []
      }
      access_requests: {
        Row: {
          categories: string[]
          code: string
          created_at: string
          doctor_id: string
          expected_patient_id: string | null
          expires_at: string
          id: string
          include_profile: boolean
          patient_id: string | null
          period_months: number
          share_code_id: string | null
          signals: string[]
          status: string
        }
        Insert: {
          categories?: string[]
          code: string
          created_at?: string
          doctor_id?: string
          expected_patient_id?: string | null
          expires_at: string
          id?: string
          include_profile?: boolean
          patient_id?: string | null
          period_months: number
          share_code_id?: string | null
          signals?: string[]
          status?: string
        }
        Update: {
          categories?: string[]
          code?: string
          created_at?: string
          doctor_id?: string
          expected_patient_id?: string | null
          expires_at?: string
          id?: string
          include_profile?: boolean
          patient_id?: string | null
          period_months?: number
          share_code_id?: string | null
          signals?: string[]
          status?: string
        }
        Relationships: []
      }
      doctor_patients: {
        Row: {
          doctor_id: string
          last_seen_at: string
          patient_id: string
          patient_name: string
          patient_ref: string
        }
        Insert: {
          doctor_id: string
          last_seen_at?: string
          patient_id: string
          patient_name?: string
          patient_ref: string
        }
        Update: {
          doctor_id?: string
          last_seen_at?: string
          patient_id?: string
          patient_name?: string
          patient_ref?: string
        }
        Relationships: []
      }
      doctor_profiles: {
        Row: {
          created_at: string
          crm: string
          full_name: string
          specialty: string
          uf: string
          user_id: string
        }
        Insert: {
          created_at?: string
          crm: string
          full_name: string
          specialty?: string
          uf: string
          user_id?: string
        }
        Update: {
          created_at?: string
          crm?: string
          full_name?: string
          specialty?: string
          uf?: string
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          confirmed: boolean
          created_at: string
          doc_date: string | null
          fields: Json
          file_hash: string | null
          file_path: string | null
          file_type: string | null
          id: string
          kind: string
          origin: string
          source: string | null
          summary: string | null
          title: string
          user_id: string
        }
        Insert: {
          confirmed?: boolean
          created_at?: string
          doc_date?: string | null
          fields?: Json
          file_hash?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          kind?: string
          origin?: string
          source?: string | null
          summary?: string | null
          title: string
          user_id?: string
        }
        Update: {
          confirmed?: boolean
          created_at?: string
          doc_date?: string | null
          fields?: Json
          file_hash?: string | null
          file_path?: string | null
          file_type?: string | null
          id?: string
          kind?: string
          origin?: string
          source?: string | null
          summary?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      patient_profiles: {
        Row: {
          activity: string
          alcohol: string
          allergies: string
          birth_date: string | null
          conditions: string
          family_history: string
          full_name: string
          height_cm: number | null
          medications: Json
          questionnaire_completed: boolean
          smoking: string
          surgeries: string
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          activity?: string
          alcohol?: string
          allergies?: string
          birth_date?: string | null
          conditions?: string
          family_history?: string
          full_name?: string
          height_cm?: number | null
          medications?: Json
          questionnaire_completed?: boolean
          smoking?: string
          surgeries?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Update: {
          activity?: string
          alcohol?: string
          allergies?: string
          birth_date?: string | null
          conditions?: string
          family_history?: string
          full_name?: string
          height_cm?: number | null
          medications?: Json
          questionnaire_completed?: boolean
          smoking?: string
          surgeries?: string
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      request_attempts: {
        Row: {
          created_at: string
          id: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: number
          user_id?: string
        }
        Relationships: []
      }
      share_codes: {
        Row: {
          categories: string[]
          code: string
          created_at: string
          expires_at: string
          id: string
          include_profile: boolean
          period_months: number
          revoked: boolean
          signals: string[]
          user_id: string
        }
        Insert: {
          categories?: string[]
          code: string
          created_at?: string
          expires_at: string
          id?: string
          include_profile?: boolean
          period_months: number
          revoked?: boolean
          signals?: string[]
          user_id?: string
        }
        Update: {
          categories?: string[]
          code?: string
          created_at?: string
          expires_at?: string
          id?: string
          include_profile?: boolean
          period_months?: number
          revoked?: boolean
          signals?: string[]
          user_id?: string
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
