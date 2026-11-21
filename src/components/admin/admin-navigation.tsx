'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BriefcaseBusiness,
  ChevronDown,
  Globe2,
  Images,
  Layers3,
  PanelBottom,
  LayoutDashboard,
  Mail,
  NotebookPen,
  Sparkles,
  UserRound,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { sectionRegistry } from '@fs/cms-contracts';
import { adminNavigation, adminRoutes, getWebsiteSectionRoute, websitePages } from '../../config/routes';

const icons: Record<string, LucideIcon> = {
  'briefcase-business': BriefcaseBusiness,
  globe: Globe2,
  images: Images,
  layers: Layers3,
  'layout-dashboard': LayoutDashboard,
  'panel-bottom': PanelBottom,
  mail: Mail,
  'notebook-pen': NotebookPen,
  sparkles: Sparkles,
  'user-round': UserRound,
  workflow: Workflow,
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function itemClass(active: boolean, depth: 0 | 1 | 2) {
  const indentation = depth === 0 ? '' : depth === 1 ? 'ml-3' : 'ml-6';
  const state = active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground';
  return `flex min-h-9 items-center gap-2 rounded-md px-2 py-2 text-sm ${indentation} ${state}`;
}

function SectionLink({ pageId, section }: { pageId: (typeof websitePages)[number]['id']; section: (typeof sectionRegistry)[number] }) {
  const pathname = usePathname();
  const href = getWebsiteSectionRoute(pageId, section.type);
  const Icon = icons[section.icon] ?? Layers3;
  return <Link aria-current={pathname === href ? 'page' : undefined} className={itemClass(pathname === href, 2)} href={href}><Icon aria-hidden="true" className="size-3.5 shrink-0" /><span className="truncate">{section.displayName}</span></Link>;
}

function PageNavigation({ page }: { page: (typeof websitePages)[number] }) {
  const pathname = usePathname();
  const pageSections = sectionRegistry.filter((section) => section.page === page.id);
  const active = isActive(pathname, page.href);
  const [expanded, setExpanded] = useState(active);

  return <div className="space-y-0.5"><div className="flex items-center gap-1"><Link aria-current={pathname === page.href ? 'page' : undefined} className={`${itemClass(active, 1)} min-w-0 flex-1`} href={page.href}><span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" /><span className="truncate">{page.label}</span></Link>{pageSections.length ? <button aria-controls={`cms-page-${page.id}`} aria-expanded={expanded} aria-label={`${expanded ? 'Collapse' : 'Expand'} ${page.label} sections`} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setExpanded((value) => !value)} type="button"><ChevronDown aria-hidden="true" className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} /></button> : null}</div>{expanded && pageSections.length ? <div className="space-y-0.5 border-l border-border/80 pl-2" id={`cms-page-${page.id}`}>{pageSections.map((section) => <SectionLink key={`${page.id}:${section.type}`} pageId={page.id} section={section} />)}</div> : null}</div>;
}

export function AdminNavigation() {
  const pathname = usePathname();
  const websiteActive = pathname.startsWith('/website') || isActive(pathname, adminRoutes.contactDelivery);
  const [websiteExpanded, setWebsiteExpanded] = useState(websiteActive);

  return <div className="space-y-1">{adminNavigation.map((item) => { const Icon = icons[item.icon] ?? LayoutDashboard; const active = isActive(pathname, item.href); return <Link aria-current={active ? 'page' : undefined} className={itemClass(active, 0)} href={item.href} key={item.href}><Icon aria-hidden="true" className="size-4 shrink-0" /><span>{item.label}</span></Link>; })}<div className="space-y-1"><button aria-controls="website-cms-navigation" aria-expanded={websiteExpanded} className={`${itemClass(websiteActive, 0)} w-full justify-between focus-visible:ring-2 focus-visible:ring-ring`} onClick={() => setWebsiteExpanded((value) => !value)} type="button"><span className="flex items-center gap-2"><Globe2 aria-hidden="true" className="size-4 shrink-0" /><span>Website CMS</span></span><ChevronDown aria-hidden="true" className={`size-4 transition-transform ${websiteExpanded ? 'rotate-180' : ''}`} /></button>{websiteExpanded ? <div className="space-y-1" id="website-cms-navigation"><Link aria-current={pathname === adminRoutes.siteBranding ? 'page' : undefined} className={itemClass(pathname === adminRoutes.siteBranding, 1)} href={adminRoutes.siteBranding}><span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" /><span>Site Branding</span></Link><Link aria-current={pathname === adminRoutes.footer ? 'page' : undefined} className={itemClass(pathname === adminRoutes.footer, 1)} href={adminRoutes.footer}><span className="size-1.5 shrink-0 rounded-full bg-current opacity-60" /><span>Footer Management</span></Link><Link aria-current={isActive(pathname, adminRoutes.contactDelivery) ? 'page' : undefined} className={itemClass(isActive(pathname, adminRoutes.contactDelivery), 1)} href={adminRoutes.contactDelivery}><Mail aria-hidden="true" className="size-3.5 shrink-0" /><span>Contact delivery</span></Link>{websitePages.map((page) => <PageNavigation key={`${page.id}:${pathname}`} page={page} />)}</div> : null}</div></div>;
}
