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
          share_code_id: string | null
          user_id: string
          viewer_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          document_id?: string | null
          id?: number
          share_code_id?: string | null
          user_id: string
          viewer_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          document_id?: string | null
          id?: number
          share_code_id?: string | null
          user_id?: string
          viewer_id?: string | null
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
      appointments: {
        Row: {
          coverage: string
          created_at: string
          id: string
          mode: string
          patient_id: string
          provider_id: string
          share_code_id: string | null
          slot_id: string
          status: string
        }
        Insert: {
          coverage?: string
          created_at?: string
          id?: string
          mode: string
          patient_id?: string
          provider_id: string
          share_code_id?: string | null
          slot_id: string
          status?: string
        }
        Update: {
          coverage?: string
          created_at?: string
          id?: string
          mode?: string
          patient_id?: string
          provider_id?: string
          share_code_id?: string | null
          slot_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "availability_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      availability_slots: {
        Row: {
          booked: boolean
          duration_min: number
          id: string
          provider_id: string
          starts_at: string
        }
        Insert: {
          booked?: boolean
          duration_min?: number
          id?: string
          provider_id: string
          starts_at: string
        }
        Update: {
          booked?: boolean
          duration_min?: number
          id?: string
          provider_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_slots_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
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
      family_access_grants: {
        Row: {
          basis: string
          categories: string[]
          created_at: string
          expires_at: string | null
          id: string
          owner_id: string
          revoked_at: string | null
          scope: string
          status: string
          viewer_id: string
        }
        Insert: {
          basis?: string
          categories?: string[]
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id: string
          revoked_at?: string | null
          scope?: string
          status?: string
          viewer_id: string
        }
        Update: {
          basis?: string
          categories?: string[]
          created_at?: string
          expires_at?: string | null
          id?: string
          owner_id?: string
          revoked_at?: string | null
          scope?: string
          status?: string
          viewer_id?: string
        }
        Relationships: []
      }
      family_requests: {
        Row: {
          created_at: string
          decided_at: string | null
          holder_card_number: string
          holder_id: string | null
          id: string
          plan_id: string
          requester_id: string
          status: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          holder_card_number: string
          holder_id?: string | null
          id?: string
          plan_id: string
          requester_id: string
          status?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          holder_card_number?: string
          holder_id?: string | null
          id?: string
          plan_id?: string
          requester_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_plans: {
        Row: {
          active: boolean
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      lab_profiles: {
        Row: {
          city: string
          cnpj: string
          created_at: string
          legal_name: string
          tech_lead_name: string
          tech_lead_registry: string
          uf: string
          user_id: string
        }
        Insert: {
          city: string
          cnpj: string
          created_at?: string
          legal_name: string
          tech_lead_name: string
          tech_lead_registry: string
          uf: string
          user_id?: string
        }
        Update: {
          city?: string
          cnpj?: string
          created_at?: string
          legal_name?: string
          tech_lead_name?: string
          tech_lead_registry?: string
          uf?: string
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
      plan_attempts: {
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
      plan_memberships: {
        Row: {
          card_number: string
          created_at: string
          holder_card_number: string | null
          id: string
          plan_id: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          card_number: string
          created_at?: string
          holder_card_number?: string | null
          id?: string
          plan_id: string
          role: string
          status: string
          user_id: string
        }
        Update: {
          card_number?: string
          created_at?: string
          holder_card_number?: string | null
          id?: string
          plan_id?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_memberships_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_type: string
          billing_exempt: boolean
          created_at: string
          user_id: string
        }
        Insert: {
          account_type?: string
          billing_exempt?: boolean
          created_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          billing_exempt?: boolean
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_plans: {
        Row: {
          plan_id: string
          provider_id: string
        }
        Insert: {
          plan_id: string
          provider_id: string
        }
        Update: {
          plan_id?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_plans_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_plans_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          address: string
          city: string
          created_at: string
          id: string
          in_person: boolean
          is_demo: boolean
          kind: string
          lat: number
          lng: number
          name: string
          price_private: number | null
          specialties: string[]
          telehealth: boolean
          uf: string
          user_id: string | null
        }
        Insert: {
          address?: string
          city: string
          created_at?: string
          id?: string
          in_person?: boolean
          is_demo?: boolean
          kind: string
          lat: number
          lng: number
          name: string
          price_private?: number | null
          specialties?: string[]
          telehealth?: boolean
          uf: string
          user_id?: string | null
        }
        Update: {
          address?: string
          city?: string
          created_at?: string
          id?: string
          in_person?: boolean
          is_demo?: boolean
          kind?: string
          lat?: number
          lng?: number
          name?: string
          price_private?: number | null
          specialties?: string[]
          telehealth?: boolean
          uf?: string
          user_id?: string | null
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          current_period_end: string | null
          environment: string
          provider_customer_id: string | null
          provider_subscription_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          environment?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          current_period_end?: string | null
          environment?: string
          provider_customer_id?: string | null
          provider_subscription_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_appointment_share: {
        Args: { _id: string; _share: string }
        Returns: undefined
      }
      book_slot: {
        Args: { _coverage: string; _mode: string; _slot: string }
        Returns: string
      }
      can_write_records: { Args: { _uid: string }; Returns: boolean }
      cancel_appointment: { Args: { _id: string }; Returns: undefined }
      reschedule_appointment: {
        Args: { _id: string; _new_slot: string }
        Returns: string
      }
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
