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
            foreignKeyName: "omnia_attachments_ata_id_fkey"
            columns: ["ata_id"]
            isOneToOne: false
            referencedRelation: "omnia_atas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_comments: {
        Row: {
          ata_id: string | null
          author_id: string
          body: string
          created_at: string
          id: string
        }
        Insert: {
          ata_id?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
        }
        Update: {
          ata_id?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
        }
        Relationships: [
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
        ]
      }
      omnia_condominiums: {
        Row: {
          address: string | null
          administradora_id: string | null
          ativo: boolean | null
          created_at: string | null
          id: string
          nome: string
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          administradora_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome: string
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          administradora_id?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnia_condominiums_administradora_id_fkey"
            columns: ["administradora_id"]
            isOneToOne: false
            referencedRelation: "omnia_administradoras"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_crm_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
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
          assigned_to: string | null
          comment_count: number | null
          company_name: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          estimated_value: number | null
          id: string
          last_contact_date: string | null
          negotiation_status: Database["public"]["Enums"]["crm_negotiation_status"]
          next_followup_date: string | null
          source: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          comment_count?: number | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          negotiation_status?: Database["public"]["Enums"]["crm_negotiation_status"]
          next_followup_date?: string | null
          source?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          comment_count?: number | null
          company_name?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          estimated_value?: number | null
          id?: string
          last_contact_date?: string | null
          negotiation_status?: Database["public"]["Enums"]["crm_negotiation_status"]
          next_followup_date?: string | null
          source?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "omnia_crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_crm_leads_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
      }
      omnia_menu_items: {
        Row: {
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          order_index: number | null
          parent_id: string | null
          path: string
        }
        Insert: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          order_index?: number | null
          parent_id?: string | null
          path: string
        }
        Update: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          order_index?: number | null
          parent_id?: string | null
          path?: string
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
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          message: string
          related_entity_id: string | null
          related_entity_type: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          message?: string
          related_entity_id?: string | null
          related_entity_type?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "omnia_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
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
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
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
        Relationships: [
          {
            foreignKeyName: "omnia_ticket_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "omnia_ticket_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_ticket_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "omnia_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_ticket_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "omnia_ticket_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "omnia_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "omnia_ticket_comments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "omnia_tickets"
            referencedColumns: ["id"]
          },
        ]
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
          priority: Database["public"]["Enums"]["ticket_priority"]
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
          priority?: Database["public"]["Enums"]["ticket_priority"]
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
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status_id?: string
          tags?: string[] | null
          ticket_id?: number
          ticket_octa?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
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
            foreignKeyName: "omnia_tickets_oportunidade_id_fkey"
            columns: ["oportunidade_id"]
            isOneToOne: false
            referencedRelation: "omnia_crm_leads"
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
      get_current_user_role: { Args: Record<PropertyKey, never>; Returns: string }
      get_current_user_roles: { Args: Record<PropertyKey, never>; Returns: string[] }
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
      is_current_user_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
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
