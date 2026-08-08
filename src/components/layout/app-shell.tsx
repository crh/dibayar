"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { TopBar } from "./top-bar";
import { SideNav } from "./side-nav";
import { BottomNav } from "./bottom-nav";
import { FloatingActionButton } from "./floating-action-button";

export function AppShell({ children, email }: { children: ReactNode; email?: string | null }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar pathname={pathname} email={email} />
      <div className="flex flex-1">
        <SideNav pathname={pathname} />
        <div className="min-w-0 flex-1 pb-[calc(56px+env(safe-area-inset-bottom))] min-[640px]:pb-0">{children}</div>
      </div>
      <BottomNav pathname={pathname} />
      <FloatingActionButton />
    </div>
  );
}
