import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { User } from "@/lib/types";

type Session = Pick<User, "id" | "role" | "clubId" | "isClubDirector">;

const developmentSecret = "tkd-global-hub-local-development-only";

function getSecret(): string | null {
  return process.env.TKD_API_SECRET || (process.env.NODE_ENV === "production" ? null : developmentSecret);
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function createApiToken(user: Session) {
  const secret = getSecret();
  if (!secret) throw new Error("TKD_API_SECRET debe configurarse en producción.");
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString("base64url");
  return `tkd_${payload}.${sign(payload, secret)}`;
}

export function getSession(request: Request | NextRequest): Session | null {
  const secret = getSecret();
  if (!secret) return null;
  const authorization = request.headers.get("authorization");
  const cookie = "cookies" in request ? request.cookies.get("tkd_token")?.value : undefined;
  const token = authorization?.replace(/^Bearer\s+/i, "") || cookie;
  if (!token?.startsWith("tkd_")) return null;
  const [payload, signature] = token.slice(4).split(".");
  if (!payload || !signature) return null;
  const expected = sign(payload, secret);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Session & { exp: number };
    if (
      !session.id ||
      !isUserRole(session.role) ||
      !Number.isFinite(session.exp) ||
      session.exp < Date.now()
    ) return null;
    return {
      id: session.id,
      role: session.role,
      clubId: session.clubId,
      isClubDirector: session.role === "COACH" && session.isClubDirector === true,
    };
  } catch {
    return null;
  }
}

function isUserRole(value: unknown): value is User["role"] {
  return value === "ADMIN" || value === "COACH" || value === "ATHLETE" || value === "CLUB";
}

export function canAccessClub(session: Session, clubId?: string | null) {
  return session.role === "ADMIN" || (!!session.clubId && session.clubId === clubId);
}

export function hasRole(session: Session, role: User["role"]) {
  return session.role === role ||
    (role === "CLUB" && session.role === "COACH" && session.isClubDirector === true);
}

export function unauthorized() {
  return new Response(JSON.stringify({ success: false, error: "Sesión no válida o expirada" }), { status: 401, headers: { "Content-Type": "application/json" } });
}

export function forbidden() {
  return new Response(JSON.stringify({ success: false, error: "No tienes acceso a este club" }), { status: 403, headers: { "Content-Type": "application/json" } });
}
