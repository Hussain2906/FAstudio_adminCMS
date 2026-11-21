import { notFound, redirect } from "next/navigation";
import {
  PORTFOLIO_CATALOGUE_TYPE,
  PORTFOLIO_HERO_TYPE,
  PORTFOLIO_PROJECT_TYPE,
  PROCESS_STEPS_TYPE,
  CONTACT_PAGE_TYPE,
  SERVICES_CATALOGUE_TYPE,
  SERVICES_HERO_TYPE,
  sectionRegistry,
} from "@fs/cms-contracts";
import { adminRoutes, getWebsitePage } from "../../../../../../config/routes";
import { HeroEditor } from "../../../../../../components/admin/hero-editor";
import { HomeExperienceEditor } from "../../../../../../components/admin/home-experience-editor";
import { HomeSelectedProjectsEditor } from "../../../../../../components/admin/home-selected-projects-editor";
import { HomeRoomAssemblyEditor } from "../../../../../../components/admin/home-room-assembly-editor";
import { HomeDesignConsultationEditor } from "../../../../../../components/admin/home-design-consultation-editor";
import { AboutSectionEditor } from "../../../../../../components/admin/about-section-editor";
import {
  ServicesCatalogueEditor,
  ServicesHeroEditor,
} from "../../../../../../components/admin/services-section-editors";
import {
  PortfolioCatalogueEditor,
  PortfolioHeroEditor,
} from "../../../../../../components/admin/portfolio-editors";
import { ProcessStepsEditor } from "../../../../../../components/admin/process-steps-editor";
import { ContactPageEditor } from "../../../../../../components/admin/contact-page-editor";

export default async function CmsSectionPage({
  params,
}: {
  params: Promise<{ pageSlug: string; sectionId: string }>;
}) {
  const { pageSlug, sectionId } = await params;
  const decodedSectionId = decodeURIComponent(sectionId);
  if (pageSlug === "portfolio" && decodedSectionId === PORTFOLIO_PROJECT_TYPE) {
    redirect(adminRoutes.portfolioProjects);
  }
  const page = getWebsitePage(pageSlug);
  const section = sectionRegistry.find(
    (entry) => entry.page === page?.id && entry.type === decodedSectionId,
  );
  if (!page || !section) notFound();
  if (section.type === "home.hero") return <HeroEditor />;
  if (section.type === "home.experience") return <HomeExperienceEditor />;
  if (section.type === "home.selected-projects") return <HomeSelectedProjectsEditor />;
  if (section.type === "home.room-assembly") return <HomeRoomAssemblyEditor />;
  if (section.type === "home.design-consultation") return <HomeDesignConsultationEditor />;
  if (section.type === SERVICES_HERO_TYPE) return <ServicesHeroEditor />;
  if (section.type === SERVICES_CATALOGUE_TYPE) return <ServicesCatalogueEditor />;
  if (section.type === PORTFOLIO_HERO_TYPE) return <PortfolioHeroEditor />;
  if (section.type === PORTFOLIO_CATALOGUE_TYPE) return <PortfolioCatalogueEditor />;
  if (section.type === PROCESS_STEPS_TYPE) return <ProcessStepsEditor />;
  if (section.type === CONTACT_PAGE_TYPE) return <ContactPageEditor />;
  if (section.page === "about")
    return (
      <AboutSectionEditor type={section.type as import("@fs/cms-contracts").AboutSectionType} />
    );
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / {page.label} / {section.displayName}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{section.displayName}</h1>
        <p className="text-muted-foreground">This registered section is ready for its editor.</p>
      </header>
      <div className="rounded-lg border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        The section editor will be enabled when its content workflow is implemented.
      </div>
    </section>
  );
}
