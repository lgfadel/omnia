import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CondominiumForm } from "../CondominiumForm"

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal("ResizeObserver", ResizeObserverMock)

describe("CondominiumForm", () => {
  it("exibe e envia o campo de analista financeiro", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)

    render(
      <CondominiumForm
        condominium={{
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
        }}
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
})
