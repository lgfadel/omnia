import { Condominium } from "@/repositories/condominiumsRepo.supabase"

export function formatAddress(condominium: Condominium): string {
  const parts: string[] = []

  if (condominium.street) {
    let streetPart = condominium.street
    if (condominium.number) {
      streetPart += `, ${condominium.number}`
    }
    if (condominium.complement) {
      streetPart += ` - ${condominium.complement}`
    }
    parts.push(streetPart)
  }

  if (condominium.neighborhood) {
    parts.push(condominium.neighborhood)
  }

  if (condominium.city && condominium.state) {
    parts.push(`${condominium.city}/${condominium.state}`)
  } else if (condominium.city) {
    parts.push(condominium.city)
  }

  if (condominium.zip_code) {
    const formattedCEP = condominium.zip_code.replace(/^(\d{5})(\d{3})$/, '$1-$2')
    parts.push(`CEP ${formattedCEP}`)
  }

  return parts.length > 0 ? parts.join(' - ') : ''
}
