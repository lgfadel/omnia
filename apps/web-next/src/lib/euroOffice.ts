export const EURO_OFFICES = ['Londrina', 'Campinas'] as const

export type EuroOffice = (typeof EURO_OFFICES)[number]
export type EuroOfficeFilter = EuroOffice | 'todos'
