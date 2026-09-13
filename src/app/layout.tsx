import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
});

export const viewport = {
  themeColor: "#f59e0b",
};

export const metadata: Metadata = {
  title: "SadParts Prices — прайсы автозапчастей",
  description:
    "Ключи API поставщиков, поиск по артикулу и OEM, аналоги, заказы с наценкой и скидкой клиента.",
  applicationName: "SadParts Prices",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${manrope.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
