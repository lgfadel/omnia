import { cn } from "@/lib/utils";
import { TarefaPrioridade } from "@/repositories/tarefasRepo.supabase";
import { Flag } from "lucide-react";

interface PriorityBadgeProps {
  priority: TarefaPrioridade;
  className?: string;
}

const priorityConfig: Record<TarefaPrioridade, { label: string; flagColor: string }> = {
  URGENTE: {
    label: "Urgente",
    flagColor: "text-red-500"
  },
  ALTA: {
    label: "Alta", 
    flagColor: "text-yellow-500"
  },
  NORMAL: {
    label: "Normal",
    flagColor: "text-blue-500"
  },
  BAIXA: {
    label: "Baixa",
    flagColor: "text-gray-500"
  }
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 text-sm font-medium",
      className
    )}>
      <Flag className={cn("w-4 h-4 fill-current", config.flagColor)} />
      <span className="text-foreground">{config.label}</span>
    </div>
  );
}