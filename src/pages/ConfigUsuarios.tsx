import { Layout } from "@/components/layout/Layout"
import { BreadcrumbEureka } from "@/components/ui/breadcrumb-eureka"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const ConfigUsuarios = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbEureka 
          items={[
            { label: "Configurações", href: "/config" },
            { label: "Usuários", isActive: true }
          ]} 
        />
        
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Configuração de Usuários</h1>
          <p className="text-muted-foreground">Gerencie usuários e permissões do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários do Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Funcionalidade de gerenciamento de usuários será implementada na Fase 2.
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default ConfigUsuarios;