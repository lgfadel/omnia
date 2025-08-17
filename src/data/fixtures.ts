export type Role = 'ADMIN' | 'SECRETARIO' | 'USUARIO'

export interface Status {
  id: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
}

export interface UserRef {
  id: string;
  name: string;
  email: string;
  roles: Role[];
  avatarUrl?: string;
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
  author: UserRef;
  body: string;
  createdAt: string;
  attachments?: Attachment[];
}

export interface Ata {
  id: string;
  title: string;
  description?: string;
  meetingDate?: string;
  createdAt: string;
  updatedAt: string;
  secretary?: UserRef;
  responsible?: UserRef;
  statusId: string;
  ticket?: string;
  tags?: string[];
  commentCount?: number;
  attachments?: Attachment[];
  comments?: Comment[];
}

export const FIXTURE_STATUSES: Status[] = [
  { id: 's1', name: 'Não iniciado', color: '#F59E0B', order: 1, isDefault: true },
  { id: 's2', name: 'Revisão/Correções', color: '#FBBF24', order: 2 },
  { id: 's3', name: 'Assinatura', color: '#F59E0B', order: 3 },
]

export const FIXTURE_USERS: UserRef[] = [
  { id: 'u1', name: 'Ana Souza', email: 'ana@exemplo.com', roles: ['SECRETARIO'] },
  { id: 'u2', name: 'Carlos Lima', email: 'carlos@exemplo.com', roles: ['SECRETARIO'] },
  { id: 'u3', name: 'Marina Reis', email: 'marina@exemplo.com', roles: ['ADMIN', 'SECRETARIO'] },
]

export const FIXTURE_ATAS: Ata[] = [
  {
    id: 'A-0001',
    title: 'Assembleia Ordinária — Bloco A',
    description: 'Pauta: Prestação de contas e eleição de síndico.',
    meetingDate: '2025-03-10',
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
    secretary: FIXTURE_USERS[2],
    responsible: FIXTURE_USERS[0],
    statusId: 's1',
    ticket: 'TCK-12345',
    tags: ['malote'],
    commentCount: 2,
    attachments: [{
      id: 'file1',
      name: 'edital.pdf',
      url: 'https://files.local/mock/edital.pdf',
      mime: 'application/pdf',
      createdAt: '2025-03-01T00:00:00.000Z'
    }],
    comments: [{
      id: 'c1',
      author: FIXTURE_USERS[1],
      body: 'Verificar correção na ata.',
      createdAt: '2025-03-02T00:00:00.000Z'
    }],
  },
  {
    id: 'A-0002',
    title: 'Assembleia Extraordinária — Garagem',
    meetingDate: '2025-04-02',
    createdAt: '2025-03-15T00:00:00.000Z',
    updatedAt: '2025-03-20T00:00:00.000Z',
    secretary: FIXTURE_USERS[0],
    responsible: FIXTURE_USERS[1],
    statusId: 's2',
    ticket: 'TCK-22311',
    tags: ['whatsapp'],
    commentCount: 0,
    attachments: [],
    comments: [],
  },
  {
    id: 'A-0003',
    title: 'Assembleia Ordinária — Bloco B',
    meetingDate: '2025-05-05',
    createdAt: '2025-04-01T00:00:00.000Z',
    updatedAt: '2025-04-03T00:00:00.000Z',
    secretary: FIXTURE_USERS[1],
    responsible: FIXTURE_USERS[2],
    statusId: 's3',
    ticket: 'TCK-99881',
    tags: [],
    commentCount: 1,
    attachments: [{
      id: 'file2',
      name: 'procuracao.docx',
      url: 'https://files.local/mock/procuracao.docx',
      createdAt: '2025-04-03T00:00:00.000Z'
    }],
    comments: [{
      id: 'c2',
      author: FIXTURE_USERS[0],
      body: 'Aguardando assinatura do síndico.',
      createdAt: '2025-04-04T00:00:00.000Z'
    }],
  }
]