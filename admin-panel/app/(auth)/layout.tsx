import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Iniciar Sesión | TKD Global Hub",
  description: "Acceso seguro al Panel de Administración del Ecosistema Profesional de Taekwondo",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
