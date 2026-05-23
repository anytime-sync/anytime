import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";import { AdminGuard } from "./admin-guard";
import { Users, BarChart3, FileText, Home, Palette, Tags, ToggleLeft } from "lucide-react";

/**
 * Admin layout — server-rendered auth gate + editorial sidebar shell.
 *
 * Visual treatment matches the public landing: First Light wordmark with
 * a small sun glyph, a thin gold rule, and each nav item carries a
 * kicker number so the page reads like an editorial table of contents.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) redirect("/app");

  const navItems = [
    { kicker: "01", href: "/admin", label: "Overview", icon: Home },
    { kicker: "02", href: "/admin/members", label: "Members", icon: Users },
    { kicker: "03", href: "/admin/feature-flags", label: "Feature flags", icon: ToggleLeft },
    { kicker: "04", href: "/admin/insights", label: "Insights", icon: BarChart3 },
    { kicker: "05", href: "/admin/content", label: "Content", icon: FileText },
    { kicker: "06", href: "/admin/design", label: "Design", icon: Palette },
    { kicker: "07", href: "/admin/keywords", label: "Keywords", icon: Tags },
  ];

  return (
    <AdminGuard serverEmail={user.email ?? null}><div className="min-h-screen flex bg-bg text-fg">
      <aside className="w-64 shrink-0 border-r border-border flex flex-col surface">
        <div className="px-6 pt-8 pb-6 border-b border-border">
          <Link href="/admin" className="flex items-center gap-2.5">
            <SmallSun className="size-5 text-accent shrink-0" />
            <span className="wordmark text-base">First Light</span>
          </Link>
          <p className="editorial-number text-[10px] mt-3 ml-[1.875rem]">
            The Admin Edition
          </p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {navItems.map(({ kicker, href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 px-2 h-10 rounded-md text-sm hover:bg-muted/60 transition-colors"
            >
              <span className="editorial-number text-[10px] w-5 shrink-0 group-hover:text-accent transition-colors">
                {kicker}
              </span>
              <Icon className="size-4 text-muted-fg group-hover:text-fg transition-colors" />
              <span className="group-hover:text-fg transition-colors">
                {label}
              </span>
            </Link>
          ))}
        </nav>

        <div className="px-6 py-5 border-t border-border">
          <Link
            href="/app"
            className="text-xs text-muted-fg hover:text-fg inline-flex items-center gap-1.5 transition-colors"
          >
            <span aria-hidden>←</span>
            Back to the app
          </Link>
          <p className="text-[10px] text-muted-fg/70 mt-3 italic font-display">
            For the keeper of the light.
          </p>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div></AdminGuard>);
}

function SmallSun({ className }: { className?: string }) {
  // Hand-tuned 48-ray sunburst — wildly varying ray lengths so it reads
  // as an explosion of light rather than a tidy clock-face. The radial
  // gradient mask softens the inner ends of every ray into the bright
  // empty centre, matching the reference illustration.
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="0.7"
      strokeLinecap="butt"
      aria-hidden
    >
      <defs>
        <radialGradient
          id="fl-sun-fade"
          cx="32"
          cy="32"
          r="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="black" />
          <stop offset="22%" stopColor="black" />
          <stop offset="55%" stopColor="white" />
          <stop offset="100%" stopColor="white" />
        </radialGradient>
        <mask id="fl-sun-fade-mask">
          <rect width="64" height="64" fill="url(#fl-sun-fade)" />
        </mask>
      </defs>
      <g mask="url(#fl-sun-fade-mask)">
        <line x1="32" y1="32" x2="32" y2={2} transform={`rotate(0 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={14} transform={`rotate(7.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={6} transform={`rotate(15 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={20} transform={`rotate(22.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={0} transform={`rotate(30 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={16} transform={`rotate(37.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={9} transform={`rotate(45 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={18} transform={`rotate(52.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={3} transform={`rotate(60 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={13} transform={`rotate(67.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={7} transform={`rotate(75 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={22} transform={`rotate(82.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={0} transform={`rotate(90 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={15} transform={`rotate(97.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={10} transform={`rotate(105 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={19} transform={`rotate(112.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={5} transform={`rotate(120 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={17} transform={`rotate(127.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={8} transform={`rotate(135 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={21} transform={`rotate(142.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={1} transform={`rotate(150 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={13} transform={`rotate(157.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={11} transform={`rotate(165 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={16} transform={`rotate(172.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={4} transform={`rotate(180 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={19} transform={`rotate(187.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={9} transform={`rotate(195 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={14} transform={`rotate(202.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={2} transform={`rotate(210 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={18} transform={`rotate(217.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={10} transform={`rotate(225 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={21} transform={`rotate(232.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={6} transform={`rotate(240 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={15} transform={`rotate(247.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={7} transform={`rotate(255 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={23} transform={`rotate(262.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={3} transform={`rotate(270 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={14} transform={`rotate(277.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={11} transform={`rotate(285 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={20} transform={`rotate(292.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={5} transform={`rotate(300 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={19} transform={`rotate(307.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={10} transform={`rotate(315 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={16} transform={`rotate(322.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={2} transform={`rotate(330 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={21} transform={`rotate(337.5 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={8} transform={`rotate(345 32 32)`} />
        <line x1="32" y1="32" x2="32" y2={14} transform={`rotate(352.5 32 32)`} />
      </g>
    </svg>
  );
}
