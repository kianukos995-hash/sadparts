"use client";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AvtoPriceProvider } from "@/hooks/use-avtoprice";
import { AppShell } from "@/components/app-shell";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
      <TooltipProvider>
        <AvtoPriceProvider>
          <AppShell>{children}</AppShell>
          <Toaster richColors position="top-right" />
        </AvtoPriceProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}
