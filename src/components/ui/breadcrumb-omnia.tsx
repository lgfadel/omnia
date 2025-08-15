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
    <nav className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}>
      <Link 
        to="/" 
        className="text-primary hover:text-primary/80 transition-colors"
      >
        Home
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center space-x-1">
          <ChevronRight className="w-4 h-4" />
          
          {item.href && !item.isActive ? (
            <Link 
              to={item.href}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              {item.label}
            </Link>
          ) : (
            <span className={cn(
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