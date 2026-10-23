import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Manejo de CORS para la API REST consumida por la App Móvil (Expo/APK) y Dashboard
  if (pathname.startsWith("/api")) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
    return response;
  }

  // Pass-through for internal Next.js paths and static files
  if (pathname.startsWith("/_next") || pathname.includes(".")) {
    return NextResponse.next();
  }

  const token = request.cookies.get("tkd_token")?.value;
  const isLoginPage = pathname === "/login";
  const isPublicRegisterPage = pathname.startsWith("/register-tournament");
  const isPublicRoleSimulator = pathname.startsWith("/role-simulator");

  // Si ya tiene sesión activa y visita /login, enviarlo al dashboard
  if (isLoginPage && token) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Si NO tiene sesión y quiere acceder a rutas protegidas del panel, enviarlo a /login
  if (!isLoginPage && !isPublicRegisterPage && !isPublicRoleSimulator && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Cabeceras de seguridad para Vercel en producción
  const response = NextResponse.next();
  response.headers.set("X-DNS-Prefetch-Control", "on");
  response.headers.set("X-Frame-Options", "SAMEORIGIN");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
