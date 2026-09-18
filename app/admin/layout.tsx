import Link from "next/link";
import { cookies } from "next/headers";
import { getAdminSession } from "@/lib/auth";
import { logoutAction } from "./actions";
import { getActiveEventSlug } from "@/lib/event/active";
import { LoginForm } from "./login-form";

/**
 * Auth gate for the whole admin. Without a valid session the login form is
 * rendered in place of any admin page; server actions re-check on their own.
 */
export const dynamic = "force-dynamic";

const NAV = [
  ["/admin", "Dashboard"],
  ["/admin/conversations", "Conversations"],
  ["/admin/leads", "Leads"],
  ["/admin/handoffs", "Handoffs"],
  ["/admin/unanswered", "Unanswered"],
  ["/admin/event", "Event"],
  ["/admin/knowledge", "Knowledge"],
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = getAdminSession(await cookies());
  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <LoginForm />
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <div className="font-semibold">
            Stallion Admin{" "}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-600">
              {getActiveEventSlug()}
            </span>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} className="text-slate-600 hover:text-slate-900">
                {label}
              </Link>
            ))}
          </nav>
          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="text-sm text-slate-500 hover:text-slate-900">
              Sign out ({session.email})
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4">{children}</main>
    </div>
  );
}
