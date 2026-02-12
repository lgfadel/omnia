'use client';

import { RescisaoForm } from '@/components/rescisoes/RescisaoForm';

export default function NovaRescisaoPage() {
  return (
    <div className="container mx-auto py-6 max-w-3xl">
      <RescisaoForm mode="create" />
    </div>
  );
}
