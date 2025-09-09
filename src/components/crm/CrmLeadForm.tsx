import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { CrmLead } from '@/repositories/crmLeadsRepo.supabase'
import { useCrmLeadsStore } from '@/store/crmLeads.store'
import { Search } from 'lucide-react'
import { useState } from 'react'

const crmLeadSchema = z.object({
  cliente: z.string().min(1, 'Nome do cliente é obrigatório'),
  numero_unidades: z.number().min(1).optional(),
  numero_funcionarios_proprios: z.number().min(0).optional(),
  numero_funcionarios_terceirizados: z.number().min(0).optional(),
  administradora_atual: z.string().optional(),
  observacoes: z.string().optional(),
  status: z.enum(['novo', 'qualificado', 'proposta_enviada', 'em_negociacao', 'on_hold', 'ganho', 'perdido']),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  sindico_nome: z.string().optional(),
  sindico_telefone: z.string().optional(),
  sindico_email: z.string().email('Email inválido').optional().or(z.literal('')),
  sindico_whatsapp: z.string().optional(),
  valor_proposta: z.number().min(0).optional(),
})

type CrmLeadFormData = z.infer<typeof crmLeadSchema>

interface CrmLeadFormProps {
  lead?: CrmLead
  onSuccess?: () => void
  onCancel?: () => void
}

export function CrmLeadForm({ lead, onSuccess, onCancel }: CrmLeadFormProps) {
  const { createLead, updateLead, searchAddress } = useCrmLeadsStore()
  const [searchingCep, setSearchingCep] = useState(false)

  const form = useForm<CrmLeadFormData>({
    resolver: zodResolver(crmLeadSchema),
    defaultValues: {
      cliente: lead?.cliente || '',
      numero_unidades: lead?.numero_unidades || undefined,
      numero_funcionarios_proprios: lead?.numero_funcionarios_proprios || undefined,
      numero_funcionarios_terceirizados: lead?.numero_funcionarios_terceirizados || undefined,
      administradora_atual: lead?.administradora_atual || '',
      observacoes: lead?.observacoes || '',
      status: lead?.status || 'novo',
      cep: lead?.cep || '',
      logradouro: lead?.logradouro || '',
      numero: lead?.numero || '',
      complemento: lead?.complemento || '',
      bairro: lead?.bairro || '',
      cidade: lead?.cidade || '',
      estado: lead?.estado || '',
      sindico_nome: lead?.sindico_nome || '',
      sindico_telefone: lead?.sindico_telefone || '',
      sindico_email: lead?.sindico_email || '',
      sindico_whatsapp: lead?.sindico_whatsapp || '',
      valor_proposta: lead?.valor_proposta || undefined,
    },
  })

  const onSubmit = async (data: CrmLeadFormData) => {
    try {
      if (lead) {
        await updateLead(lead.id, data)
      } else {
        await createLead(data)
      }
      onSuccess?.()
    } catch (error) {
      console.error('Erro ao salvar lead:', error)
    }
  }

  const handleCepSearch = async () => {
    const cep = form.getValues('cep')
    if (!cep) return

    setSearchingCep(true)
    try {
      const address = await searchAddress(cep)
      if (address) {
        form.setValue('logradouro', address.logradouro)
        form.setValue('bairro', address.bairro)
        form.setValue('cidade', address.localidade)
        form.setValue('estado', address.uf)
        form.setValue('complemento', address.complemento)
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error)
    } finally {
      setSearchingCep(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="cliente"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Nome do Condomínio *</FormLabel>
                <FormControl>
                  <Input placeholder="Nome do condomínio" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="qualificado">Qualificado</SelectItem>
                    <SelectItem value="proposta_enviada">Proposta Enviada</SelectItem>
                    <SelectItem value="em_negociacao">Em Negociação</SelectItem>
                    <SelectItem value="on_hold">Em Espera</SelectItem>
                    <SelectItem value="ganho">Ganho</SelectItem>
                    <SelectItem value="perdido">Perdido</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="valor_proposta"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Valor da Proposta (R$)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numero_unidades"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número de Unidades</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numero_funcionarios_proprios"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Funcionários Próprios</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="numero_funcionarios_terceirizados"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Funcionários Terceirizados</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="administradora_atual"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Administradora Atual</FormLabel>
                <FormControl>
                  <Input placeholder="Nome da administradora atual" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Endereço */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Endereço</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="cep"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="00000-000" {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCepSearch}
                      disabled={searchingCep}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="logradouro"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Logradouro</FormLabel>
                  <FormControl>
                    <Input placeholder="Rua, avenida, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="numero"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input placeholder="123" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="complemento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Complemento</FormLabel>
                  <FormControl>
                    <Input placeholder="Apto, sala, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bairro"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bairro</FormLabel>
                  <FormControl>
                    <Input placeholder="Bairro" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cidade"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input placeholder="Cidade" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input placeholder="UF" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Dados do Síndico */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Dados do Síndico</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="sindico_nome"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Nome do Síndico</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sindico_telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sindico_whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input placeholder="(11) 99999-9999" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sindico_email"
              render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Observações adicionais sobre o lead..."
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-3">
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
          )}
          <Button type="submit">
            {lead ? 'Atualizar' : 'Criar'} Lead
          </Button>
        </div>
      </form>
    </Form>
  )
}