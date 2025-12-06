import { ChevronRight, Home } from "lucide-react"
import { Link } from "react-router-dom"
import { cn } from "@/lib/utils"

export interface BreadcrumbItem {
  label: string
  href?: string
  isActive?: boolean
}

interface BreadcrumbOmniaProps {
  items: BreadcrumbItem[]
  className?: string
}

export function BreadcrumbOmnia({ items, className }: BreadcrumbOmniaProps) {
  return (
    <nav className={cn("breadcrumb-responsive flex items-center space-x-2 text-sm text-muted-foreground py-2", className)}>
      <Link 
        to="/" 
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
      >
        <Home className="w-4 h-4" />
        <span>Home</span>
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
          
          {item.href && !item.isActive ? (
            <Link 
              to={item.href}
              className="text-primary hover:text-primary/80 transition-colors whitespace-nowrap"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(
              "whitespace-nowrap",
              item.isActive ? "text-foreground font-medium" : "text-muted-foreground"
            )}>
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  )
}