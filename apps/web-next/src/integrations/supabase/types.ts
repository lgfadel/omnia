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
        Relationships: [
          {
            foreignKeyName: "fk_atas_secretary"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_atas_condominium_id_fkey"
            columns: ["condominium_id"]
            isOneToOne: false
            referencedRelation: "omnia_condominiums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_atas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_atas_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_atas_secretary_id_fkey"
            columns: ["secretary_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_atas_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "omnia_statuses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_attachments_ata"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_attachments_comment"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_attachments_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "fk_comments_ata"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_author"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_comments_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_comments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_condominiums: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string | null
          created_by: string | null
          id: string
          manager_name: string | null
          name: string
          phone: string | null
          syndic_name: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_name?: string | null
          name: string
          phone?: string | null
          syndic_name?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          manager_name?: string | null
          name?: string
          phone?: string | null
          syndic_name?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      omnia_crm_attachments: {
        Row: {
          comment_id: string | null
          created_at: string
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
          created_at?: string
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
          created_at?: string
          id?: string
          lead_id?: string | null
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_crm_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_crm_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_crm_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          lead_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_crm_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_crm_leads: {
        Row: {
          administradora_atual: string | null
          assigned_to: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          cliente: string
          comment_count: number | null
          complemento: string | null
          created_at: string
          created_by: string | null
          estado: string | null
          id: string
          logradouro: string | null
          numero: string | null
          numero_funcionarios_proprios: number | null
          numero_funcionarios_terceirizados: number | null
          numero_unidades: number | null
          observacoes: string | null
          origem_id: string | null
          responsavel_negociacao: string | null
          sindico_email: string | null
          sindico_nome: string | null
          sindico_telefone: string | null
          sindico_whatsapp: string | null
          status: string
          updated_at: string
          valor_proposta: number | null
        }
        Insert: {
          administradora_atual?: string | null
          assigned_to?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente: string
          comment_count?: number | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          numero_funcionarios_proprios?: number | null
          numero_funcionarios_terceirizados?: number | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          responsavel_negociacao?: string | null
          sindico_email?: string | null
          sindico_nome?: string | null
          sindico_telefone?: string | null
          sindico_whatsapp?: string | null
          status: string
          updated_at?: string
          valor_proposta?: number | null
        }
        Update: {
          administradora_atual?: string | null
          assigned_to?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cliente?: string
          comment_count?: number | null
          complemento?: string | null
          created_at?: string
          created_by?: string | null
          estado?: string | null
          id?: string
          logradouro?: string | null
          numero?: string | null
          numero_funcionarios_proprios?: number | null
          numero_funcionarios_terceirizados?: number | null
          numero_unidades?: number | null
          observacoes?: string | null
          origem_id?: string | null
          responsavel_negociacao?: string | null
          sindico_email?: string | null
          sindico_nome?: string | null
          sindico_telefone?: string | null
          sindico_whatsapp?: string | null
          status?: string
          updated_at?: string
          valor_proposta?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_responsavel_negociacao"
            columns: ["responsavel_negociacao"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_crm_leads_origem_id_fkey"
            columns: ["origem_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_origens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_crm_leads_status_id_fkey"
            columns: ["status"]
            isOneToOne: false
            referencedRelation: "omnia_crm_statuses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "omnia_menu_items"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_notifications_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_notifications_ticket_comment_id_fkey"
            columns: ["ticket_comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_notifications_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "omnia_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_rescisao_attachments: {
        Row: {
          created_at: string | null
          id: string
          mime_type: string | null
          name: string
          rescisao_id: string
          size_kb: number | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name: string
          rescisao_id: string
          size_kb?: number | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          mime_type?: string | null
          name?: string
          rescisao_id?: string
          size_kb?: number | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_demissao_attachments_demissao_id_fkey"
            columns: ["rescisao_id"]
            isOneToOne: false
            referencedRelation: "omnia_rescisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_demissao_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_rescisao_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string | null
          id: string
          rescisao_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string | null
          id?: string
          rescisao_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string | null
          id?: string
          rescisao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_demissao_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_demissao_comments_demissao_id_fkey"
            columns: ["rescisao_id"]
            isOneToOne: false
            referencedRelation: "omnia_rescisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_rescisao_statuses: {
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
      omnia_rescisoes: {
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
            foreignKeyName: "omnia_demissoes_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_demissoes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_demissoes_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "omnia_rescisao_statuses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_role_permissions_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "omnia_menu_items"
            referencedColumns: ["id"]
          },
        ]
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
          color?: string
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
        Relationships: [
          {
            foreignKeyName: "omnia_tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_ticket_attachments: {
        Row: {
          comment_id: string | null
          created_at: string
          id: string
          mime_type: string | null
          name: string
          size_kb: number | null
          ticket_id: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name: string
          size_kb?: number | null
          ticket_id: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string
          id?: string
          mime_type?: string | null
          name?: string
          size_kb?: number | null
          ticket_id?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_ticket_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_ticket_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_ticket_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          created_by: string | null
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ticket_id?: string
        }
        Relationships: []
      }
      omnia_ticket_statuses: {
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
      omnia_tickets: {
        Row: {
          assigned_to: string | null
          attachment_count: number
          comment_count: number | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_private: boolean | null
          oportunidade_id: string | null
          priority: Database["public"]["Enums"]["ticket_priority"]
          status_id: string
          tags: string[] | null
          ticket_id: number
          ticket_octa: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          attachment_count?: number
          comment_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          oportunidade_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status_id: string
          tags?: string[] | null
          ticket_id: number
          ticket_octa?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          attachment_count?: number
          comment_count?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_private?: boolean | null
          oportunidade_id?: string | null
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status_id?: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_omnia_tickets_oportunidade_id"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_tickets_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "omnia_ticket_statuses"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_user_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_user_permissions_menu_item_id_fkey"
            columns: ["menu_item_id"]
            isOneToOne: false
            referencedRelation: "omnia_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_user_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
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
      omnia_crm_lead_comment_counts: {
        Row: {
          comment_count: number | null
          lead_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnia_crm_comments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_current_user_menu_permission: {
        Args: { p_menu_item_path: string }
        Returns: boolean
      }
      check_user_menu_permission: {
        Args: { p_menu_item_path: string; p_user_id: string }
        Returns: boolean
      }
      generate_user_color: { Args: { user_id: string }; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_current_user_roles: { Args: never; Returns: string[] }
      get_user_accessible_menu_items: {
        Args: { p_user_id: string }
        Returns: {
          can_access: boolean
          icon: string
          id: string
          name: string
          order_index: number
          parent_id: string
          path: string
        }[]
      }
      get_user_permissions_summary: {
        Args: { p_user_id: string }
        Returns: {
          can_access: boolean
          granted_at: string
          granted_by_name: string
          menu_item_id: string
          menu_item_name: string
          menu_item_path: string
          permission_source: string
        }[]
      }
      is_admin_user: { Args: { user_id: string }; Returns: boolean }
      is_current_user_admin: { Args: never; Returns: boolean }
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
      crm_negotiation_status: [
        "novo",
        "qualificado",
        "proposta_enviada",
        "em_negociacao",
        "on_hold",
        "ganho",
        "perdido",
      ],
      ticket_priority: ["URGENTE", "ALTA", "NORMAL", "BAIXA"],
    },
  },
} as const
