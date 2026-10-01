export interface CNPJData {
  name: string
  fantasyName: string
  street: string
  number: string
  complement: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  phone: string
  active: boolean
}

export type CNPJErrorCode = 'INVALID_FORMAT' | 'NOT_FOUND' | 'API_ERROR' | 'INACTIVE' | 'UNAUTHORIZED'

export class CNPJServiceError extends Error {
  constructor(message: string, public code: CNPJErrorCode) {
    super(message)
    this.name = 'CNPJServiceError'
  }
}
