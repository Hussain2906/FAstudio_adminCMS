import Link from 'next/link';
import { ArrowRight, Globe2 } from 'lucide-react';
import { adminRoutes } from '../../config/routes';

export default function DashboardPage() {
  return <section className="space-y-8"><header className="space-y-2"><p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">Dashboard</p><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good morning</h1><p className="text-muted-foreground">Manage the content that powers your website.</p></header><Link className="group flex max-w-xl items-center justify-between rounded-lg border border-border bg-card p-6 shadow-sm transition-colors hover:bg-muted" href={adminRoutes.websiteHome}><span className="flex items-center gap-4"><span className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground"><Globe2 aria-hidden="true" className="size-5" /></span><span><span className="block font-medium">Website CMS</span><span className="text-sm text-muted-foreground">Manage home page sections</span></span></span><ArrowRight aria-hidden="true" className="size-5 text-muted-foreground transition-transform group-hover:translate-x-1" /></Link></section>;
}
