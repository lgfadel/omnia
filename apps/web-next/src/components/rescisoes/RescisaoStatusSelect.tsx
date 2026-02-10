'use client';

import { useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRescisaoStatusStore } from '@/stores/rescisaoStatus.store';

interface RescisaoStatusSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function RescisaoStatusSelect({ value, onChange, disabled, className }: RescisaoStatusSelectProps) {
  const { statuses, loading, loadStatuses } = useRescisaoStatusStore();

  useEffect(() => {
    if (statuses.length === 0) {
      loadStatuses();
    }
  }, [statuses.length, loadStatuses]);

  const selectedStatus = statuses.find(s => s.id === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || loading}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="Selecione um status">
          {selectedStatus && (
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: selectedStatus.color }}
              />
              <span>{selectedStatus.name}</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statuses.map((status) => (
          <SelectItem key={status.id} value={status.id}>
            <div className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: status.color }}
              />
              <span>{status.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
