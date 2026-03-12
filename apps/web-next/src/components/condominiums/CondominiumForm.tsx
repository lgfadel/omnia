import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Condominium } from "@/repositories/condominiumsRepo.supabase"
import { cepService, CEPServiceError } from "@/services/cep.service"
import { cnpjService, CNPJServiceError } from "@/services/cnpj.service"
import { Loader2 } from "lucide-react"

const condominiumSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(100, "Nome deve ter no máximo 100 caracteres"),
  cnpj: z.string().min(14, "CNPJ deve ter 14 dígitos").max(14, "CNPJ deve ter 14 dígitos").regex(/^\d{14}$/, "CNPJ deve conter apenas números"),
  syndic_name: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  active: z.boolean().default(true),
  balancete_digital: z.boolean().default(false),
  boleto_impresso: z.boolean().default(false),
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
    cnpj: string
    syndic_name?: string | null
    phone?: string | null
    active: boolean
    balancete_digital: boolean
    boleto_impresso: boolean
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
  const [searchingCNPJ, setSearchingCNPJ] = useState(false)
  const [cnpjError, setCnpjError] = useState<string | null>(null)

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
      cnpj: condominium?.cnpj || "",
      syndic_name: condominium?.syndic_name || "",
      phone: condominium?.phone || "",
      active: condominium?.active ?? true,
      balancete_digital: condominium?.balancete_digital ?? false,
      boleto_impresso: condominium?.boleto_impresso ?? false,
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
  const cnpj = watch("cnpj")

  const handleCNPJBlur = async () => {
    const cleanCNPJ = cnpjService.cleanCNPJ(cnpj)
    
    if (!cleanCNPJ || cleanCNPJ.length !== 14) {
      return
    }

    if (!cnpjService.validateFormat(cleanCNPJ)) {
      setCnpjError("CNPJ deve ter 14 dígitos")
      return
    }

    setSearchingCNPJ(true)
    setCnpjError(null)

    try {
      const companyData = await cnpjService.fetchDataByCNPJ(cleanCNPJ)
      setValue("name", companyData.name)
      setValue("phone", companyData.phone)
      setValue("zip_code", companyData.zipCode)
      setValue("street", companyData.street)
      setValue("number", companyData.number)
      setValue("complement", companyData.complement || "")
      setValue("neighborhood", companyData.neighborhood)
      setValue("city", companyData.city)
      setValue("state", companyData.state)
      setValue("active", companyData.active)
    } catch (error) {
      if (error instanceof CNPJServiceError) {
        setCnpjError(error.message)
      } else {
        setCnpjError("Erro ao buscar CNPJ")
      }
    } finally {
      setSearchingCNPJ(false)
    }
  }

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
      cnpj: cnpjService.cleanCNPJ(data.cnpj),
      syndic_name: data.syndic_name || null,
      phone: data.phone || null,
      active: data.active,
      balancete_digital: data.balancete_digital,
      boleto_impresso: data.boleto_impresso,
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
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="address">Endereço</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 mt-4 min-h-[500px]">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ *</Label>
                <div className="relative">
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    disabled={isLoading || searchingCNPJ}
                    maxLength={18}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 14) {
                        setValue("cnpj", value)
                        setCnpjError(null)
                      }
                    }}
                    onBlur={handleCNPJBlur}
                    value={(() => {
                      const value = watch("cnpj") || ''
                      if (!value) return ''
                      let formatted = value
                      if (value.length > 2) {
                        formatted = value.slice(0, 2) + '.' + value.slice(2)
                      }
                      if (value.length > 5) {
                        formatted = formatted.slice(0, 6) + '.' + formatted.slice(6)
                      }
                      if (value.length > 8) {
                        formatted = formatted.slice(0, 10) + '/' + formatted.slice(10)
                      }
                      if (value.length > 12) {
                        formatted = formatted.slice(0, 15) + '-' + formatted.slice(15)
                      }
                      return formatted
                    })()}
                  />
                  {searchingCNPJ && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    </div>
                  )}
                </div>
                {errors.cnpj && (
                  <p className="text-sm text-red-500">{errors.cnpj.message}</p>
                )}
                {cnpjError && (
                  <p className="text-sm text-red-500">{cnpjError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Os dados serão preenchidos automaticamente ao sair do campo
                </p>
              </div>

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

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    placeholder="(00) 00000-0000"
                    disabled={isLoading}
                    maxLength={15}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '')
                      if (value.length <= 11) {
                        setValue("phone", value)
                      }
                    }}
                    value={(() => {
                      const value = watch("phone") || ''
                      if (!value) return ''
                      
                      // 8 dígitos: (43) 3333-3333
                      if (value.length === 10) {
                        return '(' + value.slice(0, 2) + ') ' + value.slice(2, 6) + '-' + value.slice(6)
                      }
                      // 9 dígitos: (43) 99999-9999
                      if (value.length === 11) {
                        return '(' + value.slice(0, 2) + ') ' + value.slice(2, 7) + '-' + value.slice(7)
                      }
                      
                      // Parcial
                      if (value.length > 2) {
                        return '(' + value.slice(0, 2) + ') ' + value.slice(2)
                      }
                      
                      return value
                    })()}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="syndic_name">Nome do Síndico</Label>
                  <Input
                    id="syndic_name"
                    {...register("syndic_name")}
                    placeholder="Nome do síndico"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="active">Status do Condomínio</Label>
                <Switch
                  id="active"
                  checked={watch("active")}
                  onCheckedChange={(checked) => setValue("active", checked)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="balancete_digital">Balancete Digital</Label>
                <Switch
                  id="balancete_digital"
                  checked={watch("balancete_digital")}
                  onCheckedChange={(checked) => setValue("balancete_digital", checked)}
                  disabled={isLoading}
                />
              </div>

              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="boleto_impresso">Boleto Impresso</Label>
                <Switch
                  id="boleto_impresso"
                  checked={watch("boleto_impresso")}
                  onCheckedChange={(checked) => setValue("boleto_impresso", checked)}
                  disabled={isLoading}
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4 min-h-[500px]">

          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP *</Label>
            <div className="relative">
              <Input
                id="zip_code"
                placeholder="00000-000"
                disabled={isLoading || searchingCEP}
                maxLength={9}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 8) {
                    setValue("zip_code", value)
                    setCepError(null)
                  }
                }}
                onBlur={handleCEPBlur}
                value={(() => {
                  const value = watch("zip_code") || ''
                  if (!value) return ''
                  if (value.length > 5) {
                    return value.slice(0, 5) + '-' + value.slice(5)
                  }
                  return value
                })()}
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

            </TabsContent>
          </Tabs>

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
