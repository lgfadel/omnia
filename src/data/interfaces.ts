// Consolidated interfaces for the application
// This file consolidates all common interfaces to reduce duplication

export interface BaseEntity {
  id: string
  createdAt: string
  updatedAt: string
}

export interface UserBasic {
  id: string
  name: string
  email: string
  avatarUrl?: string
  color?: string
}

export interface StatusEntity {
  id: string
  name: string
  color: string
  order?: number
  orderPosition?: number
  isDefault?: boolean
}

export interface AttachmentEntity {
  id: string
  name: string
  url: string
  sizeKB?: number
  mime?: string
  createdAt: string
}

export interface CommentEntity {
  id: string
  body: string
  createdAt: string
  authorId: string
  author?: UserBasic
  attachments?: AttachmentEntity[]
}

// Form interfaces
export interface BaseFormData {
  title: string
  description?: string
}

export interface BaseFormProps<T = any> {
  open: boolean
  onOpenChange: (open: boolean) => void
  data?: T
  onSubmit: (data: T) => Promise<void>
}

// API Response interfaces
export interface ApiResponse<T = any> {
  data?: T
  error?: any
  loading?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}