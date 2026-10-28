import BrandLogo from "../BrandLogo";
import ThemeToggle from "../ThemeToggle";

// Shared look for the round icon buttons in the parent and tutor portal headers
export const headerIconButton =
  "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white";

// Page frame for the signed-in parent and tutor portals
export default function PortalShell({ portal, actions, children }) {
  return (
    <div data-dashboard className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandLogo alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Saraswati Tutorials</p>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">{portal}</p>
            </div>
          </a>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <ThemeToggle buttonClassName={headerIconButton} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
    </div>
  );
}
