import { SidebarTrigger } from "@/components/ui/sidebar"

export function TopBar() {
  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center gap-4 px-6">
        <SidebarTrigger className="w-6 h-6" />
        <div className="flex-1" />
      </div>
    </header>
  )
}