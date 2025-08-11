import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "~/components/ui/sonner";
import { ThemeProvider } from "~/components/providers/theme-provider";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "Dashboard App",
  description: "A modern dashboard application with authentication",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SessionProvider>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <Toaster position="top-center" richColors />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
