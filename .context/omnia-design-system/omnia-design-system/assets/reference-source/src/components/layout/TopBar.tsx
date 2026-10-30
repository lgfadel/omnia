"use client"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationsMenu } from "@/components/notifications/NotificationsMenu"

export function TopBar() {
  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        <div className="icon-text-align">
          <SidebarTrigger className="h-6 w-6 nav-item-hover p-1 rounded-md" />
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <NotificationsMenu />
        </div>
      </div>
    </header>
  )
}