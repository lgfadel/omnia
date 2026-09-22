"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { useAuth } from "@/components/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logging";

type PageState = "loading" | "ready" | "invalid";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [state, setState] = useState<PageState>("loading");
  // Uma sessão presente encerra a questão, e derivar daqui a garante acima do
  // timeout de 7 s — que, copiada num efeito, ainda podia marcar "invalid" depois.
  const pageState: PageState = session ? "ready" : state;

  useEffect(() => {
    let alive = true;

    const timeoutId = setTimeout(() => {
      if (!alive) return;
      setState("invalid");
    }, 7000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!alive) return;
      logger.info("Reset password auth state changed", { event });

      if (nextSession) {
        clearTimeout(timeoutId);
        setState("ready");
      }
    });

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();

        if (!alive) return;

        if (data.session) {
          clearTimeout(timeoutId);
          setState("ready");
          return;
        }
      } catch (error) {
        logger.error("Failed to initialize reset-password session", error);
        if (!alive) return;
        setState("invalid");
      }
    };

    init();

    return () => {
      alive = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const handleSuccess = () => {
    router.push("/");
  };

  const handleCancel = () => {
    router.push("/auth");
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md">
          <Alert>
            <AlertDescription>Validando link de redefinição de senha...</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              Link de redefinição inválido ou expirado. Solicite novamente em "Esqueci minha senha".
            </AlertDescription>
          </Alert>
          <Button className="w-full" onClick={handleCancel}>
            Voltar ao login
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <ChangePasswordForm onSuccess={handleSuccess} onCancel={handleCancel} />
    </div>
  );
}
