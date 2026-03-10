import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Condominium } from "@/repositories/condominiumsRepo.supabase"
import { cepService, CEPServiceError } from "@/services/cep.service"
import { Loader2 } from "lucide-react"

const condominiumSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  zip_code: z.string().min(8, "CEP deve ter 8 dígitos").max(8, "CEP deve ter 8 dígitos").regex(/^\d{8}$/, "CEP deve conter apenas números"),
  street: z.string().min(1, "Rua é obrigatória"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().min(1, "Bairro é obrigatório"),
  city: z.string().min(1, "Cidade é obrigatória"),
  state: z.string().length(2, "Estado deve ter 2 caracteres").regex(/^[A-Z]{2}$/, "Estado deve estar em maiúsculas"),
})

type CondominiumFormData = z.infer<typeof condominiumSchema>

interface CondominiumFormProps {
  condominium?: Condominium
  onSubmit: (data: { 
    name: string
    street: string
    number: string
    complement?: string | null
    neighborhood: string
    zip_code: string
    city: string
    state: string
  }) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
}

export function CondominiumForm({ condominium, onSubmit, onCancel, isLoading }: CondominiumFormProps) {
  const [searchingCEP, setSearchingCEP] = useState(false)
  const [cepError, setCepError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors }
  } = useForm<CondominiumFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(condominiumSchema as any),
    defaultValues: {
      name: condominium?.name || "",
      zip_code: condominium?.zip_code || "",
      street: condominium?.street || "",
      number: condominium?.number || "",
      complement: condominium?.complement || "",
      neighborhood: condominium?.neighborhood || "",
      city: condominium?.city || "",
      state: condominium?.state || "",
    }
  })

  const zipCode = watch("zip_code")

  const handleCEPBlur = async () => {
    const cleanCEP = cepService.cleanCEP(zipCode)
    
    if (!cleanCEP || cleanCEP.length !== 8) {
      return
    }

    if (!cepService.validateFormat(cleanCEP)) {
      setCepError("CEP deve ter 8 dígitos")
      return
    }

    setSearchingCEP(true)
    setCepError(null)

    try {
      const addressData = await cepService.fetchAddressByCEP(cleanCEP)
      setValue("street", addressData.street)
      setValue("neighborhood", addressData.neighborhood)
      setValue("city", addressData.city)
      setValue("state", addressData.state)
    } catch (error) {
      if (error instanceof CEPServiceError) {
        setCepError(error.message)
      } else {
        setCepError("Erro ao buscar CEP")
      }
    } finally {
      setSearchingCEP(false)
    }
  }

  const onFormSubmit = async (data: CondominiumFormData) => {
    await onSubmit({
      name: data.name,
      street: data.street,
      number: data.number,
      complement: data.complement || null,
      neighborhood: data.neighborhood,
      zip_code: data.zip_code,
      city: data.city,
      state: data.state,
    })
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {condominium ? "Editar Condomínio" : "Novo Condomínio"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do Condomínio *</Label>
            <Input
              id="nome"
              {...register("name")}
              placeholder="Ex: Residencial Jardim das Flores"
              disabled={isLoading}
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP *</Label>
            <div className="relative">
              <Input
                id="zip_code"
                {...register("zip_code")}
                placeholder="12345678"
                disabled={isLoading || searchingCEP}
                maxLength={8}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  setValue("zip_code", value)
                  setCepError(null)
                }}
                onBlur={handleCEPBlur}
              />
              {searchingCEP && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                </div>
              )}
            </div>
            {errors.zip_code && (
              <p className="text-sm text-red-500">{errors.zip_code.message}</p>
            )}
            {cepError && (
              <p className="text-sm text-red-500">{cepError}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="street">Rua *</Label>
            <Input
              id="street"
              {...register("street")}
              placeholder="Nome da rua"
              disabled={isLoading}
            />
            {errors.street && (
              <p className="text-sm text-red-500">{errors.street.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="number">Número *</Label>
              <Input
                id="number"
                {...register("number")}
                placeholder="123"
                disabled={isLoading}
              />
              {errors.number && (
                <p className="text-sm text-red-500">{errors.number.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input
                id="complement"
                {...register("complement")}
                placeholder="Apto, Bloco, etc"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro *</Label>
            <Input
              id="neighborhood"
              {...register("neighborhood")}
              placeholder="Nome do bairro"
              disabled={isLoading}
            />
            {errors.neighborhood && (
              <p className="text-sm text-red-500">{errors.neighborhood.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade *</Label>
              <Input
                id="city"
                {...register("city")}
                placeholder="Nome da cidade"
                disabled={isLoading}
              />
              {errors.city && (
                <p className="text-sm text-red-500">{errors.city.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="state">Estado *</Label>
              <Input
                id="state"
                {...register("state")}
                placeholder="SP"
                disabled={isLoading}
                maxLength={2}
                onChange={(e) => {
                  const value = e.target.value.toUpperCase()
                  setValue("state", value)
                }}
              />
              {errors.state && (
                <p className="text-sm text-red-500">{errors.state.message}</p>
              )}
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
