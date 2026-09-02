"use client";
import { ThemeProvider } from "next-themes";
import { AppDataProvider } from "@/components/AppDataProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AppDataProvider>{children}</AppDataProvider>
    </ThemeProvider>
  );
}
