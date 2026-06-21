import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSession } from "@/lib/session";

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <AuthForm mode="signup" />
    </main>
  );
}
