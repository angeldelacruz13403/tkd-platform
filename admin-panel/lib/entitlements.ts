import { db } from "@/lib/db";
import { getSession, forbidden, unauthorized } from "@/lib/api-auth";
import { getSupabaseClient } from "@/lib/supabase";
import { ClubPlan, UserRole } from "@/lib/types";

export type ProductFeature =
  | "student-management"
  | "student-videos"
  | "club-finance"
  | "class-management"
  | "class-training"
  | "telemetry"
  | "gamification"
  | "coach-management"
  | "competitions"
  | "scoreboard"
  | "content-library"
  | "analytics"
  | "reports"
  | "ai-tools";

const planRank: Record<ClubPlan, number> = {
  FREE: 0,
  SEMIPRO: 1,
  PRO: 2,
};

const featureMinimumPlan: Record<ProductFeature, ClubPlan> = {
  "student-management": "FREE",
  "student-videos": "FREE",
  "club-finance": "FREE",
  "class-management": "SEMIPRO",
  "class-training": "SEMIPRO",
  telemetry: "SEMIPRO",
  gamification: "SEMIPRO",
  "coach-management": "PRO",
  competitions: "PRO",
  scoreboard: "PRO",
  "content-library": "PRO",
  analytics: "PRO",
  reports: "PRO",
  "ai-tools": "PRO",
};

export function planHasFeature(plan: ClubPlan, feature: ProductFeature): boolean {
  return planRank[plan] >= planRank[featureMinimumPlan[feature]];
}

export async function resolveClubId(
  userId: string,
  role: UserRole,
  claimedClubId?: string
): Promise<string | null> {
  if (role === "ADMIN") return claimedClubId || null;
  if (claimedClubId) return claimedClubId;

  const client = getSupabaseClient();
  if (client && role === "ATHLETE") {
    const { data, error } = await client
      .from("athletes")
      .select("club_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.club_id || null;
  }
  if (client && role === "COACH") {
    const { data, error } = await client
      .from("coaches")
      .select("club_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data?.club_id || null;
  }

  if (role === "ATHLETE") {
    return db.athletes.find((athlete) => athlete.userId === userId)?.clubId || null;
  }
  if (role === "COACH") {
    return db.coaches.find((coach) => coach.userId === userId)?.clubId || null;
  }
  return null;
}

export async function getClubPlan(clubId: string): Promise<ClubPlan> {
  const client = getSupabaseClient();
  let subscription = db.clubSubscriptions.get(clubId);

  if (client) {
    const { data, error } = await client
      .from("club_subscriptions")
      .select("plan_tier,manual_plan_tier,status,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end")
      .eq("club_id", clubId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return "FREE";
    if (isClubPlan(data.manual_plan_tier)) return data.manual_plan_tier;

    const now = Date.now();
    const currentPeriodEnd = data.current_period_end ? Date.parse(data.current_period_end) : 0;
    const trialEndsAt = data.trial_ends_at ? Date.parse(data.trial_ends_at) : 0;
    const graceEndsAt = data.grace_ends_at ? Date.parse(data.grace_ends_at) : 0;
    if (data.status === "TRIALING" && (!Number.isFinite(trialEndsAt) || trialEndsAt <= now)) return "FREE";
    if (data.status === "PAST_DUE" && (!Number.isFinite(graceEndsAt) || graceEndsAt <= now)) return "FREE";
    if (data.status === "CANCELED" && (
      !data.cancel_at_period_end ||
      !Number.isFinite(currentPeriodEnd) ||
      currentPeriodEnd <= now
    )) return "FREE";
    if (data.cancel_at_period_end && (!Number.isFinite(currentPeriodEnd) || currentPeriodEnd <= now)) return "FREE";
    return isClubPlan(data.plan_tier) ? data.plan_tier : "FREE";
  }

  if (!subscription) {
    subscription = {
      clubId,
      planTier: "FREE",
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    };
    db.clubSubscriptions.set(clubId, subscription);
  }
  const now = Date.now();
  if (
    (subscription.status === "TRIALING" && !isFutureDate(subscription.trialEndsAt, now)) ||
    (subscription.status === "PAST_DUE" && !isFutureDate(subscription.graceEndsAt, now)) ||
    (subscription.status === "CANCELED" &&
      (!subscription.cancelAtPeriodEnd || !isFutureDate(subscription.currentPeriodEnd, now)))
  ) {
    return "FREE";
  }
  if (subscription.cancelAtPeriodEnd && !isFutureDate(subscription.currentPeriodEnd, now)) return "FREE";
  return isClubPlan(subscription.planTier) ? subscription.planTier : "FREE";
}

function isClubPlan(value: unknown): value is ClubPlan {
  return value === "FREE" || value === "SEMIPRO" || value === "PRO";
}

function isFutureDate(value: string | undefined, now: number): boolean {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now;
}

export async function authorizeFeature(
  request: Request,
  feature: ProductFeature
): Promise<
  | { session: NonNullable<ReturnType<typeof getSession>>; clubId: string | null; plan: ClubPlan }
  | { response: Response }
> {
  const session = getSession(request);
  if (!session) return { response: unauthorized() };
  if (session.role === "ADMIN") return { session, clubId: session.clubId || null, plan: "PRO" };

  try {
    const clubId = await resolveClubId(session.id, session.role, session.clubId);
    if (!clubId) return { response: forbidden() };
    const plan = await getClubPlan(clubId);
    if (!planHasFeature(plan, feature)) {
      return {
        response: Response.json(
          {
            success: false,
            error: `Esta función requiere el plan ${featureMinimumPlan[feature]}.`,
            code: "PLAN_UPGRADE_REQUIRED",
            requiredPlan: featureMinimumPlan[feature],
            currentPlan: plan,
          },
          { status: 402 }
        ),
      };
    }
    return { session, clubId, plan };
  } catch (error) {
    console.error("[ENTITLEMENTS] No se pudo verificar el plan del club:", error);
    return {
      response: Response.json(
        { success: false, error: "No se pudo verificar el plan del club." },
        { status: 503 }
      ),
    };
  }
}

export function isAuthorizationResponse(
  result: Awaited<ReturnType<typeof authorizeFeature>>
): result is { response: Response } {
  return "response" in result;
}

export const PLAN_PRICES_EUR = {
  SEMIPRO: { MONTH: 1999, YEAR: 21999 },
  PRO: { MONTH: 2999, YEAR: 32999 },
} as const;
