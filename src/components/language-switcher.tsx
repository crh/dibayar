"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { getLanguage, translate, type Language } from "@/lib/i18n";

const STORAGE_KEY = "dibayar-language";
const COOKIE_KEY = "dibayar-language";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function writeLanguageCookie(language: Language) {
  document.cookie = `${COOKIE_KEY}=${language}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
}

// A per-provider store whose current value starts at (and, for the server
// snapshot, always stays at) initialLanguage. Deliberately does not read
// localStorage on creation: useSyncExternalStore reconciles its
// getServerSnapshot/getSnapshot values right after hydration, so if the
// initial snapshot came from a stale localStorage read, that stale value
// would silently replace the cookie-authoritative render the server just
// produced. Only genuine post-mount events (an explicit setLanguage call,
// or a "storage" event from another tab) update `current` after that.
type LanguageStore = {
  subscribe: (onStoreChange: () => void) => () => void;
  getSnapshot: () => Language;
  getServerSnapshot: () => Language;
  set: (next: Language) => void;
};

function createLanguageStore(initialLanguage: Language): LanguageStore {
  let current = initialLanguage;
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach((listener) => listener());
  }

  function onStorageEvent(event: StorageEvent) {
    if (event.key !== STORAGE_KEY) return;
    if (event.newValue !== "id" && event.newValue !== "en") return;
    if (event.newValue === current) return;
    current = event.newValue;
    notify();
  }

  return {
    subscribe(onStoreChange) {
      listeners.add(onStoreChange);
      window.addEventListener("storage", onStorageEvent);
      return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener("storage", onStorageEvent);
      };
    },
    getSnapshot: () => current,
    getServerSnapshot: () => initialLanguage,
    set(next) {
      if (current === next) return;
      current = next;
      notify();
    },
  };
}

type LanguageContextValue = {
  store: LanguageStore | null;
  authenticated: boolean;
};

const LanguageContext = createContext<LanguageContextValue>({ store: null, authenticated: false });

// Used only when useLanguage() is called with no wrapping LanguageProvider
// (isolated component tests). There is no server-authoritative initialLanguage
// to protect here, so it simply reflects whatever is in localStorage.
const fallbackStore: LanguageStore = {
  subscribe(onStoreChange) {
    window.addEventListener("storage", onStoreChange);
    return () => window.removeEventListener("storage", onStoreChange);
  },
  getSnapshot: () => getLanguage(window.localStorage.getItem(STORAGE_KEY)),
  getServerSnapshot: () => "en",
  set(next) {
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY, newValue: next }));
  },
};

// initialLanguage is the server/DB-authoritative value for this subtree: the
// cookie-derived language pre-login, or the signed-in user's stored
// preference once authenticated. When authenticated, that value overwrites
// any stale cookie/localStorage on mount, which is what makes an existing
// user's language reset actually reach a device with an old cached value.
export function LanguageProvider({ initialLanguage, authenticated = false, children }: {
  initialLanguage: Language;
  authenticated?: boolean;
  children: ReactNode;
}) {
  const [store] = useState(() => createLanguageStore(initialLanguage));

  useEffect(() => {
    if (!authenticated) return;
    window.localStorage.setItem(STORAGE_KEY, initialLanguage);
    writeLanguageCookie(initialLanguage);
    document.documentElement.lang = initialLanguage;
    store.set(initialLanguage);
  }, [authenticated, initialLanguage, store]);

  return <LanguageContext.Provider value={{ store, authenticated }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  const store = context.store ?? fallbackStore;
  const language = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);

  const setLanguage = (next: Language) => {
    const languageValue = getLanguage(next);
    window.localStorage.setItem(STORAGE_KEY, languageValue);
    writeLanguageCookie(languageValue);
    document.documentElement.lang = languageValue;
    store.set(languageValue);

    if (context.authenticated) {
      fetch("/api/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: languageValue }),
      }).catch(() => undefined);
    }
  };

  const t = (key: string, values?: Record<string, string>) => translate(language, key, values);
  return { language, setLanguage, t };
}
