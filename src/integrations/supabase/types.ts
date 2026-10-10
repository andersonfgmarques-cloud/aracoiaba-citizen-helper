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
      ocorrencias: {
        Row: {
          categoria: string
          cpf: string | null
          created_at: string
          descricao: string
          endereco: string
          endereco_solicitante: string | null
          id: string
          nome: string
          observacao: string | null
          prioridade: string
          protocolo: string
          status: string
          telefone: string
          updated_at: string
          viatura: string | null
        }
        Insert: {
          categoria: string
          cpf?: string | null
          created_at?: string
          descricao: string
          endereco: string
          endereco_solicitante?: string | null
          id?: string
          nome: string
          observacao?: string | null
          prioridade?: string
          protocolo: string
          status?: string
          telefone: string
          updated_at?: string
          viatura?: string | null
        }
        Update: {
          categoria?: string
          cpf?: string | null
          created_at?: string
          descricao?: string
          endereco?: string
          endereco_solicitante?: string | null
          id?: string
          nome?: string
          observacao?: string | null
          prioridade?: string
          protocolo?: string
          status?: string
          telefone?: string
          updated_at?: string
          viatura?: string | null
        }
        Relationships: []
      }
      ocorrencia_historico: {
        Row: {
          acao: string
          criado_em: string
          id: string
          observacao: string | null
          ocorrencia_id: string
          operador_id: string
          status_anterior: string | null
          status_novo: string | null
          viatura: string | null
        }
        Insert: {
          acao: string
          criado_em?: string
          id?: string
          observacao?: string | null
          ocorrencia_id: string
          operador_id: string
          status_anterior?: string | null
          status_novo?: string | null
          viatura?: string | null
        }
        Update: {
          acao?: string
          criado_em?: string
          id?: string
          observacao?: string | null
          ocorrencia_id?: string
          operador_id?: string
          status_anterior?: string | null
          status_novo?: string | null
          viatura?: string | null
        }
        Relationships: []
      },
      operator_profiles: {
        Row: { user_id: string; nome_completo: string; matricula: string; cargo: string; lotacao: string; created_at: string; updated_at: string }
        Insert: { user_id: string; nome_completo: string; matricula: string; cargo: string; lotacao: string; created_at?: string; updated_at?: string }
        Update: { user_id?: string; nome_completo?: string; matricula?: string; cargo?: string; lotacao?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_list_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          user_id: string
          email: string | null
          created_at: string
          last_sign_in_at: string | null
          role: string
        }[]
      }
      admin_list_operator_profiles: {
        Args: Record<PropertyKey, never>
        Returns: { user_id: string; nome_completo: string; matricula: string; cargo: string; lotacao: string; email: string | null; updated_at: string }[]
      }
      admin_set_operator_access: {
        Args: { _user_id: string; _enabled: boolean }
        Returns: undefined
      }
      admin_list_occurrences: {
        Args: Record<PropertyKey, never>
        Returns: {
          id: string
          protocolo: string
          categoria: string
          status: string
          created_at: string
          viatura: string | null
        }[]
      }
      admin_list_audit: {
        Args: { _limit?: number }
        Returns: {
          id: string
          actor_email: string
          action: string
          target_user_id: string | null
          occurrence_id: string | null
          details: Json
          created_at: string
        }[]
      }
      admin_delete_occurrence: {
        Args: { _occurrence_id: string; _reason: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_operador: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "operador"
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
    Enums: {
      app_role: ["admin", "operador"],
    },
  },
} as const
