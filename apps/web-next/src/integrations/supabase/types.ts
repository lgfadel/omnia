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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      omnia_administradoras: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          tipo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_admissao_attachments: {
        Row: {
          admissao_id: string
          created_at: string | null
          id: string
          mime_type: string | null
          name: string
          size_kb: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          admissao_id: string
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_kb?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          admissao_id?: string
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_admissao_attachments_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "omnia_admissoes"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_admissao_comments: {
        Row: {
          admissao_id: string
          author_id: string
          body: string
          created_at: string | null
          id: string
        }
        Insert: {
          admissao_id: string
          author_id: string
          body: string
          created_at?: string | null
          id?: string
        }
        Update: {
          admissao_id?: string
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_admissao_comments_admissao_id_fkey"
            columns: ["admissao_id"]
            isOneToOne: false
            referencedRelation: "omnia_admissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_admissao_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_admissao_statuses: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          order_position: number
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          order_position: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          order_position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_admissoes: {
        Row: {
          assigned_to: string | null
          attachment_count: number | null
          comment_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_private: boolean | null
          priority: string
          status_id: string
          tags: string[] | null
          ticket_id: number
          ticket_octa: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_count?: number | null
          comment_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          priority?: string
          status_id: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_count?: number | null
          comment_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          priority?: string
          status_id?: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnia_admissoes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_admissoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_admissoes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "omnia_admissao_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_atas: {
        Row: {
          code: string
          comment_count: number | null
          condominium_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          meeting_date: string | null
          responsible_id: string | null
          secretary_id: string | null
          status_id: string
          tags: string[] | null
          ticket: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          comment_count?: number | null
          condominium_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          meeting_date?: string | null
          responsible_id?: string | null
          secretary_id?: string | null
          status_id: string
          tags?: string[] | null
          ticket?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          comment_count?: number | null
          condominium_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          meeting_date?: string | null
          responsible_id?: string | null
          secretary_id?: string | null
          status_id?: string
          tags?: string[] | null
          ticket?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnia_attachments: {
        Row: {
          ata_id: string | null
          comment_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_kb: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          ata_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_kb?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          ata_id?: string | null
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      omnia_comments: {
        Row: {
          ata_id: string
          author_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
        }
        Insert: {
          ata_id: string
          author_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Update: {
          ata_id?: string
          author_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
        }
        Relationships: []
      }
      omnia_condominiums: {
        Row: {
          administradora_id: string | null
          address: string | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          administradora_id?: string | null
          address?: string | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          administradora_id?: string | null
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnia_crm_attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          lead_id: string | null
          mime_type: string | null
          name: string
          size_kb: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          name: string
          size_kb?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      omnia_crm_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          lead_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: []
      }
      omnia_crm_leads: {
        Row: {
          administradora: string | null
          cnpj: string | null
          contato_email: string | null
          contato_nome: string | null
          contato_telefone: string | null
          created_at: string | null
          id: string
          nome: string
          numero_unidades: number | null
          observacoes: string | null
          origem_id: string | null
          responsavel_negociacao: string | null
          status: string
          updated_at: string | null
          valor_estimado: number | null
        }
        Insert: {
          administradora?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          id?: string
          nome: string
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          responsavel_negociacao?: string | null
          status: string
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Update: {
          administradora?: string | null
          cnpj?: string | null
          contato_email?: string | null
          contato_nome?: string | null
          contato_telefone?: string | null
          created_at?: string | null
          id?: string
          nome?: string
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          responsavel_negociacao?: string | null
          status?: string
          updated_at?: string | null
          valor_estimado?: number | null
        }
        Relationships: []
      }
      omnia_crm_origens: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_crm_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          order_position: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          order_position: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          order_position?: number
          updated_at?: string
        }
        Relationships: []
      }
      omnia_menu_items: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number
          parent_id: string | null
          path: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number
          parent_id?: string | null
          path: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number
          parent_id?: string | null
          path?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_notifications: {
        Row: {
          ata_id: string | null
          comment_id: string | null
          created_at: string
          created_by: string | null
          id: string
          read_at: string | null
          ticket_comment_id: string | null
          ticket_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          ata_id?: string | null
          comment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          read_at?: string | null
          ticket_comment_id?: string | null
          ticket_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          ata_id?: string | null
          comment_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          read_at?: string | null
          ticket_comment_id?: string | null
          ticket_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      omnia_role_permissions: {
        Row: {
          can_access: boolean
          created_at: string | null
          id: string
          menu_item_id: string
          role_name: string
          updated_at: string | null
        }
        Insert: {
          can_access?: boolean
          created_at?: string | null
          id?: string
          menu_item_id: string
          role_name: string
          updated_at?: string | null
        }
        Update: {
          can_access?: boolean
          created_at?: string | null
          id?: string
          menu_item_id?: string
          role_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          order_position: number
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          order_position: number
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          order_position?: number
          updated_at?: string
        }
        Relationships: []
      }
      omnia_tags: {
        Row: {
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      omnia_ticket_attachments: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          mime_type: string | null
          name: string
          size_kb: number | null
          ticket_id: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name: string
          size_kb?: number | null
          ticket_id?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          ticket_id?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      omnia_ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      omnia_ticket_statuses: {
        Row: {
          color: string
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          order_position: number
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          order_position: number
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          order_position?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_tickets: {
        Row: {
          assigned_to: string | null
          attachment_count: number | null
          comment_count: number | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_private: boolean | null
          oportunidade_id: string | null
          priority: string
          status_id: string
          tags: string[] | null
          ticket_id: number
          ticket_octa: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          attachment_count?: number | null
          comment_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          oportunidade_id?: string | null
          priority?: string
          status_id: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          attachment_count?: number | null
          comment_count?: number | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          oportunidade_id?: string | null
          priority?: string
          status_id?: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      omnia_user_permissions: {
        Row: {
          can_access: boolean
          created_at: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          menu_item_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_access?: boolean
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          menu_item_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_access?: boolean
          created_at?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          menu_item_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      omnia_users: {
        Row: {
          active: boolean | null
          auth_user_id: string | null
          avatar_url: string | null
          color: string | null
          created_at: string
          email: string
          id: string
          name: string
          roles: string[] | null
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          auth_user_id?: string | null
          avatar_url?: string | null
          color?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          roles?: string[] | null
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          auth_user_id?: string | null
          avatar_url?: string | null
          color?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          roles?: string[] | null
          updated_at?: string
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
      crm_negotiation_status:
        | "novo"
        | "qualificado"
        | "proposta_enviada"
        | "em_negociacao"
        | "on_hold"
        | "ganho"
        | "perdido"
      ticket_priority: "URGENTE" | "ALTA" | "NORMAL" | "BAIXA"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof Database
}
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof Database
}
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
