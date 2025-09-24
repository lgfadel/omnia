import React from 'react';
import { useTarefasOportunidade } from '@/hooks/useTarefasOportunidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, User, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface TarefasOportunidadeProps {
  oportunidadeId: string;
}

export function TarefasOportunidade({ oportunidadeId }: TarefasOportunidadeProps) {
  const { tarefas, loading, error } = useTarefasOportunidade(oportunidadeId);

  if (loading) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Tarefas Relacionadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center space-x-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Tarefas Relacionadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-red-600">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENTE':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ALTA':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'NORMAL':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'BAIXA':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'URGENTE':
        return '🔴';
      case 'ALTA':
        return '🟠';
      case 'NORMAL':
        return '🔵';
      case 'BAIXA':
        return '⚪';
      default:
        return '⚪';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date);
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          Tarefas Relacionadas ({tarefas.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {tarefas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma tarefa relacionada a esta oportunidade.
          </p>
        ) : (
          <div className="space-y-4">
            {tarefas.map((tarefa) => (
              <div
                key={tarefa.id}
                className="flex items-start space-x-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{tarefa.title}</h4>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getPriorityColor(tarefa.priority)}
                      >
                        {getPriorityIcon(tarefa.priority)} {tarefa.priority}
                      </Badge>
                      <Badge
                        variant="outline"
                        style={{ 
                          backgroundColor: `${tarefa.statusColor}20`,
                          borderColor: tarefa.statusColor,
                          color: tarefa.statusColor
                        }}
                      >
                        {tarefa.statusLabel}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    {tarefa.dueDate && (
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        <span>Vence em {formatDate(tarefa.dueDate)}</span>
                      </div>
                    )}
                    
                    {tarefa.assignedTo && (
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3" />
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={tarefa.assignedTo.avatarUrl} />
                          <AvatarFallback 
                            className="text-xs"
                            style={{ backgroundColor: tarefa.assignedTo.color }}
                          >
                            {tarefa.assignedTo.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{tarefa.assignedTo.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}