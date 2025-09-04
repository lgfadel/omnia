export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      omnia_atas: {
        Row: {
          code: string
          comment_count: number | null
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
      omnia_condominiums: {
        Row: {
          id: string
          name: string
          cnpj: string
          address: string | null
          phone: string | null
          whatsapp: string | null
          syndic_name: string | null
          manager_name: string | null
          created_at: string
          updated_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          name: string
          cnpj: string
          address?: string | null
          phone?: string | null
          whatsapp?: string | null
          syndic_name?: string | null
          manager_name?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          cnpj?: string
          address?: string | null
          phone?: string | null
          whatsapp?: string | null
          syndic_name?: string | null
          manager_name?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
        }
        Relationships: []
      }
      omnia_users: {
        Row: {
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[keyof Database]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] &
        PublicSchema['Views'])
    ? (PublicSchema['Tables'] &
        PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never