import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export const metadata: Metadata = {
  title: "Demo Tracker — Ditch Witch of Arkansas",
  description: "Know who has what, when it is due, and who needs a follow-up.",
};

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/", label: "Demos" },
  { href: "/equipment", label: "Equipment" },
  { href: "/calendar", label: "Calendar" },
  { href: "/review", label: "Review" },
  { href: "/sold", label: "Sold" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        {user ? (
          <header className="no-print sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-base font-bold leading-tight">Demo Tracker</p>
                <p className="truncate text-xs text-gray-500">Ditch Witch of Arkansas — Little Rock</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="hidden rounded-full bg-orange-100 px-3 py-1 text-xs font-bold text-orange-800 sm:inline">
                  {user.name} · {user.role}
                </span>
                <LogoutButton />
              </div>
            </div>
            <nav className="border-t border-gray-100">
              <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4">
                {NAV.map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className="whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  >
                    {n.label}
                  </Link>
                ))}
                {user.role === "ADMIN" ? (
                  <Link
                    href="/team"
                    className="whitespace-nowrap rounded-t-lg px-4 py-3 text-sm font-semibold text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  >
                    Team
                  </Link>
                ) : null}
              </div>
            </nav>
          </header>
        ) : null}
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
