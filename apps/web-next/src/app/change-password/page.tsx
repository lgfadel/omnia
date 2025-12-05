"use client";

import { Layout } from "@/components/layout/Layout"
import { BreadcrumbOmnia } from "@/components/ui/breadcrumb-omnia"
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm"
import { useRouter } from "next/navigation"

const ChangePassword = () => {
  const router = useRouter()

  const handleSuccess = () => {
    router.push('/')
  }

  const handleCancel = () => {
    router.push('/')
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
