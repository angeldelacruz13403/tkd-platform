import { redirect } from "next/navigation";

export default function FinanceRedirectPage() {
  redirect("/club-management?tab=finance");
}
