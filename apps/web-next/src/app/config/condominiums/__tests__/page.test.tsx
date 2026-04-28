import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ConfigCondominiums from "../page"

const mockLoadCondominiums = vi.fn()
const mockCreateCondominium = vi.fn()
const mockUpdateCondominium = vi.fn()
const mockDeleteCondominium = vi.fn()
const mockClearError = vi.fn()
const mockToast = vi.fn()
const mockTabelaOmnia = vi.fn(({ columns, data }: any) => (
  <div>
    <div data-testid="columns">{columns.map((column: any) => column.label).join("|")}</div>
    <div data-testid="analista-cell">{data[0]?.analista_financeiro}</div>
  </div>
))

vi.mock("@/components/layout/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}))

vi.mock("@/components/ui/breadcrumb-omnia", () => ({
  BreadcrumbOmnia: () => <div>Breadcrumb</div>,
}))

vi.mock("@/components/ui/tabela-omnia", () => ({
  TabelaOmnia: (props: any) => mockTabelaOmnia(props),
}))

vi.mock("@/components/condominiums/CondominiumForm", () => ({
  CondominiumForm: () => null,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogCancel: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}))

vi.mock("@/lib/logging", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/stores/condominiums.store", () => ({
  useCondominiumStore: () => ({
    condominiums: [
      {
        id: "cond-1",
        name: "Residencial Biarritz",
        cnpj: "27770737000140",
        syndic_name: null,
        analista_financeiro: "Vania",
        phone: "4333389400",
        active: true,
        created_at: null,
        updated_at: null,
      },
    ],
    loading: false,
    error: null,
    loadCondominiums: mockLoadCondominiums,
    createCondominium: mockCreateCondominium,
    updateCondominium: mockUpdateCondominium,
    deleteCondominium: mockDeleteCondominium,
    clearError: mockClearError,
  }),
}))

describe("ConfigCondominiums", () => {
  it("remove a coluna telefone da tabela e exibe analista financeiro", async () => {
    render(<ConfigCondominiums />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    expect(screen.getByTestId("columns")).toHaveTextContent("Analista Financeiro")
    expect(screen.getByTestId("columns")).not.toHaveTextContent("Telefone")
    expect(screen.getByTestId("analista-cell")).toHaveTextContent("Vania")
  })

  it("permite editar analista financeiro inline", async () => {
    render(<ConfigCondominiums />)

    await waitFor(() => expect(mockTabelaOmnia).toHaveBeenCalled())

    fireEvent.click(screen.getByText("Vania"))

    const input = await screen.findByPlaceholderText("Nome do analista financeiro")
    fireEvent.change(input, { target: { value: "Paula" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(mockUpdateCondominium).toHaveBeenCalledWith("cond-1", {
        analista_financeiro: "Paula",
      })
    })
  })
})
