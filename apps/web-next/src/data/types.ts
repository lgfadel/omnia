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

export type AtaTranscriptionStatus = 'uploading' | 'queued' | 'processing' | 'completed' | 'failed'

export type AtaTranscriptionStage = 'downloading' | 'splitting' | 'transcribing' | 'saving';

export interface AtaTranscriptionJob {
  id: string;
  ataId: string;
  status: AtaTranscriptionStatus;
  originalFilename: string;
  errorMessage?: string;
  attemptCount: number;
  createdAt: string;
  totalChunks?: number;
  processedChunks: number;
  stage?: AtaTranscriptionStage;
}

export interface AtaTranscription {
  id: string;
  jobId: string;
  rawText: string;
  revisedText?: string;
  language: string;
  isReviewed: boolean;
}

export type AtaMinutaStatus = 'generating' | 'ready' | 'failed'

export type AtaMinutaVersionOrigin = 'generation' | 'chat' | 'manual'

export type AtaMinutaMessageRole = 'user' | 'assistant'

export type AtaMinutaDocumentKind = 'convocacao' | 'apuracao' | 'outro'

export interface AtaMinuta {
  id: string;
  ataId: string;
  transcriptionId?: string;
  content: string;
  status: AtaMinutaStatus;
  errorMessage?: string;
  model?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AtaMinutaVersion {
  id: string;
  minutaId: string;
  sequence: number;
  content: string;
  origin: AtaMinutaVersionOrigin;
  model?: string;
  usage?: Record<string, unknown>;
  createdAt: string;
}

export interface AtaMinutaMessage {
  id: string;
  minutaId: string;
  sequence: number;
  role: AtaMinutaMessageRole;
  content: string;
  versionId?: string;
  createdAt: string;
}

export interface AtaMinutaDocument {
  id: string;
  ataId: string;
  kind: AtaMinutaDocumentKind;
  originalFilename: string;
  sizeBytes: number;
  createdAt: string;
}

export type AtaMinutaReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

export interface AtaMinutaSettings {
  model: string;
  reasoningEffort: AtaMinutaReasoningEffort;
  systemPrompt: string;
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
  oportunidadeId?: string; // ID da oportunidade do CRM vinculada (opcional)
}

// Interface simplificada para dropdown de oportunidades
export interface CrmLeadOption {
  id: string;
  cliente: string;
  status: string;
}
