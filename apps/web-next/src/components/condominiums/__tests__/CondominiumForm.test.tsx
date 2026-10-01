import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest"
import { supabase } from "@/integrations/supabase/client"
import { CondominiumForm } from "../CondominiumForm"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock)
Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
  configurable: true,
  value: vi.fn(() => false),
})
Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
  configurable: true,
  value: vi.fn(),
})
Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
  configurable: true,
  value: vi.fn(),
})
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
})

describe("CondominiumForm", () => {
  const condominiumFixture = {
    id: "cond-1",
    name: "Condominio Teste",
    cnpj: "12345678000199",
    syndic_name: "Carlos",
    analista_financeiro: "Marina Souza",
    phone: "43999999999",
    active: true,
    balancete_digital: true,
    boleto_impresso: false,
    street: "Rua A",
    number: "123",
    complement: null,
    neighborhood: "Centro",
    zip_code: "86000000",
    city: "Londrina",
    state: "PR",
    created_at: null,
    updated_at: null,
  }

  it("exibe e envia o campo de analista financeiro", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <CondominiumForm
        condominium={condominiumFixture}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    const input = screen.getByLabelText("Analista Financeiro")
    expect(input).toHaveValue("Marina Souza")

    fireEvent.change(input, { target: { value: "Paula Lima" } })
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          analista_financeiro: "Paula Lima",
        })
      )
    })
  })

  it("envia detalhes de boletos da seção Opções", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <CondominiumForm
        condominium={{
          ...condominiumFixture,
          boleto_impresso: true,
          boleto_delivery_type: "fisico_total",
          boleto_due_day: 10,
          boleto_observations: "Entregar boletos na portaria",
          garantidora: false,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText("Boletos")).toBeInTheDocument()
    expect(screen.getByText("Balancetes")).toBeInTheDocument()
    const boletoSelect = screen.getByRole("combobox", { name: "Boleto Impresso" })
    expect(boletoSelect).toHaveTextContent("Físico total")
    expect(screen.getByRole("switch", { name: "Garantidora" })).toBeInTheDocument()
    expect(screen.getByLabelText("Balancete Digital")).toBeInTheDocument()

    fireEvent.keyDown(boletoSelect, { key: "ArrowDown" })
    fireEvent.click(await screen.findByRole("option", { name: "Físico parcial" }))
    fireEvent.click(screen.getByRole("switch", { name: "Garantidora" }))

    const dueDayInput = screen.getByLabelText("Dia de vencimento")
    expect(dueDayInput).toHaveValue(10)
    fireEvent.change(dueDayInput, { target: { value: "15" } })

    const observationsInput = screen.getByLabelText("Observações")
    expect(observationsInput).toHaveValue("Entregar boletos na portaria")
    fireEvent.change(observationsInput, {
      target: { value: "Enviar segunda via por e-mail quando solicitado" },
    })

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          boleto_impresso: true,
          boleto_delivery_type: "fisico_parcial",
          boleto_due_day: 15,
          boleto_observations: "Enviar segunda via por e-mail quando solicitado",
          garantidora: true,
        })
      )
    })
  })

  it("usa Não como padrão do dropdown de boleto", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <CondominiumForm
        condominium={{
          ...condominiumFixture,
          boleto_impresso: true,
        }}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole("combobox", { name: "Boleto Impresso" })).toHaveTextContent("Não")

    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          boleto_impresso: false,
          boleto_delivery_type: "nao",
        })
      )
    })
  })

  describe("consulta de CNPJ", () => {
    let fetchSpy: MockInstance<typeof fetch>

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, "fetch")
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: {
          session: {
            access_token: "test-cnpj-token",
            refresh_token: "test-refresh-token",
            token_type: "bearer",
            expires_in: 3600,
            user: {
              id: "11111111-1111-4111-8111-111111111111",
              aud: "authenticated",
              app_metadata: {},
              user_metadata: {},
              created_at: "2026-10-01T12:00:00Z",
            },
          },
        },
        error: null,
      })
    })

    afterEach(() => {
      fetchSpy.mockRestore()
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      })
    })

    it("preenche os dados normalizados ao sair do campo CNPJ", async () => {
      fetchSpy.mockImplementation(async (url, init) => {
        if (
          url !== "/api/cnpj/68009455000101" ||
          new Headers(init?.headers).get("Authorization") !== "Bearer test-cnpj-token"
        ) {
          throw new TypeError("A consulta deve usar o servidor autenticado do Omnia")
        }

        return Response.json({
          name: "CONDOMINIO EXEMPLO",
          fantasyName: "RESIDENCIAL EXEMPLO",
          street: "RUA DAS FLORES",
          number: "456",
          complement: "BLOCO B",
          neighborhood: "JARDIM TESTE",
          city: "LONDRINA",
          state: "PR",
          zipCode: "86010200",
          phone: "4333334444",
          active: false,
        })
      })

      render(<CondominiumForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

      const cnpjInput = screen.getByLabelText("CNPJ *")
      fireEvent.change(cnpjInput, { target: { value: "68.009.455/0001-01" } })
      fireEvent.blur(cnpjInput)

      await waitFor(() => {
        expect(screen.getByLabelText("Nome do Condomínio *")).toHaveValue("CONDOMINIO EXEMPLO")
        expect(screen.getByLabelText("Telefone")).toHaveValue("(43) 3333-4444")
        expect(screen.getByLabelText("CEP *")).toHaveValue("86010-200")
        expect(screen.getByLabelText("Rua *")).toHaveValue("RUA DAS FLORES")
        expect(screen.getByLabelText("Número *")).toHaveValue("456")
        expect(screen.getByLabelText("Complemento")).toHaveValue("BLOCO B")
        expect(screen.getByLabelText("Bairro *")).toHaveValue("JARDIM TESTE")
        expect(screen.getByLabelText("Cidade *")).toHaveValue("LONDRINA")
        expect(screen.getByLabelText("Estado *")).toHaveValue("PR")
        expect(screen.getByRole("switch", { name: "Condomínio ativo" })).not.toBeChecked()
      })
      expect(cnpjInput).toBeEnabled()
    })

    it("permite editar e salvar os dados existentes após uma falha na consulta", async () => {
      fetchSpy.mockImplementation(async (url, init) => {
        if (
          url !== "/api/cnpj/68009455000101" ||
          new Headers(init?.headers).get("Authorization") !== "Bearer test-cnpj-token"
        ) {
          throw new TypeError("A consulta deve usar o servidor autenticado do Omnia")
        }

        return Response.json(
          { error: "Consulta de CNPJ indisponível no momento", code: "API_ERROR" },
          { status: 503 }
        )
      })
      const onSubmit = vi.fn().mockResolvedValue(undefined)

      render(
        <CondominiumForm
          condominium={condominiumFixture}
          onSubmit={onSubmit}
          onCancel={vi.fn()}
        />
      )

      const cnpjInput = screen.getByLabelText("CNPJ *")
      fireEvent.change(cnpjInput, { target: { value: "68.009.455/0001-01" } })
      fireEvent.blur(cnpjInput)

      expect(await screen.findByText("Consulta de CNPJ indisponível no momento")).toBeInTheDocument()
      expect(cnpjInput).toBeEnabled()
      const nameInput = screen.getByLabelText("Nome do Condomínio *")
      expect(nameInput).toHaveValue("Condominio Teste")
      expect(screen.getByLabelText("Rua *")).toHaveValue("Rua A")
      expect(screen.getByLabelText("CEP *")).toHaveValue("86000-000")

      fireEvent.change(nameInput, { target: { value: "Condomínio preenchido manualmente" } })
      fireEvent.click(screen.getByRole("button", { name: "Atualizar" }))

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "Condomínio preenchido manualmente",
            cnpj: "68009455000101",
            phone: "43999999999",
            street: "Rua A",
            number: "123",
            neighborhood: "Centro",
            zip_code: "86000000",
            city: "Londrina",
            state: "PR",
            active: true,
          })
        )
      })
    })
  })
})
