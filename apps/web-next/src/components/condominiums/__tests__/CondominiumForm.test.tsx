import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
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

    fireEvent.change(screen.getByLabelText("Nome do Condomínio *"), {
      target: { value: "Condominio Teste" },
    })
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

  it("move opções para a aba Opções e envia detalhes de boletos", async () => {
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

    fireEvent.click(screen.getByRole("tab", { name: "Opções" }))

    expect(screen.getByRole("heading", { name: "Boletos" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Balancetes" })).toBeInTheDocument()
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

    fireEvent.click(screen.getByRole("tab", { name: "Opções" }))

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
})
