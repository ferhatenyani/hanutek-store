"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, LogOut, Menu as MenuIcon, Monitor, Moon, Search, Settings, Sun, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, Badge, Button, Kbd } from "../ui/core";
import { Dialog, Menu } from "../ui/overlay";
import { Portal, useLayer } from "../ui/floating";
import { ROLE } from "../lib/meta";
import { NAV, ALL_NAV, activeNav } from "./nav";
import { useSession } from "./session";
import { CommandPalette } from "./command";
import { useTheme, type ThemePref } from "./theme";

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.closest("[role=dialog],[role=listbox],[role=menu]") !== null);

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 rounded-md px-1 py-0.5">
      <span aria-hidden className="grid size-6 place-items-center rounded-md bg-ad-ink text-[11px] font-bold text-ad-ink-fg">
        h
      </span>
      <span className="text-[14px] font-semibold tracking-[-0.01em] text-ad-fg">hanutek</span>
      <span className="rounded border border-ad-border px-1.5 py-px text-[10.5px] font-medium text-ad-muted">Admin</span>
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useSession();
  const current = activeNav(pathname);
  return (
    <nav aria-label="Admin" className="flex flex-col gap-5">
      {NAV.map((s, si) => {
        const items = s.items.filter((i) => !i.permission || can(i.permission));
        if (!items.length) return null;
        return (
          <div key={si}>
            {s.section && <p className="mb-1 px-2.5 text-[11px] font-medium text-ad-faint">{s.section}</p>}
            <ul className="flex flex-col gap-px">
              {items.map((i) => {
                const active = current?.href === i.href;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors duration-75",
                        active ? "bg-ad-hover font-medium text-ad-fg" : "text-ad-muted hover:bg-ad-hover hover:text-ad-fg",
                      )}
                    >
                      <i.icon size={15} strokeWidth={active ? 2.1 : 1.8} aria-hidden className="shrink-0" />
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function ThemeMenuItems(pref: ThemePref, setPref: (p: ThemePref) => void) {
  return [
    { type: "label" as const, label: "Theme" },
    { label: "Light", icon: <Sun size={14} />, onSelect: () => setPref("light"), shortcut: pref === "light" ? "✓" : undefined },
    { label: "Dark", icon: <Moon size={14} />, onSelect: () => setPref("dark"), shortcut: pref === "dark" ? "✓" : undefined },
    { label: "System", icon: <Monitor size={14} />, onSelect: () => setPref("system"), shortcut: pref === "system" ? "✓" : undefined },
  ];
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const isTop = useLayer(open);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && isTop() && onClose();
    document.addEventListener("keydown", onKey);
    setTimeout(() => panel.current?.querySelector<HTMLElement>("a[aria-current=page],a")?.focus(), 30);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open, isTop, onClose]);
  if (!open) return null;
  return (
    <Portal>
      <div className="fixed inset-0 z-[70] lg:hidden">
        <div className="ad-anim-fade absolute inset-0 bg-[var(--ad-overlay)]" onClick={onClose} aria-hidden />
        <div ref={panel} role="dialog" aria-modal="true" aria-label="Navigation" className="ad-anim-fade absolute inset-y-0 start-0 flex w-[min(280px,85vw)] flex-col border-e border-ad-border bg-ad-panel">
          <div className="flex h-14 items-center justify-between border-b border-ad-border px-3">
            <Brand />
            <Button variant="ghost" size="sm" icon aria-label="Close navigation" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          <div className="ad-scroll flex-1 overflow-y-auto p-3">
            <NavList onNavigate={onClose} />
          </div>
        </div>
      </div>
    </Portal>
  );
}

const SHORTCUTS: [string[], string][] = [
  [["⌘", "K"], "Open command menu"],
  [["/"], "Search the current list"],
  [["G", "…"], "Go to a section (e.g. G then O = Orders)"],
  [["J", "K"], "Move between table rows"],
  [["X"], "Select the focused row"],
  [["Enter"], "Open the focused row"],
  [["?"], "Show keyboard shortcuts"],
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useSession();
  const { pref, setPref } = useTheme();
  const [cmdOpen, setCmdOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const gPressed = useRef(0);
  const main = useRef<HTMLElement>(null);
  const closeCmd = useCallback(() => setCmdOpen(false), []);
  const closeNav = useCallback(() => setNavOpen(false), []);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === "g") {
        gPressed.current = Date.now();
        return;
      }
      if (Date.now() - gPressed.current < 900) {
        const target = ALL_NAV.find((n) => n.key === e.key.toLowerCase());
        gPressed.current = 0;
        if (target) {
          e.preventDefault();
          router.push(target.href);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  // move focus to the page on navigation (screen readers + keyboard users)
  useEffect(() => {
    main.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [pathname]);

  const current = activeNav(pathname);

  return (
    <div className="min-h-dvh">
      <a href="#admin-main" className="sr-only z-[100] rounded-md bg-ad-ink px-3 py-2 text-ad-ink-fg focus:not-sr-only focus:fixed focus:start-3 focus:top-3">
        Skip to content
      </a>
      {/* sidebar (desktop) */}
      <aside className="fixed inset-y-0 start-0 z-30 hidden w-60 flex-col border-e border-ad-border bg-ad-bg lg:flex">
        <div className="flex h-14 items-center px-4">
          <Brand />
        </div>
        <div className="px-3 pb-3">
          <button
            type="button"
            onClick={() => setCmdOpen(true)}
            className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md border border-ad-border bg-ad-panel px-2.5 text-[13px] text-ad-faint shadow-ad transition-colors hover:border-ad-border-strong hover:text-ad-muted"
          >
            <Search size={14} aria-hidden />
            <span className="flex-1 text-start">Search…</span>
            <Kbd>⌘K</Kbd>
          </button>
        </div>
        <div className="ad-scroll flex-1 overflow-y-auto px-3 pb-4">
          <NavList />
        </div>
        <div className="border-t border-ad-border p-3">
          <Menu
            align="start"
            label="Account"
            items={[
              { type: "label", label: user.email },
              { label: "Settings", icon: <Settings size={14} />, onSelect: () => router.push("/admin/settings") },
              { label: "View store", icon: <ExternalLink size={14} />, onSelect: () => window.open("/", "_blank", "noopener") },
              { type: "separator" },
              ...ThemeMenuItems(pref, setPref),
              { type: "separator" },
              { label: "Sign out", icon: <LogOut size={14} />, onSelect: () => void signOut() },
            ]}
            trigger={(p) => (
              <button {...p} type="button" className="flex w-full cursor-pointer items-center gap-2.5 rounded-md p-1.5 text-start hover:bg-ad-hover" aria-label="Account menu">
                <Avatar name={user.name} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ad-fg">{user.name}</span>
                  <span className="block truncate text-xs text-ad-muted">{ROLE[user.role].label}</span>
                </span>
              </button>
            )}
          />
        </div>
      </aside>

      {/* top bar (tablet / phone) */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-ad-border bg-ad-bg/95 px-3 backdrop-blur-sm lg:hidden">
        <Button variant="ghost" size="sm" icon aria-label="Open navigation" onClick={() => setNavOpen(true)}>
          <MenuIcon size={17} />
        </Button>
        <Brand />
        <span className="min-w-0 flex-1 truncate text-[13px] text-ad-muted max-sm:hidden">{current ? `/ ${current.label}` : ""}</span>
        <div className="ms-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" icon aria-label="Search" onClick={() => setCmdOpen(true)}>
            <Search size={16} />
          </Button>
          <Menu
            label="Account"
            items={[
              { type: "label", label: user.email },
              { label: "Settings", icon: <Settings size={14} />, onSelect: () => router.push("/admin/settings") },
              ...ThemeMenuItems(pref, setPref),
              { type: "separator" },
              { label: "Sign out", icon: <LogOut size={14} />, onSelect: () => void signOut() },
            ]}
            trigger={(p) => (
              <button {...p} type="button" aria-label="Account menu" className="cursor-pointer rounded-full">
                <Avatar name={user.name} size={30} />
              </button>
            )}
          />
        </div>
      </header>

      <main id="admin-main" ref={main} tabIndex={-1} className="outline-none lg:ps-60">
        <div className="mx-auto w-full max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>

      <MobileNav open={navOpen} onClose={closeNav} />
      <CommandPalette open={cmdOpen} onClose={closeCmd} />
      <Dialog open={helpOpen} onClose={() => setHelpOpen(false)} size="sm" title="Keyboard shortcuts">
        <ul className="divide-y divide-ad-border">
          {SHORTCUTS.map(([keys, label]) => (
            <li key={label} className="flex items-center justify-between gap-4 py-2 text-[13px]">
              <span className="text-ad-muted">{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ad-faint">
          <Badge>Tip</Badge> On Windows and Linux use Ctrl instead of ⌘.
        </p>
      </Dialog>
    </div>
  );
}
