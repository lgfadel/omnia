'use client';

import { Badge } from '@/components/ui/badge';
import { useAdmissaoStatusStore } from '@/store/admissaoStatus.store';

interface AdmissaoStatusBadgeProps {
  statusId: string;
  className?: string;
}

export function AdmissaoStatusBadge({ statusId, className }: AdmissaoStatusBadgeProps) {
  const { statuses } = useAdmissaoStatusStore();
  const status = statuses.find(s => s.id === statusId);

  if (!status) {
    return <Badge variant="outline" className={className}>Carregando...</Badge>;
  }

  return (
    <Badge 
      className={className}
      style={{ 
        backgroundColor: status.color,
        color: 'white',
      }}
    >
      {status.name}
    </Badge>
  );
}
