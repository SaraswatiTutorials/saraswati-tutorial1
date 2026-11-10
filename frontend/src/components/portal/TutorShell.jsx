import { useEffect, useRef, useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import BrandLogo from "../BrandLogo";
import ThemeToggle from "../ThemeToggle";
import { headerIconButton } from "./PortalShell";

// Page frame for the tutor portal: a fixed menu on the left on wide screens,
// and a menu that slides in from the left behind a ☰ button on phones.
// The parent portal keeps PortalShell.

function Brand() {
  return (
    <a href="/" className="flex min-w-0 items-center gap-2.5">
      <BrandLogo alt="" className="h-9 w-9 shrink-0 rounded-xl object-contain" />
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">Saraswati Tutorials</p>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Tutor Portal</p>
      </div>
    </a>
  );
}

function MenuBody({ nav, current, onPick, profileCard, onLogout }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">{profileCard}</div>

      <p className="px-6 pb-2 pt-6 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Menu</p>
      <nav aria-label="Tutor portal sections" className="flex-1 space-y-1 overflow-y-auto px-3">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPick(item.id)}
              aria-current={active ? "page" : undefined}
              className={`group flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition cursor-pointer ${
                active
                  ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/20"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              }`}
            >
              <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-slate-400 group-hover:text-indigo-600 dark:text-slate-500 dark:group-hover:text-indigo-400"}`} />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.badge != null && item.badge !== "" && (
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : item.badgeTone === "amber"
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        <button
          type="button"
          onClick={onLogout}
          className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-rose-50 hover:text-rose-600 dark:text-slate-300 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function TutorShell({ nav, current, onNavigate, profileCard, onLogout, actions, children }) {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  const currentLabel = nav.find((n) => n.id === current)?.label || "";

  const close = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  // While the phone menu is open: Esc closes it, the page behind doesn't scroll,
  // and turning the phone to a wide layout closes it.
  useEffect(() => {
    if (!open) return undefined;
    closeButtonRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") close(); };
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = () => { if (wide.matches) setOpen(false); };
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    wide.addEventListener?.("change", onWide);
    return () => {
      document.body.style.overflow = before;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener?.("change", onWide);
    };
  }, [open]);

  const pick = (id) => {
    onNavigate(id);
    setOpen(false);
    window.scrollTo({ top: 0 });
  };

  return (
    <div data-dashboard className="min-h-screen bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      {/* Wide screens: the menu stays on the left */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-5 dark:border-slate-800">
          <Brand />
        </div>
        <div className="min-h-0 flex-1">
          <MenuBody nav={nav} current={current} onPick={pick} profileCard={profileCard} onLogout={onLogout} />
        </div>
      </aside>

      {/* Phones and tablets: the menu slides in from the left */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={close}
        aria-hidden="true"
      />
      <aside
        id="tutor-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        // Shown at once when opening (so focus can move in); hidden only after sliding out
        className={`fixed inset-y-0 left-0 z-50 flex w-[86%] max-w-[300px] flex-col bg-white shadow-2xl duration-200 ease-out dark:bg-slate-900 lg:hidden ${
          open ? "visible translate-x-0 transition-transform" : "invisible -translate-x-full transition-[transform,visibility]"
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
          <Brand />
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <MenuBody nav={nav} current={current} onPick={pick} profileCard={profileCard} onLogout={onLogout} />
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                ref={menuButtonRef}
                type="button"
                onClick={() => setOpen(true)}
                aria-label="Open menu"
                aria-expanded={open}
                aria-controls="tutor-menu"
                className={`${headerIconButton} lg:hidden`}
              >
                <Menu className="h-5 w-5" />
              </button>
              <BrandLogo alt="" className="ml-1 hidden h-8 w-8 shrink-0 rounded-lg object-contain min-[360px]:block lg:hidden" />
              <div className="min-w-0 lg:hidden">
                <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{currentLabel}</p>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">Tutor Portal</p>
              </div>
              <p className="hidden truncate text-sm font-semibold text-slate-500 dark:text-slate-400 lg:block">
                Tutor Portal <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
                <span className="text-slate-900 dark:text-white">{currentLabel}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {actions}
              <ThemeToggle buttonClassName={headerIconButton} />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8">{children}</main>
      </div>
    </div>
  );
}
