import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTarefasOportunidade } from '@/hooks/useTarefasOportunidade';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CalendarDays, AlertCircle, Flag } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { generateUserColor, getUserInitials } from '@/lib/userColors';

interface TarefasOportunidadeProps {
  oportunidadeId: string;
}

export function TarefasOportunidade({ oportunidadeId }: TarefasOportunidadeProps) {
  const navigate = useNavigate();
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
        return 'bg-transparent text-black border-0';
      case 'BAIXA':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPriorityFlagColor = (priority: string) => {
    switch (priority) {
      case 'URGENTE':
        return 'text-red-500';
      case 'ALTA':
        return 'text-yellow-500';
      case 'NORMAL':
        return 'text-blue-500';
      case 'BAIXA':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
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
                    <button
                      onClick={() => navigate(`/tarefas/${tarefa.id}`)}
                      className="font-medium text-sm text-left hover:text-blue-600 hover:underline cursor-pointer transition-colors duration-200"
                      aria-label={`Ver detalhes da tarefa: ${tarefa.title}`}
                      title={`Clique para ver os detalhes da tarefa: ${tarefa.title}`}
                    >
                      {tarefa.title}
                    </button>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={getPriorityColor(tarefa.priority)}
                      >
                        <Flag className={`h-3 w-3 mr-1 fill-current ${getPriorityFlagColor(tarefa.priority)}`} />
                        {tarefa.priority}
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
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={tarefa.assignedTo.avatarUrl} />
                          <AvatarFallback 
                            className="text-xs text-white font-medium"
                            style={{ 
                              backgroundColor: tarefa.assignedTo.color && typeof tarefa.assignedTo.color === 'string' && tarefa.assignedTo.color.trim() !== ''
                                ? tarefa.assignedTo.color
                                : generateUserColor(tarefa.assignedTo.id, tarefa.assignedTo.name) 
                            }}
                          >
                            {getUserInitials(tarefa.assignedTo.name)}
                          </AvatarFallback>
                        </Avatar>
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