import * as XLSX from 'xlsx'
import type { Condominium } from '@/repositories/condominiumsRepo.supabase'

function formatCnpj(cnpj: string | null | undefined): string {
  if (!cnpj) return ''
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return cnpj
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function generateCondominiosXLSX(condominiums: Condominium[]): void {
  const sorted = [...condominiums].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

  const rows = sorted.map((c) => ({
    Nome: c.name,
    CNPJ: formatCnpj(c.cnpj),
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Column widths
  worksheet['!cols'] = [{ wch: 50 }, { wch: 22 }]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Condomínios')

  XLSX.writeFile(workbook, 'condominios.xlsx')
}
