import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Condominium } from "@/repositories/condominiumsRepo.supabase"
import { useCondominiumStore } from "@/store/condominiums.store"
import { useToast } from "@/hooks/use-toast"
import { handleSupabaseError, createErrorContext } from "@/lib/errorHandler"
import { logger } from '../../lib/logging';


// Função para validar CNPJ
const validateCNPJ = (cnpj: string): boolean => {
  // Remove caracteres não numéricos
  const cleanCNPJ = cnpj.replace(/[^\d]/g, '')
  
  // Verifica se tem 14 dígitos
  if (cleanCNPJ.length !== 14) return false
  
  // Verifica se todos os dígitos são iguais
  if (/^(\d)\1{13}$/.test(cleanCNPJ)) return false
  
  // Validação dos dígitos verificadores
  let sum = 0
  let pos = 5
  
  // Primeiro dígito verificador
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos--
    if (pos < 2) pos = 9
  }
  
  let result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  if (result !== parseInt(cleanCNPJ.charAt(12))) return false
  
  // Segundo dígito verificador
  sum = 0
  pos = 6
  for (let i = 0; i < 13; i++) {
    sum += parseInt(cleanCNPJ.charAt(i)) * pos--
    if (pos < 2) pos = 9
  }
  
  result = sum % 11 < 2 ? 0 : 11 - (sum % 11)
  return result === parseInt(cleanCNPJ.charAt(13))
}

// Função para formatar CNPJ
const formatCNPJ = (value: string): string => {
  const cleanValue = value.replace(/[^\d]/g, '')
  return cleanValue
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
    .substring(0, 18)
}

const condominiumSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  cnpj: z.string().optional().refine((val) => {
    if (!val || val.trim() === "") return true
    return validateCNPJ(val)
  }, "CNPJ inválido"),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  syndic_name: z.string().optional(),
  manager_name: z.string().optional()
})

type CondominiumFormData = z.infer<typeof condominiumSchema>

interface CondominiumFormProps {
  condominium?: Condominium
  onSubmit: (data: CondominiumFormData) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CondominiumForm({ condominium, onSubmit, onCancel, isLoading }: CondominiumFormProps) {
  const { checkCnpjExists } = useCondominiumStore()
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<CondominiumFormData>({
    // TODO: remover cast quando resolver suportar Zod 3.24
    resolver: zodResolver(condominiumSchema as any),
    defaultValues: {
      name: condominium?.name || "",
      cnpj: condominium?.cnpj || "",
      address: condominium?.address || "",
      phone: condominium?.phone || "",
      whatsapp: condominium?.whatsapp || "",
      syndic_name: condominium?.syndic_name || "",
      manager_name: condominium?.manager_name || ""
    }
  })

  const cnpjValue = watch("cnpj")



  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCNPJ(e.target.value)
    setValue("cnpj", formatted)
  }

  const onFormSubmit = async (data: CondominiumFormData) => {
    // Verificar se CNPJ já existe (apenas se foi preenchido)
    if (data.cnpj && data.cnpj.trim() !== '') {
      try {
        const cnpjExists = await checkCnpjExists(data.cnpj, condominium?.id)
        if (cnpjExists) {
          toast({
            title: "Erro",
            description: "Já existe um condomínio cadastrado com este CNPJ",
            variant: "destructive"
          })
          return
        }
      } catch (error) {
        logger.error('Erro ao verificar CNPJ:', error)
        const treatedError = handleSupabaseError(
          error,
          createErrorContext('read', 'condomínio', 'omnia_condominiums')
        )
        toast({
          title: "Erro",
          description: treatedError.message,
          variant: "destructive"
        })
        return
      }
    }

    await onSubmit(data)
  }

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>
          {condominium ? "Editar Condomínio" : "Novo Condomínio"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="name">Nome do Condomínio *</Label>
              <Input
                id="name"
                {...register("name")}
                placeholder="Ex: Residencial Jardim das Flores"
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpjValue}
                onChange={handleCnpjChange}
                placeholder="00.000.000/0000-00"
                disabled={isLoading}
              />
              {errors.cnpj && (
                <p className="text-sm text-red-500">{errors.cnpj.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                {...register("phone")}
                placeholder="(11) 1234-5678"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input
                id="whatsapp"
                {...register("whatsapp")}
                placeholder="(11) 91234-5678"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Rua, número, bairro, cidade - UF"
              disabled={isLoading}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="syndic_name">Síndico</Label>
              <Input
                id="syndic_name"
                {...register("syndic_name")}
                placeholder="Nome do síndico"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="manager_name">Gerente</Label>
              <Input
                id="manager_name"
                {...register("manager_name")}
                placeholder="Nome do gerente"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Salvando..." : condominium ? "Atualizar" : "Salvar"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}