import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PORTFOLIO_PROJECT_TYPE, type CmsPageKey } from "@fs/cms-contracts";
import { adminRoutes, getWebsiteSectionRoute } from "../../config/routes";
import { getRegisteredCmsSections } from "../../features/cms/registry";

export function CmsPageOverview({ pageId, label }: { pageId: CmsPageKey; label: string }) {
  const sections = getRegisteredCmsSections().filter(
    (section) =>
      section.page === pageId &&
      !(pageId === "portfolio" && section.type === PORTFOLIO_PROJECT_TYPE),
  );
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / {label}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{label}</h1>
        <p className="text-muted-foreground">
          Manage registered content sections for the {label.toLowerCase()} page.
        </p>
        {pageId === "portfolio" ? (
          <Link
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            href={adminRoutes.portfolioProjects}
          >
            Manage individual projects
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : null}
      </header>
      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-medium">Registered sections</h2>
          <span className="text-sm text-muted-foreground">{sections.length} registered</span>
        </div>
        {sections.length === 0 ? (
          <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
            No sections are registered for this page yet.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sections.map((section) => (
              <li className="flex items-center justify-between gap-4 py-4" key={section.type}>
                <div>
                  <h3 className="font-medium">{section.displayName}</h3>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
                <Link
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                  href={getWebsiteSectionRoute(pageId, section.type)}
                >
                  Open editor
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
