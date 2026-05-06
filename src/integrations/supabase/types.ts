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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          payload_json: Json | null
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload_json?: Json | null
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          payload_json?: Json | null
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_line_items: {
        Row: {
          amount: number
          category: string
          created_at: string
          formula_ref: string | null
          id: string
          label: string
          projection_id: string
          tenant_id: string
          year: number
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          formula_ref?: string | null
          id?: string
          label: string
          projection_id: string
          tenant_id: string
          year: number
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          formula_ref?: string | null
          id?: string
          label?: string
          projection_id?: string
          tenant_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "dre_line_items_projection_id_fkey"
            columns: ["projection_id"]
            isOneToOne: false
            referencedRelation: "financial_projections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_line_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_projections: {
        Row: {
          created_at: string
          horizon_years: number
          id: string
          inputs_json: Json
          scenario: Database["public"]["Enums"]["scenario_kind"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          horizon_years: number
          id?: string
          inputs_json?: Json
          scenario: Database["public"]["Enums"]["scenario_kind"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          horizon_years?: number
          id?: string
          inputs_json?: Json
          scenario?: Database["public"]["Enums"]["scenario_kind"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_projections_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_instances: {
        Row: {
          applied_to_team: string | null
          content_json: Json
          created_at: string
          framework_key: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          applied_to_team?: string | null
          content_json?: Json
          created_at?: string
          framework_key: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          applied_to_team?: string | null
          content_json?: Json
          created_at?: string
          framework_key?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "framework_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      framework_library: {
        Row: {
          category: string
          created_at: string
          description_md: string | null
          display_order: number
          example_md: string | null
          key: string
          name: string
          template_md: string | null
          when_to_apply: string | null
        }
        Insert: {
          category: string
          created_at?: string
          description_md?: string | null
          display_order?: number
          example_md?: string | null
          key: string
          name: string
          template_md?: string | null
          when_to_apply?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description_md?: string | null
          display_order?: number
          example_md?: string | null
          key?: string
          name?: string
          template_md?: string | null
          when_to_apply?: string | null
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["goal_level"]
          parent_goal_id: string | null
          status: string
          target_date: string | null
          target_unit: string | null
          target_value: number | null
          tenant_id: string
          title: string
          updated_at: string
          vision_plan_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level: Database["public"]["Enums"]["goal_level"]
          parent_goal_id?: string | null
          status?: string
          target_date?: string | null
          target_unit?: string | null
          target_value?: number | null
          tenant_id: string
          title: string
          updated_at?: string
          vision_plan_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["goal_level"]
          parent_goal_id?: string | null
          status?: string
          target_date?: string | null
          target_unit?: string | null
          target_value?: number | null
          tenant_id?: string
          title?: string
          updated_at?: string
          vision_plan_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_vision_plan_id_fkey"
            columns: ["vision_plan_id"]
            isOneToOne: false
            referencedRelation: "vision_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      key_results: {
        Row: {
          baseline: number | null
          created_at: string
          current: number | null
          id: string
          metric_type: string | null
          objective_id: string
          target: number | null
          tenant_id: string
          title: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          baseline?: number | null
          created_at?: string
          current?: number | null
          id?: string
          metric_type?: string | null
          objective_id: string
          target?: number | null
          tenant_id: string
          title: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          baseline?: number | null
          created_at?: string
          current?: number | null
          id?: string
          metric_type?: string | null
          objective_id?: string
          target?: number | null
          tenant_id?: string
          title?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "key_results_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "okrs_objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "key_results_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maturity_assessments: {
        Row: {
          answers_json: Json
          dimension: Database["public"]["Enums"]["maturity_dimension"]
          id: string
          score: number
          taken_at: string
          tenant_id: string
        }
        Insert: {
          answers_json?: Json
          dimension: Database["public"]["Enums"]["maturity_dimension"]
          id?: string
          score: number
          taken_at?: string
          tenant_id: string
        }
        Update: {
          answers_json?: Json
          dimension?: Database["public"]["Enums"]["maturity_dimension"]
          id?: string
          score?: number
          taken_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_assessments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      maturity_recommendations: {
        Row: {
          assessment_id: string | null
          created_at: string
          dimension: Database["public"]["Enums"]["maturity_dimension"]
          id: string
          priority: number
          recommendation_md: string
          tenant_id: string
        }
        Insert: {
          assessment_id?: string | null
          created_at?: string
          dimension: Database["public"]["Enums"]["maturity_dimension"]
          id?: string
          priority?: number
          recommendation_md: string
          tenant_id: string
        }
        Update: {
          assessment_id?: string | null
          created_at?: string
          dimension?: Database["public"]["Enums"]["maturity_dimension"]
          id?: string
          priority?: number
          recommendation_md?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maturity_recommendations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "maturity_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maturity_recommendations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["membership_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      okr_check_ins: {
        Row: {
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          key_result_id: string
          note: string | null
          tenant_id: string
          value: number | null
          week: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id: string
          note?: string | null
          tenant_id: string
          value?: number | null
          week: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          key_result_id?: string
          note?: string | null
          tenant_id?: string
          value?: number | null
          week?: string
        }
        Relationships: [
          {
            foreignKeyName: "okr_check_ins_key_result_id_fkey"
            columns: ["key_result_id"]
            isOneToOne: false
            referencedRelation: "key_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okr_check_ins_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      okrs_objectives: {
        Row: {
          created_at: string
          description: string | null
          id: string
          level: Database["public"]["Enums"]["okr_level"]
          owner_id: string | null
          parent_goal_id: string | null
          quarter: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["okr_level"]
          owner_id?: string | null
          parent_goal_id?: string | null
          quarter?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          level?: Database["public"]["Enums"]["okr_level"]
          owner_id?: string | null
          parent_goal_id?: string | null
          quarter?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "okrs_objectives_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "okrs_objectives_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      org_charts: {
        Row: {
          area: string
          created_at: string
          id: string
          structure_json: Json
          tenant_id: string
          updated_at: string
        }
        Insert: {
          area: string
          created_at?: string
          id?: string
          structure_json?: Json
          tenant_id: string
          updated_at?: string
        }
        Update: {
          area?: string
          created_at?: string
          id?: string
          structure_json?: Json
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_charts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_instances: {
        Row: {
          attendees_json: Json
          created_at: string
          id: string
          minutes_md: string | null
          ritual_id: string
          scheduled_at: string
          status: string
          tenant_id: string
        }
        Insert: {
          attendees_json?: Json
          created_at?: string
          id?: string
          minutes_md?: string | null
          ritual_id: string
          scheduled_at: string
          status?: string
          tenant_id: string
        }
        Update: {
          attendees_json?: Json
          created_at?: string
          id?: string
          minutes_md?: string | null
          ritual_id?: string
          scheduled_at?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_instances_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "rituals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritual_instances_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_templates: {
        Row: {
          agenda_json: Json
          cadence_cron: string | null
          created_at: string
          description: string | null
          display_order: number
          duration_minutes: number | null
          id: string
          kind: string
          name: string
        }
        Insert: {
          agenda_json?: Json
          cadence_cron?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id: string
          kind: string
          name: string
        }
        Update: {
          agenda_json?: Json
          cadence_cron?: string | null
          created_at?: string
          description?: string | null
          display_order?: number
          duration_minutes?: number | null
          id?: string
          kind?: string
          name?: string
        }
        Relationships: []
      }
      rituals: {
        Row: {
          active: boolean
          agenda_json: Json
          cadence_cron: string | null
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["ritual_kind"]
          name: string
          owner_id: string | null
          template_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          agenda_json?: Json
          cadence_cron?: string | null
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["ritual_kind"]
          name: string
          owner_id?: string | null
          template_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          agenda_json?: Json
          cadence_cron?: string | null
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["ritual_kind"]
          name?: string
          owner_id?: string | null
          template_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rituals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      role_templates: {
        Row: {
          area: string
          created_at: string
          description: string | null
          framework_key: string | null
          framework_keys: string[]
          framework_summary: string | null
          id: string
          recommended_headcount_by_revenue: Json
          role_name: string
          seniority: string | null
        }
        Insert: {
          area: string
          created_at?: string
          description?: string | null
          framework_key?: string | null
          framework_keys?: string[]
          framework_summary?: string | null
          id?: string
          recommended_headcount_by_revenue?: Json
          role_name: string
          seniority?: string | null
        }
        Update: {
          area?: string
          created_at?: string
          description?: string | null
          framework_key?: string | null
          framework_keys?: string[]
          framework_summary?: string | null
          id?: string
          recommended_headcount_by_revenue?: Json
          role_name?: string
          seniority?: string | null
        }
        Relationships: []
      }
      sales_funnels: {
        Row: {
          conversion_rate: number | null
          created_at: string
          expected_revenue: number | null
          id: string
          lead_volume: number | null
          tenant_id: string
          ticket_avg: number | null
          updated_at: string
          year: number
        }
        Insert: {
          conversion_rate?: number | null
          created_at?: string
          expected_revenue?: number | null
          id?: string
          lead_volume?: number | null
          tenant_id: string
          ticket_avg?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          conversion_rate?: number | null
          created_at?: string
          expected_revenue?: number | null
          id?: string
          lead_volume?: number | null
          tenant_id?: string
          ticket_avg?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_funnels_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          onboarding_completed: boolean
          plan_locked: string
          revenue_band: string | null
          sector: string | null
          size_band: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          plan_locked?: string
          revenue_band?: string | null
          sector?: string | null
          size_band?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          onboarding_completed?: boolean
          plan_locked?: string
          revenue_band?: string | null
          sector?: string | null
          size_band?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          role_title: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role_title?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role_title?: string | null
          updated_at?: string
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
      vision_plans: {
        Row: {
          created_at: string
          id: string
          mission: string | null
          north_star: string | null
          tenant_id: string
          updated_at: string
          values_json: Json
          year_horizon: number
        }
        Insert: {
          created_at?: string
          id?: string
          mission?: string | null
          north_star?: string | null
          tenant_id: string
          updated_at?: string
          values_json?: Json
          year_horizon: number
        }
        Update: {
          created_at?: string
          id?: string
          mission?: string | null
          north_star?: string | null
          tenant_id?: string
          updated_at?: string
          values_json?: Json
          year_horizon?: number
        }
        Relationships: [
          {
            foreignKeyName: "vision_plans_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_app_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      compute_maturity_score: {
        Args: { p_answers: Json; p_tenant_id: string }
        Returns: Json
      }
      decompose_vision: { Args: { p_vision_id: string }; Returns: Json }
      ensure_tenant_for_user: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      init_projections: {
        Args: { p_horizon_years?: number; p_tenant_id: string }
        Returns: undefined
      }
      is_member:
        | { Args: { _tenant: string }; Returns: boolean }
        | { Args: { _tenant: string; _user: string }; Returns: boolean }
      is_tenant_admin:
        | { Args: { _tenant: string }; Returns: boolean }
        | { Args: { _tenant: string; _user: string }; Returns: boolean }
      log_event: {
        Args: {
          p_action: string
          p_entity_id?: string
          p_entity_type?: string
          p_payload?: Json
          p_tenant_id: string
        }
        Returns: string
      }
      revoke_app_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      start_assessment: { Args: { p_tenant_id: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      goal_level: "annual" | "quarter" | "month" | "week"
      maturity_dimension: "vision" | "okrs" | "rituals" | "team" | "financial"
      membership_role: "owner" | "admin" | "member" | "viewer"
      okr_level: "company" | "area" | "team" | "individual"
      ritual_kind: "daily" | "weekly" | "monthly" | "quarter" | "one_on_one"
      scenario_kind: "optimistic" | "realistic" | "pessimistic"
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
      app_role: ["admin", "user"],
      goal_level: ["annual", "quarter", "month", "week"],
      maturity_dimension: ["vision", "okrs", "rituals", "team", "financial"],
      membership_role: ["owner", "admin", "member", "viewer"],
      okr_level: ["company", "area", "team", "individual"],
      ritual_kind: ["daily", "weekly", "monthly", "quarter", "one_on_one"],
      scenario_kind: ["optimistic", "realistic", "pessimistic"],
    },
  },
} as const
