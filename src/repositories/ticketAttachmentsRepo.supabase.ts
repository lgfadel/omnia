import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://elmxwvimjxcswjbrzznq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsbXh3dmltanhjc3dqYnJ6em5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyMDQ1NjIsImV4cCI6MjA3MDc4MDU2Mn0.nkapAcvAok4QNPSlLwkfTEbbj90nXJf3gRvBZauMfqI";

const supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

export interface TicketAttachment {
  id: string;
  ticket_id: string;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type: string | null;
  size_kb: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface CreateTicketAttachment {
  ticket_id: string;
  comment_id?: string | null;
  name: string;
  url: string;
  mime_type?: string | null;
  size_kb?: number | null;
  uploaded_by?: string | null;
}

export const ticketAttachmentsRepoSupabase = {
  async list(ticketId: string) {
    const { data, error } = await supabaseClient
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listByComment(commentId: string) {
    const { data, error } = await supabaseClient
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('comment_id', commentId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async listDirectTicketAttachments(ticketId: string) {
    const { data, error } = await supabaseClient
      .from('omnia_ticket_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .is('comment_id', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async create(attachment: CreateTicketAttachment) {
    const { data, error } = await supabaseClient
      .from('omnia_ticket_attachments')
      .insert(attachment)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async remove(id: string) {
    const { error } = await supabaseClient
      .from('omnia_ticket_attachments')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  },
};