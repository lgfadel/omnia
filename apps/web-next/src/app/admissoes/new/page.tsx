'use client';

import { AdmissaoForm } from '@/components/admissoes/AdmissaoForm';

export default function NovaAdmissaoPage() {
  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <AdmissaoForm mode="create" />
    </div>
  );
}
