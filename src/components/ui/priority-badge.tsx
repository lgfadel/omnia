import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TicketPriority } from "@/repositories/ticketsRepo.supabase";

interface PriorityBadgeProps {
  priority: TicketPriority;
  className?: string;
}

const priorityConfig: Record<TicketPriority, { label: string; color: string }> = {
  ALTA: {
    label: "Alta",
    color: "hsl(var(--destructive))"
  },
  NORMAL: {
    label: "Normal", 
    color: "hsl(var(--primary))"
  },
  BAIXA: {
    label: "Baixa",
    color: "hsl(var(--muted-foreground))"
  }
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = priorityConfig[priority];
  
  return (
    <Badge 
      className={cn("text-white font-medium", className)}
      style={{ backgroundColor: config.color }}
    >
      {config.label}
    </Badge>
  );
}