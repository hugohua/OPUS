import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Providers } from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: "--font-mono",
});

export const metadata: Metadata = {
    title: "Opus | AI 职场英语训练",
    description: "AI 驱动的职场英语认知康复训练台",
    manifest: "/manifest.json",
    icons: {
        icon: [
            { url: "/favicon.svg", type: "image/svg+xml" },
        ],
        apple: [
            { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
        ],
    },
    appleWebApp: {
        capable: true,
        title: "Opus",
        statusBarStyle: "black-translucent",
    },
    formatDetection: {
        telephone: false,
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: "#09090B",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                suppressHydrationWarning
                style={{ backgroundColor: '#09090B' }}
                className={cn(
                    "min-h-screen bg-background font-sans antialiased",
                    inter.variable,
                    jetbrainsMono.variable
                )}
            >
                <div vaul-drawer-wrapper="" className="bg-background min-h-screen">
                    <Providers
                        attribute="class"
                        defaultTheme="dark"
                        enableSystem
                        disableTransitionOnChange
                    >
                        {children}
                        <Toaster />
                    </Providers>
                </div>
            </body>
        </html>
    );
}
