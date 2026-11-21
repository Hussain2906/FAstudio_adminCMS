import { notFound } from 'next/navigation';
import { CmsPageOverview } from '../../../../components/admin/cms-page-overview';
import { getWebsitePage } from '../../../../config/routes';

export default async function WebsiteCmsPage({ params }: { params: Promise<{ pageSlug: string }> }) {
  const { pageSlug } = await params;
  const page = getWebsitePage(pageSlug);
  if (!page) notFound();
  return <CmsPageOverview label={page.label} pageId={page.id} />;
}
