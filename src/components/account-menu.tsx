"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { BREAKPOINTS } from "@/lib/breakpoints";
import { translate, type Language } from "@/lib/i18n";

const DESKTOP_MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusableMenuElements(menuElement: HTMLElement) {
  return menuElement.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
}

type DesktopPosition = { top: number; right: number };

export function AccountMenu({ language, email }: { language: Language; email?: string | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const [navigationCloseToken, setNavigationCloseToken] = useState(0);

  const [isMobile, setIsMobile] = useState(false);
  const [desktopPosition, setDesktopPosition] = useState<DesktopPosition | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.MD);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const focusTriggerIfConnected = useCallback(() => {
    const trigger = triggerRef.current;
    if (trigger?.isConnected) trigger.focus();
  }, []);

  const closeMenu = useCallback(
    (options: { restoreFocus?: boolean } = {}) => {
      setIsOpen(false);
      if (options.restoreFocus !== false) focusTriggerIfConnected();
    },
    [focusTriggerIfConnected],
  );

  // Anchored trigger-rect popover: recomputed from the trigger's live
  // bounding rect (not a CSS-relative offset) so it stays correct if the
  // sticky top bar or page scroll shifts the trigger's position.
  const updateDesktopPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setDesktopPosition({
      top: rect.bottom + DESKTOP_MENU_GAP,
      right: Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isOpen || isMobile) return;
    updateDesktopPosition();
    window.addEventListener("resize", updateDesktopPosition);
    window.addEventListener("scroll", updateDesktopPosition, true);
    return () => {
      window.removeEventListener("resize", updateDesktopPosition);
      window.removeEventListener("scroll", updateDesktopPosition, true);
    };
  }, [isOpen, isMobile, updateDesktopPosition]);

  // Move focus into the menu once it's mounted so keyboard and screen
  // reader users land on a menu control instead of the (now stale) trigger.
  useEffect(() => {
    if (!isOpen) return;
    const menuElement = menuRef.current;
    if (!menuElement) return;
    const [firstElement] = getFocusableMenuElements(menuElement);
    firstElement?.focus();
  }, [isOpen]);

  // Outside click and Escape/focus-trap handling.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        closeMenu();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }

      if (event.key === "Tab") {
        const menuElement = menuRef.current;
        if (!menuElement) return;

        const focusableElements = getFocusableMenuElements(menuElement);

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0] as HTMLElement;
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
          }
        }
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, closeMenu]);

  // Client-side navigation (Link/router transitions) doesn't fire
  // popstate, so the App Router's own pathname is the only reliable signal
  // that a navigation dismissal should close the menu. Adjusted during
  // render (React's recommended pattern for resetting state from a changed
  // prop) rather than in an effect, since setState-in-effect risks a
  // cascading extra render.
  if (pathname !== previousPathname) {
    setPreviousPathname(pathname);
    if (isOpen) {
      setIsOpen(false);
      setNavigationCloseToken((token) => token + 1);
    }
  }

  useEffect(() => {
    if (navigationCloseToken === 0) return;
    focusTriggerIfConnected();
  }, [navigationCloseToken, focusTriggerIfConnected]);

  const handleMenuItemClick = () => {
    closeMenu();
  };

  const menuLabel = translate(language, "account.menu");

  const getMenuClasses = () => {
    if (isMobile) {
      return "fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-lg border border-line bg-surface p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-lg";
    }
    return "fixed z-50 flex w-[260px] flex-col gap-1 rounded-lg border border-line bg-surface p-2 shadow-lg";
  };

  const getMenuStyle = () => {
    if (isMobile) return { animation: "slideUp 0.2s ease-out" };
    return {
      top: desktopPosition?.top ?? 0,
      right: desktopPosition?.right ?? VIEWPORT_MARGIN,
      animation: "slideUp 0.2s ease-out",
    };
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-primary-tint text-[15px] font-bold text-primary-d outline-none focus-visible:ring-2 focus-visible:ring-primary"
        title={menuLabel}
      >
        <span aria-hidden="true">⋮</span>
        <span className="sr-only">{menuLabel}</span>
      </button>

      {isOpen ? (
        <>
          <div
            className={isMobile ? "fixed inset-0 z-40 bg-black/30" : "hidden"}
            onClick={() => closeMenu()}
            aria-hidden="true"
          />

          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={menuLabel}
            className={getMenuClasses()}
            style={getMenuStyle()}
            onClick={(event) => event.stopPropagation()}
          >
            {isMobile && (
              <div className="mb-2 flex items-center justify-between border-b border-line px-4 py-2">
                <span className="text-[15px] font-semibold">{menuLabel}</span>
                <button
                  type="button"
                  onClick={() => closeMenu()}
                  className="text-ink hover:text-primary"
                  aria-label={translate(language, "dashboard.close")}
                >
                  ×
                </button>
              </div>
            )}

            {email ? (
              <div className="mb-1 border-b border-line px-3 pb-2">
                <p className="truncate text-[13px] font-semibold text-muted">{email}</p>
              </div>
            ) : null}

            <Link
              href="/pengaturan"
              role="menuitem"
              className="flex h-11 items-center rounded-md px-3 text-[15px] font-semibold text-ink outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-primary"
              onClick={handleMenuItemClick}
            >
              {translate(language, "nav.settings")}
            </Link>

            <Link
              href="/api/auth/signout?callbackUrl=/"
              role="menuitem"
              className="flex h-11 items-center rounded-md px-3 text-[15px] font-semibold text-overdue outline-none hover:bg-bg focus-visible:ring-2 focus-visible:ring-primary"
              onClick={handleMenuItemClick}
            >
              {translate(language, "dashboard.signOut")}
            </Link>
          </div>
        </>
      ) : null}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
