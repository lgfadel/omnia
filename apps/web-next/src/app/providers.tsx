// Use client-side hooks/providers
"use client";

/**
 * Global providers for the Next.js app.
 * Wraps the app with QueryClient, theme/toast providers, auth, and error boundary.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { NotificationsBootstrap } from "@/components/notifications/NotificationsBootstrap";

export function Providers({ children }: { children: ReactNode }) {
  // Create QueryClient once per app shell
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <NotificationsBootstrap />
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
