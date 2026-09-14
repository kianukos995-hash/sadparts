"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AvtoPriceProvider } from "@/hooks/use-avtoprice";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";
import { TelegramBridge } from "@/components/telegram-bridge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function AuthedApp({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const open = pathname.startsWith("/login") || pathname.startsWith("/register");
  if (open || !user) return <>{children}</>;
  if (user.status === "pending_key") {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center gap-3 p-6">
        <h1 className="text-xl font-semibold">Ждём ключ</h1>
        <p className="text-sm text-muted-foreground">
          Почта {user.email} подтверждена. Ключ выдаёт администратор или организация, которая вас
          пригласила. После выдачи проценка откроется.
        </p>
        <Button variant="outline" onClick={() => void logout()}>
          Выйти
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            void fetch("/api/auth/users", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "request-key",
                target: user.role === "organization" ? "admin" : "organization",
              }),
            }).then(async (response) => {
              const data = (await response.json()) as { error?: string };
              if (!response.ok) {
                toast.error(data.error || "Не удалось отправить запрос");
                return;
              }
              toast.success("Запрос ключа отправлен");
            });
          }}
        >
          Запросить ключ
        </Button>
      </div>
    );
  }
  return (
    <AvtoPriceProvider>
      <AppShell>{children}</AppShell>
      {user.role === "admin" ? <TelegramBridge /> : null}
    </AvtoPriceProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AuthProvider>
          <AuthedApp>{children}</AuthedApp>
        </AuthProvider>
        <Toaster richColors position="top-right" />
      </TooltipProvider>
    </ThemeProvider>
  );
}
