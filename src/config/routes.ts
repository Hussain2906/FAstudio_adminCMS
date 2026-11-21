import { PORTFOLIO_PROJECT_TYPE, type CmsPageKey } from "@fs/cms-contracts";

export const adminRoutes = {
  dashboard: "/",
  login: "/login",
  websiteHome: "/website/home",
  websiteHomeSections: "/website/home/sections",
  portfolioProjects: "/website/portfolio/projects",
  siteBranding: "/website/branding",
  footer: "/website/footer",
  contactDelivery: "/settings/contact-delivery",
} as const;

export const websitePages = [
  { id: "home", label: "Home", href: "/website/home", icon: "home" },
  { id: "about", label: "About", href: "/website/about", icon: "user-round" },
  { id: "services", label: "Services", href: "/website/services", icon: "briefcase-business" },
  { id: "portfolio", label: "Portfolio", href: "/website/portfolio", icon: "images" },
  { id: "process", label: "The Process", href: "/website/process", icon: "workflow" },
  { id: "contact", label: "Contact", href: "/website/contact", icon: "mail" },
] as const satisfies readonly {
  id: CmsPageKey;
  label: string;
  href: `/website/${CmsPageKey}`;
  icon: string;
}[];

export type WebsitePage = (typeof websitePages)[number];

export function getWebsitePage(pageId: string): WebsitePage | undefined {
  return websitePages.find((page) => page.id === pageId);
}

export function getWebsiteSectionRoute(pageId: CmsPageKey, sectionId: string): string {
  if (pageId === "portfolio" && sectionId === PORTFOLIO_PROJECT_TYPE) {
    return adminRoutes.portfolioProjects;
  }
  return `/website/${pageId}/sections/${encodeURIComponent(sectionId)}`;
}

export const adminNavigation = [
  { label: "Dashboard", href: adminRoutes.dashboard, icon: "layout-dashboard" as const },
] as const;
