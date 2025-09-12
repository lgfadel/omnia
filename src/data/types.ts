// Core TypeScript interfaces for the application
import type { TarefaPrioridade } from '@/repositories/tarefasRepo.supabase'

export type Role = 'ADMIN' | 'SECRETARIO' | 'USUARIO'

export interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
}

export interface UserRef {
  id: string
  name: string
  email: string
  roles: Role[]
  avatarUrl?: string
  color?: string
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  sizeKB?: number;
  mime?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  author?: UserRef; // Make author optional since it's handled by the repository
  body: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Ata {
  id: string;
  code?: string;
  title: string;
  description?: string;
  meetingDate?: string;
  createdAt: string;
  updatedAt: string;
  secretary?: UserRef;
  responsible?: UserRef;
  statusId: string;
  condominiumId?: string;
  ticket?: string;
  tags?: string[];
  commentCount?: number;
  attachments?: Attachment[];
  comments?: Comment[];
}

export interface Tarefa {
  id: string;
  title: string;
  description?: string;
  priority: TarefaPrioridade;
  dueDate?: string;
  ticket?: string;
  statusId: string;
  assignedTo?: UserRef;
  createdBy?: UserRef;
  tags: string[];
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}