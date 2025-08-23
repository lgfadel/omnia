import { cn } from "@/lib/utils";
import { TarefaPrioridade } from "@/repositories/tarefasRepo.supabase";
import { Flag } from "lucide-react";

interface PriorityBadgeProps {
  priority: TarefaPrioridade;
  className?: string;
}

const priorityConfig: Record<TarefaPrioridade, { label: string; bgColor: string; flagColor: string }> = {
  ALTA: {
    label: "Alta", 
    bgColor: "bg-yellow-50 border-yellow-200",
    flagColor: "text-yellow-500"
  },
  NORMAL: {
    label: "Normal",
    bgColor: "bg-blue-50 border-blue-200", 
    flagColor: "text-blue-500"
  },
  BAIXA: {
    label: "Baixa",
    bgColor: "bg-gray-50 border-gray-200",
    flagColor: "text-gray-500"
  }
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium",
      config.bgColor,
      className
    )}>
      <Flag className={cn("w-4 h-4", config.flagColor)} />
      <span className={config.flagColor}>{config.label}</span>
    </div>
  );
}