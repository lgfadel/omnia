import type { ReactNode } from 'react'

const testAccessToken = 'dummy.browser.token'
export const supabase = { auth: { getSession: async () => ({ data: { session: { access_token: testAccessToken } }, error: null }) } }
export const Layout = ({ children }: { children: ReactNode }) => <main>{children}</main>
export const ProtectedRoute = ({ children }: { children: ReactNode }) => <>{children}</>
export const BreadcrumbOmnia = () => <nav aria-label="Caminho">Início / Integrações</nav>
export const useToast = () => ({ toast: () => undefined })
