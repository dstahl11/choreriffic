import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AdminLoginPage() {
  if (await isAdminAuthenticated()) redirect("/admin");
  return (
    <main className="admin-login-shell">
      <section className="admin-login-card">
        <a className="back-link" href="/">← Sticker Board</a>
        <h1>Household admin</h1>
        <p>Manage people, schedules, and one-off chore changes.</p>
        <AdminLoginForm />
      </section>
    </main>
  );
}
