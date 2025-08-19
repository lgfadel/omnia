import { create } from 'zustand';
import { ticketsRepoSupabase, type Ticket } from '@/repositories/ticketsRepo.supabase';

interface TicketsStore {
  tickets: Ticket[];
  loading: boolean;
  error: string | null;
  
  loadTickets: () => Promise<void>;
  getTicketById: (id: string) => Promise<Ticket | null>;
  createTicket: (ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>) => Promise<Ticket>;
  updateTicket: (id: string, ticket: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>>) => Promise<Ticket | null>;
  deleteTicket: (id: string) => Promise<boolean>;
  searchTickets: (query: string) => Promise<Ticket[]>;
  clearError: () => void;
}

export const useTicketsStore = create<TicketsStore>((set, get) => ({
  tickets: [],
  loading: false,
  error: null,

  loadTickets: async () => {
    set({ loading: true, error: null });
    try {
      const tickets = await ticketsRepoSupabase.list();
      set({ tickets, loading: false });
    } catch (error) {
      console.error('Erro ao carregar tickets:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
    }
  },

  getTicketById: async (id: string) => {
    set({ loading: true, error: null });
    try {
      const ticket = await ticketsRepoSupabase.getById(id);
      set({ loading: false });
      return ticket;
    } catch (error) {
      console.error('Erro ao buscar ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      return null;
    }
  },

  createTicket: async (ticketData: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>) => {
    set({ loading: true, error: null });
    try {
      const newTicket = await ticketsRepoSupabase.create(ticketData);
      const currentTickets = get().tickets;
      set({ 
        tickets: [newTicket, ...currentTickets],
        loading: false 
      });
      return newTicket;
    } catch (error) {
      console.error('Erro ao criar ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  updateTicket: async (id: string, ticketData: Partial<Omit<Ticket, 'id' | 'createdAt' | 'updatedAt' | 'commentCount'>>) => {
    set({ loading: true, error: null });
    try {
      const updatedTicket = await ticketsRepoSupabase.update(id, ticketData);
      if (updatedTicket) {
        const currentTickets = get().tickets;
        const updatedTickets = currentTickets.map(ticket => 
          ticket.id === id ? updatedTicket : ticket
        );
        set({ 
          tickets: updatedTickets,
          loading: false 
        });
      }
      return updatedTicket;
    } catch (error) {
      console.error('Erro ao atualizar ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  deleteTicket: async (id: string) => {
    set({ loading: true, error: null });
    try {
      await ticketsRepoSupabase.remove(id);
      const currentTickets = get().tickets;
      const updatedTickets = currentTickets.filter(ticket => ticket.id !== id);
      set({ 
        tickets: updatedTickets,
        loading: false 
      });
      return true;
    } catch (error) {
      console.error('Erro ao deletar ticket:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      throw error;
    }
  },

  searchTickets: async (query: string) => {
    set({ loading: true, error: null });
    try {
      const tickets = await ticketsRepoSupabase.search(query);
      set({ tickets, loading: false });
      return tickets;
    } catch (error) {
      console.error('Erro ao buscar tickets:', error);
      set({ 
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        loading: false 
      });
      return [];
    }
  },

  clearError: () => set({ error: null }),
}));