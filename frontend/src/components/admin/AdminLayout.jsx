import React, { useEffect, useRef, useState } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen, X, ChevronRight } from "lucide-react";
// Inter (as in the reference design), self-hosted and loaded only with the dashboards
import "@fontsource-variable/inter";

const COLLAPSE_KEY = "adminSidebarCollapsed";

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

const saveCollapsed = (value) => {
  try {
    localStorage.setItem(COLLAPSE_KEY, value ? "1" : "0");
  } catch {}
};

// Admin shell: collapsible left sidebar (drawer on mobile) + sticky header.
// navGroups: [{ label, items: [{ key, label, icon, badge }] }]
export default function AdminLayout({ navGroups, activeKey, onNavigate, title, breadcrumb, actions, children }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeButtonRef = useRef(null);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      saveCollapsed(!prev);
      return !prev;
    });
  };

  // Escape closes the mobile drawer; focus moves into it when it opens
  useEffect(() => {
    if (!mobileOpen) return undefined;
    closeButtonRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const handleNavigate = (key) => {
    onNavigate(key);
    setMobileOpen(false);
  };

  return (
    <div data-dashboard className="min-h-screen bg-[#f5f4f0] dark:bg-slate-950 text-slate-800 dark:text-slate-100">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-white dark:bg-slate-900 shadow-[1px_0_0_rgba(15,23,42,0.06)] dark:shadow-none transition-[width] duration-200 ${
          collapsed ? "w-[84px]" : "w-[272px]"
        }`}
        aria-label="Admin navigation"
      >
        <SidebarBrand collapsed={collapsed} />
        <SidebarNav groups={navGroups} activeKey={activeKey} onNavigate={handleNavigate} collapsed={collapsed} />
        <div className="p-4">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
              collapsed ? "justify-center px-0" : ""
            }`}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
            {!collapsed && <span>Collapse menu</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[400]" role="dialog" aria-modal="true" aria-label="Admin navigation">
          <div className="absolute inset-0 bg-slate-950/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white dark:bg-slate-900 shadow-xl animate-drawerIn">
            <div className="flex items-center justify-between pr-4">
              <SidebarBrand collapsed={false} />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav groups={navGroups} activeKey={activeKey} onNavigate={handleNavigate} collapsed={false} />
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]"}`}>
        <header className="sticky top-0 z-30 bg-[#f5f4f0]/85 dark:bg-slate-950/85 backdrop-blur">
          <div className="mx-auto flex h-[76px] max-w-[1440px] items-center gap-3 px-4 md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 shadow-sm hover:text-slate-900 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1 pl-1">
              {breadcrumb?.length > 0 && (
                <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {breadcrumb.map((crumb, i) => (
                    <React.Fragment key={crumb}>
                      {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
                      <span>{crumb}</span>
                    </React.Fragment>
                  ))}
                </nav>
              )}
              <h1 className="truncate text-lg md:text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h1>
            </div>

            <div className="flex shrink-0 items-center gap-2 md:gap-3">{actions}</div>
          </div>
        </header>

        <main className="px-4 pb-10 pt-2 md:px-8">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>

      <style>{`
        @keyframes drawerIn { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        .animate-drawerIn { animation: drawerIn 0.2s ease-out both; }
      `}</style>
    </div>
  );
}

function SidebarBrand({ collapsed }) {
  return (
    <div className={`flex h-[76px] shrink-0 items-center gap-3 ${collapsed ? "justify-center px-2" : "px-6"}`}>
      <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl object-contain" />
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate text-lg font-bold tracking-tight text-slate-900 dark:text-white">Saraswati</p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Admin Console</p>
        </div>
      )}
    </div>
  );
}

function SidebarNav({ groups, activeKey, onNavigate, collapsed }) {
  return (
    // Scrolling would clip the collapsed tooltips, so the collapsed rail stays visible-overflow
    <nav className={`flex-1 px-4 py-2 space-y-6 ${collapsed ? "overflow-visible" : "overflow-y-auto"}`}>
      {groups.map((group) => (
        <div key={group.label}>
          {collapsed ? (
            <div className="mx-auto mb-3 h-px w-8 bg-slate-200 dark:bg-slate-800" aria-hidden="true" />
          ) : (
            <p className="mb-2 px-4 text-xs font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {group.label}
            </p>
          )}
          <ul className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.key === activeKey;
              return (
                <li key={item.key} className="relative group">
                  <button
                    type="button"
                    onClick={() => onNavigate(item.key)}
                    aria-current={active ? "page" : undefined}
                    aria-label={collapsed ? item.label : undefined}
                    className={`relative flex w-full items-center gap-3 rounded-xl py-2.5 text-[15px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 cursor-pointer ${
                      collapsed ? "justify-center px-0" : "px-4"
                    } ${
                      active
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                    {item.badge > 0 &&
                      (collapsed ? (
                        <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" />
                      ) : (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            active
                              ? "bg-indigo-600 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {item.badge}
                        </span>
                      ))}
                  </button>
                  {collapsed && (
                    <span
                      role="tooltip"
                      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-900 dark:bg-slate-700 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      {item.label}
                      {item.badge > 0 ? ` (${item.badge})` : ""}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
