import { db } from "@/lib/db";
import { forbidden, getSession, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { authorizeFeature, isAuthorizationResponse as isEntitlementResponse } from "@/lib/entitlements";

export type AISession = NonNullable<ReturnType<typeof getSession>>;

export interface AccessibleAthlete {
  id: string;
  user_id?: string | null;
  coach_id?: string | null;
  club_id?: string | null;
  name?: string;
  [key: string]: unknown;
}

export type AthleteAuthorization =
  | { session: AISession; athlete: AccessibleAthlete }
  | { response: Response };

export async function authorizeAthlete(
  request: Request,
  athleteId: string,
  allowedRoles: AISession["role"][] = ["ADMIN", "COACH"]
): Promise<AthleteAuthorization> {
  const session = getSession(request);
  if (!session) return { response: unauthorized() };
  if (!allowedRoles.includes(session.role)) return { response: forbidden() };
  const entitlement = await authorizeFeature(request, "ai-tools");
  if (isEntitlementResponse(entitlement)) return { response: entitlement.response };

  const client = getSupabaseClient();
  let athlete: AccessibleAthlete | null = null;

  if (client) {
    const { data, error } = await client
      .from("athletes")
      .select("*")
      .eq("id", athleteId)
      .maybeSingle();
    if (error) {
      return {
        response: Response.json(
          { success: false, error: "No se pudo verificar el acceso al atleta." },
          { status: 503 }
        ),
      };
    }
    athlete = data as AccessibleAthlete | null;
  } else {
    const record = db.athletes.find((item) => item.id === athleteId);
    if (record) {
      athlete = {
        ...record,
        id: record.id,
        user_id: record.userId,
        coach_id: record.coachId,
        club_id: record.clubId,
        name: record.fullName,
      };
    }
  }

  if (!athlete) {
    return {
      response: Response.json(
        { success: false, error: "No se encontró el atleta solicitado." },
        { status: 404 }
      ),
    };
  }

  if (session.role === "ADMIN") return { session, athlete };

  if (session.role === "ATHLETE" && athlete.user_id === session.id) {
    return { session, athlete };
  }

  if (session.role === "CLUB" && athlete.club_id === session.clubId) {
    return { session, athlete };
  }

  if (session.role === "COACH") {
    if (client) {
      const { data: coach, error } = await client
        .from("coaches")
        .select("id,club_id")
        .eq("user_id", session.id)
        .maybeSingle();
      if (error) {
        return {
          response: Response.json(
            { success: false, error: "No se pudo verificar la asignación del entrenador." },
            { status: 503 }
          ),
        };
      }
      if (
        coach &&
        (athlete.coach_id === coach.id ||
          (coach.club_id && athlete.club_id === coach.club_id) ||
          (session.clubId && athlete.club_id === session.clubId))
      ) {
        return { session, athlete };
      }
    } else {
      const coach = db.coaches.find((item) => item.userId === session.id);
      if (
        coach &&
        (athlete.coach_id === coach.id ||
          (coach.clubId && athlete.club_id === coach.clubId) ||
          (session.clubId && athlete.club_id === session.clubId))
      ) {
        return { session, athlete };
      }
    }
  }

  return { response: forbidden() };
}

export function isAuthorizationResponse(
  result: AthleteAuthorization
): result is { response: Response } {
  return "response" in result;
}
