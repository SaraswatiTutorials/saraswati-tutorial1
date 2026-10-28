import { CheckCircle2 } from "lucide-react";
import BrandLogo from "../BrandLogo";
import ThemeToggle from "../ThemeToggle";
import { headerIconButton } from "./PortalShell";

// Sign-in page shared by the parent and tutor portals: a brand panel beside the form on
// large screens, the form alone on phones
export default function PortalLogin({ portal, headline, features, title, subtitle, children, footer }) {
  return (
    <div data-dashboard className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100 lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />

        <a href="/" className="relative flex items-center gap-3">
          <BrandLogo alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-0.5" />
          <span className="text-lg font-bold">Saraswati Tutorials</span>
        </a>

        <div className="relative max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-200">{portal}</p>
          <h1 className="mt-3 text-4xl font-bold leading-tight text-white">{headline}</h1>
          <ul className="mt-8 space-y-4">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-3 text-sm text-indigo-100">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-indigo-200/80">Verified home and online tutors · Bangalore & Mumbai</p>
      </aside>

      <div className="flex min-h-screen flex-col px-4 py-5 sm:px-8">
        <div className="flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 lg:invisible">
            <BrandLogo alt="" className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-sm font-bold text-slate-900 dark:text-white">Saraswati Tutorials</span>
          </a>
          <ThemeToggle buttonClassName={headerIconButton} />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm animate-fadeIn">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-400 lg:hidden">{portal}</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl lg:mt-0">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 border-t border-slate-200 pt-5 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
