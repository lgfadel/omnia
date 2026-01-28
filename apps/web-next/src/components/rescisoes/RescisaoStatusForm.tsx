'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RescisaoStatus } from '@/repositories/rescisaoStatusRepo.supabase';

const DEFAULT_COLORS = [
  '#3b82f6', '#f59e0b', '#8b5cf6', '#6b7280', '#06b6d4',
  '#ec4899', '#f97316', '#10b981', '#ef4444', '#84cc16',
];

interface RescisaoStatusFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status?: RescisaoStatus | null;
  onSubmit: (data: Omit<RescisaoStatus, 'id' | 'createdAt' | 'updatedAt'>) => void;
  isLoading?: boolean;
}

export function RescisaoStatusForm({ 
  open, 
  onOpenChange, 
  status, 
  onSubmit, 
  isLoading 
}: RescisaoStatusFormProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLORS[0]);
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (status) {
      setName(status.name);
      setColor(status.color);
      setIsDefault(status.isDefault || false);
    } else {
      setName('');
      setColor(DEFAULT_COLORS[0]);
      setIsDefault(false);
    }
  }, [status, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      name,
      color,
      order: status?.order || 0,
      isDefault,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {status ? 'Editar Status' : 'Novo Status'}
          </DialogTitle>
          <DialogDescription>
            {status 
              ? 'Edite as informações do status de demissão.'
              : 'Preencha os dados para criar um novo status de demissão.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Aguardando Assinatura"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {DEFAULT_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="customColor" className="text-sm">Cor personalizada:</Label>
                <Input
                  id="customColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-0 border-0"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="isDefault"
                checked={isDefault}
                onCheckedChange={setIsDefault}
              />
              <Label htmlFor="isDefault">Status padrão para novas rescisões</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Salvando...' : status ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
