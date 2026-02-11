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
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            gcTime: 1000 * 60 * 10, // 10 minutes
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <div style={{ position: 'fixed', bottom: 0, right: 0, zIndex: 99999, background: 'blue', color: 'white', padding: '8px', fontSize: '12px' }}>
          PROVIDERS OK
        </div>
        <AuthProvider>
          <NotificationsBootstrap />
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
