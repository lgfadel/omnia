import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm"
import { useNavigate } from "react-router-dom"

const ChangePassword = () => {
  const navigate = useNavigate()

  const handleSuccess = () => {
    navigate('/')
  }

  const handleCancel = () => {
    navigate('/')
  }

  return (
    <Layout>
      <div className="space-y-6">
        <BreadcrumbOmnia 
          items={[
            { label: "Início", href: "/" },
            { label: "Alterar Senha", isActive: true }
          ]} 
        />
        
        <div className="flex items-center justify-center min-h-[500px]">
          <ChangePasswordForm
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      </div>
    </Layout>
  )
}

export default ChangePassword