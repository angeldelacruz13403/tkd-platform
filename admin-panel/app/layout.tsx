import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "TKD Global Hub | Panel de Administración & Ecosistema de Alto Rendimiento",
  description: "Plataforma integral de Taekwondo de élite: telemetría cardíaca en tiempo real, marcador Daedo, gestión de clubes, atletas y reentrenamiento continuo de IA.",
  keywords: ["Taekwondo", "World Taekwondo", "Kyorugi", "Poomsae", "Cardio Telemetry", "AI Retraining", "Daedo", "Sports Science"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} ${outfit.variable} font-sans bg-[#06090f] text-slate-100 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
