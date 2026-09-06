export type NavItem = {
  href: string;
  labelKey: "nav.home" | "nav.deals" | "nav.invoices" | "nav.settings";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", labelKey: "nav.home" },
  { href: "/deal", labelKey: "nav.deals" },
  { href: "/invoice", labelKey: "nav.invoices" },
  { href: "/pengaturan", labelKey: "nav.settings" },
];

// A nested detail route (e.g. /deal/abc123) belongs to its parent nav item.
// Home only matches the exact root, since every other route is a prefix of it.
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
