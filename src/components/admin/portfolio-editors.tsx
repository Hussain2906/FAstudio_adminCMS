"use client";

import {
  PORTFOLIO_CATALOGUE_TYPE,
  PORTFOLIO_HERO_TYPE,
  PORTFOLIO_PROJECT_TYPE,
  isPortfolioCatalogueContent,
  isPortfolioCatalogueDraftContent,
  isPortfolioHeroContent,
  isPortfolioHeroDraftContent,
  isPortfolioVideo,
  isPortfolioProjectContent,
  isPortfolioProjectDraftContent,
  portfolioCatalogueDefaultContent,
  portfolioHeroDefaultContent,
  portfolioProjectDefaultContent,
  type CmsImage,
  type PortfolioCatalogueContent,
  type PortfolioHeroContent,
  type PortfolioProjectContent,
} from "@fs/cms-contracts";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  FormError,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
  SwitchField,
  TextareaField,
  TextField,
  VideoUploadField,
  fieldErrorMessage,
  useFormFieldErrors,
} from "./form-controls";
import {
  formFieldId,
  validateFormFields,
  type FormFieldRule,
} from "../../features/cms/form-validation";

type CmsSection = {
  id: string;
  type: string;
  draftContent: unknown;
  publishedContent: unknown | null;
  draftIsVisible: boolean;
  publishedIsVisible: boolean;
  draftOrder: number;
  publishedOrder: number | null;
};
type CmsPage = { id: string; sections: CmsSection[] };
type Status = { error: string; message: string; saving: boolean };
const emptyStatus: Status = { error: "", message: "", saving: false };
const asset = (image?: CmsImage | null) => (image ? { ...image } : undefined);
const media = (image?: CmsImage): CmsImage | null => (image ? { ...image } : null);

function isUploadedPortfolioImage(value: unknown): value is CmsImage {
  if (!value || typeof value !== "object") return false;
  const image = value as CmsImage;
  if (
    typeof image.publicId !== "string" ||
    !image.publicId.trim() ||
    typeof image.url !== "string" ||
    !image.url ||
    typeof image.width !== "number" ||
    !Number.isFinite(image.width) ||
    image.width <= 0 ||
    typeof image.height !== "number" ||
    !Number.isFinite(image.height) ||
    image.height <= 0
  )
    return false;
  try {
    const url = new URL(image.url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function portfolioSingletonRules(type: string, value: unknown, publish: boolean): FormFieldRule[] {
  const formId = type === PORTFOLIO_HERO_TYPE ? "portfolio-hero" : "portfolio-catalogue";
  const content = value as Record<string, unknown>;
  if (type === PORTFOLIO_HERO_TYPE) {
    const rules: FormFieldRule[] = [
      {
        id: formFieldId(formId, "eyebrow"),
        label: "Eyebrow",
        value: content.eyebrow,
        required: publish,
        maxLength: 100,
      },
      {
        id: formFieldId(formId, "heading"),
        label: "Heading",
        value: content.heading,
        required: publish,
        maxLength: 160,
      },
      {
        id: formFieldId(formId, "description"),
        label: "Description",
        value: content.description,
        required: publish,
        maxLength: 2000,
      },
    ];
    if (content.image) {
      const image = content.image as CmsImage;
      rules.push(
        {
          id: formFieldId(formId, "image"),
          label: "Hero still image",
          value: image,
          validate: isUploadedPortfolioImage,
          invalidMessage: "Choose a valid uploaded Cloudinary image.",
        },
        {
          id: formFieldId(formId, "image-alt"),
          label: "Hero image alt text",
          value: image.alt,
          required: true,
          requiredMessage: "Describe the image for visitors using assistive technology.",
          validate: (value) => typeof value === "string",
          invalidMessage: "Enter the image description as text.",
        },
      );
    }
    if (content.video) {
      rules.push({
        id: formFieldId(formId, "video"),
        label: "Hero background video",
        value: content.video,
        validate: isPortfolioVideo,
        invalidMessage: "Choose a valid uploaded Cloudinary MP4 video.",
      });
    }
    return rules;
  }
  return [
    {
      id: formFieldId(formId, "heading"),
      label: "Heading",
      value: content.heading,
      required: publish,
      maxLength: 160,
    },
    {
      id: formFieldId(formId, "emptyStateHeading"),
      label: "Empty-state heading",
      value: content.emptyStateHeading,
      required: publish,
      maxLength: 160,
    },
    {
      id: formFieldId(formId, "emptyStateDescription"),
      label: "Empty-state description",
      value: content.emptyStateDescription,
      required: publish,
      maxLength: 1000,
    },
    {
      id: formFieldId(formId, "eyebrow"),
      label: "Eyebrow",
      value: content.eyebrow,
      maxLength: 100,
    },
    {
      id: formFieldId(formId, "description"),
      label: "Description",
      value: content.description,
      maxLength: 2000,
    },
  ];
}

function portfolioProjectRules(
  content: PortfolioProjectContent,
  publish: boolean,
): FormFieldRule[] {
  const formId = "portfolio-project";
  const field = (name: string) => formFieldId(formId, name);
  const imageRules = (name: string, label: string, image: CmsImage | null, required: boolean) => {
    const rules: FormFieldRule[] = [
      {
        id: field(name),
        label,
        value: image,
        required,
        requiredMessage: `Choose ${label.toLowerCase()}.`,
        validate: (value) => value === null || isUploadedPortfolioImage(value),
        invalidMessage: "Choose a valid uploaded Cloudinary image.",
      },
    ];
    if (image) {
      rules.push({
        id: field(`${name}-alt`),
        label: `${label} alt text`,
        value: image.alt,
        required: true,
        requiredMessage: "Describe the image for visitors using assistive technology.",
        validate: (value) => typeof value === "string",
        invalidMessage: "Enter the image description as text.",
      });
    }
    return rules;
  };
  const rules: FormFieldRule[] = [
    {
      id: field("title"),
      label: "Project title",
      value: content.title,
      required: publish,
      requiredMessage: "Enter a project title.",
      maxLength: 160,
    },
    {
      id: field("slug"),
      label: "Slug",
      value: content.slug,
      required: publish,
      maxLength: 100,
      requiredMessage: "Enter a URL slug.",
      ...(publish
        ? {
            validate: (value: unknown) =>
              typeof value === "string" &&
              /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) &&
              !value.startsWith("home-"),
            invalidMessage:
              "Use lowercase letters, numbers, and single hyphens; the home- prefix is reserved.",
          }
        : {}),
    },
    {
      id: field("category"),
      label: "Category",
      value: content.category,
      required: publish,
      requiredMessage: "Enter a category.",
      maxLength: 100,
    },
    {
      id: field("shortDescription"),
      label: "Short description",
      value: content.shortDescription,
      required: publish,
      requiredMessage: "Enter a short description.",
      maxLength: 500,
    },
    { id: field("location"), label: "Location", value: content.location, maxLength: 160 },
    {
      id: field("completionYear"),
      label: "Completion year",
      value: content.completionYear,
      validate: (value) =>
        value === null ||
        (typeof value === "number" && Number.isInteger(value) && value >= 1900 && value <= 2200),
      invalidMessage: "Enter a whole year from 1900 to 2200, or leave it blank.",
    },
    { id: field("overview"), label: "Overview", value: content.overview, maxLength: 5000 },
    { id: field("story"), label: "Story", value: content.story, maxLength: 20000 },
    {
      id: field("contentSections"),
      label: "Content sections",
      value: content.contentSections,
      validate: (value) =>
        Array.isArray(value) &&
        value.length <= 30 &&
        new Set(value.map((part) => part.id)).size === value.length,
      invalidMessage:
        "Use no more than 30 sections. Remove and re-add any section with a duplicate internal identifier.",
    },
  ];
  rules.push(...imageRules("coverImage", "Cover image", content.coverImage, publish));
  rules.push({
    id: field("gallery"),
    label: "Gallery images",
    value: content.gallery,
    ...(publish
      ? { minItems: 1, minItemsMessage: "Add at least one distinct project photo to the gallery." }
      : {}),
    validate: (value) =>
      Array.isArray(value) &&
      value.length <= 50 &&
      (!publish ||
        new Set([
          ...(content.coverImage ? [content.coverImage.publicId] : []),
          ...value.map((image) => image.publicId),
        ]).size ===
          value.length + (content.coverImage ? 1 : 0)),
    invalidMessage: "Use up to 50 unique gallery images, distinct from the cover photo.",
  });
  content.gallery.forEach((image, index) =>
    rules.push(...imageRules(`gallery-${index}-image`, `Gallery image ${index + 1}`, image, false)),
  );
  content.contentSections.forEach((part, index) => {
    const partName = `section-${index}`;
    rules.push(
      {
        id: field(`${partName}-heading`),
        label: `Section ${index + 1} heading`,
        value: part.heading,
        required: publish,
        maxLength: 160,
        requiredMessage: `Enter a heading for section ${index + 1}.`,
      },
      {
        id: field(`${partName}-body`),
        label: `Section ${index + 1} body`,
        value: part.body,
        maxLength: 10000,
        ...(publish && !part.image
          ? {
              required: true,
              requiredMessage: `Add body copy or an image for section ${index + 1}.`,
            }
          : {}),
      },
    );
    rules.push(...imageRules(`${partName}-image`, `Section ${index + 1} image`, part.image, false));
  });
  return rules;
}

function StatusMessage({
  error,
  message,
  saving = false,
}: {
  error: string;
  message: string;
  saving?: boolean;
}) {
  return (
    <>
      {saving ? (
        <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
          Saving Portfolio changes…
        </p>
      ) : null}
      {error ? (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {message ? (
        <p aria-live="polite" className="rounded-lg bg-success/10 p-3 text-sm text-success">
          {message}
        </p>
      ) : null}
    </>
  );
}

function usePortfolioSingleton(type: string, validateDraft: (value: unknown) => boolean) {
  const [section, setSection] = useState<CmsSection>();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(emptyStatus);
  const validation = useFormFieldErrors();
  const reload = useCallback(async () => {
    try {
      const page = await apiClient.get<CmsPage>("cms/admin/pages/portfolio");
      setSection(page.sections.find((entry) => entry.type === type));
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to load the Portfolio draft.",
      });
    } finally {
      setLoading(false);
    }
  }, [type]);
  useEffect(() => {
    void Promise.resolve().then(reload);
  }, [reload]);
  async function persist(content: unknown, visible: boolean, publish: boolean) {
    const validForPublish =
      type === PORTFOLIO_HERO_TYPE
        ? isPortfolioHeroContent(content)
        : isPortfolioCatalogueContent(content);
    if (!section || !validateDraft(content) || (publish && !validForPublish)) {
      const errors = validateFormFields(portfolioSingletonRules(type, content, publish));
      validation.report(
        errors.length
          ? errors
          : [
              {
                id: formFieldId(type.replaceAll(".", "-"), "heading"),
                label: type === PORTFOLIO_HERO_TYPE ? "Portfolio Hero" : "Project catalogue",
                message: "Review the content and correct any values outside the allowed format.",
              },
            ],
      );
      setStatus(emptyStatus);
      return;
    }
    validation.clear();
    setStatus({ ...emptyStatus, saving: true });
    try {
      const updated = await apiClient.patch<CmsSection>(`cms/admin/sections/${section.id}`, {
        content,
        isVisible: visible,
      });
      setSection(updated);
      if (publish)
        setSection(await apiClient.post<CmsSection>(`cms/admin/sections/${section.id}/publish`));
      setStatus({
        ...emptyStatus,
        message: publish
          ? "Draft saved and published."
          : "Draft saved. The Storefront remains unchanged until publishing.",
      });
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to save this Portfolio section.",
      });
    }
  }
  return { section, loading, status, persist, validation };
}

export function PortfolioHeroEditor() {
  const editor = usePortfolioSingleton(PORTFOLIO_HERO_TYPE, isPortfolioHeroDraftContent);
  const [content, setContent] = useState<PortfolioHeroContent>(portfolioHeroDefaultContent);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (editor.section && isPortfolioHeroDraftContent(editor.section.draftContent))
      void Promise.resolve().then(() => {
        setContent(editor.section!.draftContent as PortfolioHeroContent);
        setVisible(editor.section!.draftIsVisible);
      });
  }, [editor.section]);
  if (editor.loading)
    return <p className="text-sm text-muted-foreground">Loading Portfolio Hero…</p>;
  if (!editor.section)
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
        The Portfolio Hero section is not seeded yet.
      </p>
    );
  const update = <K extends keyof PortfolioHeroContent>(key: K, value: PortfolioHeroContent[K]) =>
    setContent((current) => ({ ...current, [key]: value }));
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Portfolio / Hero
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Portfolio Hero</h1>
        <p className="mt-2 text-muted-foreground">
          Edit the introduction to the project portfolio.
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          The public page uses the published Portfolio media. An MP4 takes priority over the still
          image; draft changes stay private until you publish them.
        </p>
      </header>
      <FormErrorSummary errors={editor.validation.errors} focusKey={editor.validation.focusKey} />
      <StatusMessage {...editor.status} />
      <FormSection title="Hero content">
        <TextField
          id={formFieldId("portfolio-hero", "eyebrow")}
          label="Eyebrow"
          description="Required when publishing."
          maxLength={100}
          required
          value={content.eyebrow}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-hero", "eyebrow"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-hero", "eyebrow"));
            update("eyebrow", e.target.value);
          }}
        />
        <TextField
          id={formFieldId("portfolio-hero", "heading")}
          label="Heading"
          description="Required when publishing."
          maxLength={160}
          required
          value={content.heading}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-hero", "heading"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-hero", "heading"));
            update("heading", e.target.value);
          }}
        />
        <TextareaField
          id={formFieldId("portfolio-hero", "description")}
          label="Description"
          description="Required when publishing."
          maxLength={2000}
          required
          value={content.description}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-hero", "description"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-hero", "description"));
            update("description", e.target.value);
          }}
        />
        <ImageUploadField
          allowLibrary
          id={formFieldId("portfolio-hero", "image")}
          label="Hero still image"
          description="Used as the background when no video is selected · JPEG, PNG, WebP, or AVIF · Maximum 10 MB"
          value={asset(content.image)}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-hero", "image"),
          )}
          onChange={(image) => {
            editor.validation.clear(formFieldId("portfolio-hero", "image"));
            if (!image) editor.validation.clear(formFieldId("portfolio-hero", "image-alt"));
            update("image", media(image));
          }}
        />
        <VideoUploadField
          id={formFieldId("portfolio-hero", "video")}
          label="Hero background video"
          description="MP4 only · Maximum 10 MB · The published video takes priority over the still image."
          value={content.video ?? undefined}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-hero", "video"),
          )}
          onChange={(video) => {
            editor.validation.clear(formFieldId("portfolio-hero", "video"));
            update("video", video ?? null);
          }}
        />
        {content.image ? (
          <TextField
            id={formFieldId("portfolio-hero", "image-alt")}
            label="Hero image alt text"
            description="Describe the image for visitors using assistive technology."
            required
            value={content.image.alt}
            error={fieldErrorMessage(
              editor.validation.errors,
              formFieldId("portfolio-hero", "image-alt"),
            )}
            onChange={(e) => {
              editor.validation.clear(formFieldId("portfolio-hero", "image-alt"));
              update("image", { ...content.image!, alt: e.target.value });
            }}
          />
        ) : null}
        <SwitchField label="Show Portfolio Hero" checked={visible} onChange={setVisible} />
      </FormSection>
      <div className="flex flex-wrap gap-3">
        <ActionButton
          loading={editor.status.saving}
          variant="outline"
          onClick={() => void editor.persist(content, visible, false)}
        >
          Save draft
        </ActionButton>
        <ActionButton
          loading={editor.status.saving}
          onClick={() => void editor.persist(content, visible, true)}
        >
          Save and publish
        </ActionButton>
      </div>
    </section>
  );
}

export function PortfolioCatalogueEditor() {
  const editor = usePortfolioSingleton(PORTFOLIO_CATALOGUE_TYPE, isPortfolioCatalogueDraftContent);
  const [content, setContent] = useState<PortfolioCatalogueContent>(
    portfolioCatalogueDefaultContent,
  );
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (editor.section && isPortfolioCatalogueDraftContent(editor.section.draftContent))
      void Promise.resolve().then(() => {
        setContent(editor.section!.draftContent as PortfolioCatalogueContent);
        setVisible(editor.section!.draftIsVisible);
      });
  }, [editor.section]);
  if (editor.loading)
    return <p className="text-sm text-muted-foreground">Loading project catalogue…</p>;
  if (!editor.section)
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
        The Portfolio Catalogue section is not seeded yet.
      </p>
    );
  const update = <K extends keyof PortfolioCatalogueContent>(
    key: K,
    value: PortfolioCatalogueContent[K],
  ) => setContent((current) => ({ ...current, [key]: value }));
  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Portfolio / Catalogue
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Project Catalogue</h1>
        <p className="mt-2 text-muted-foreground">Manage catalogue copy and section visibility.</p>
      </header>
      <FormErrorSummary errors={editor.validation.errors} focusKey={editor.validation.focusKey} />
      <StatusMessage {...editor.status} />
      <FormSection title="Catalogue content">
        <TextField
          id={formFieldId("portfolio-catalogue", "eyebrow")}
          label="Eyebrow"
          maxLength={100}
          value={content.eyebrow}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-catalogue", "eyebrow"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-catalogue", "eyebrow"));
            update("eyebrow", e.target.value);
          }}
        />
        <TextField
          id={formFieldId("portfolio-catalogue", "heading")}
          label="Heading"
          description="Required when publishing."
          maxLength={160}
          required
          value={content.heading}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-catalogue", "heading"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-catalogue", "heading"));
            update("heading", e.target.value);
          }}
        />
        <TextareaField
          id={formFieldId("portfolio-catalogue", "description")}
          label="Description"
          maxLength={2000}
          value={content.description}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-catalogue", "description"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-catalogue", "description"));
            update("description", e.target.value);
          }}
        />
      </FormSection>
      <FormSection title="Empty state">
        <TextField
          id={formFieldId("portfolio-catalogue", "emptyStateHeading")}
          label="Heading"
          description="Required when publishing."
          maxLength={160}
          required
          value={content.emptyStateHeading}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-catalogue", "emptyStateHeading"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-catalogue", "emptyStateHeading"));
            update("emptyStateHeading", e.target.value);
          }}
        />
        <TextareaField
          id={formFieldId("portfolio-catalogue", "emptyStateDescription")}
          label="Description"
          description="Required when publishing."
          maxLength={1000}
          required
          value={content.emptyStateDescription}
          error={fieldErrorMessage(
            editor.validation.errors,
            formFieldId("portfolio-catalogue", "emptyStateDescription"),
          )}
          onChange={(e) => {
            editor.validation.clear(formFieldId("portfolio-catalogue", "emptyStateDescription"));
            update("emptyStateDescription", e.target.value);
          }}
        />
        <SwitchField label="Show project catalogue" checked={visible} onChange={setVisible} />
      </FormSection>
      <div className="flex flex-wrap gap-3">
        <ActionButton
          loading={editor.status.saving}
          variant="outline"
          onClick={() => void editor.persist(content, visible, false)}
        >
          Save draft
        </ActionButton>
        <ActionButton
          loading={editor.status.saving}
          onClick={() => void editor.persist(content, visible, true)}
        >
          Save and publish
        </ActionButton>
      </div>
    </section>
  );
}

function createBlankProject(): PortfolioProjectContent {
  return {
    ...portfolioProjectDefaultContent,
    slug: "",
    title: "",
    category: "",
    shortDescription: "",
    overview: "",
    location: "",
    completionYear: null,
    coverImage: null,
    gallery: [],
    story: "",
    contentSections: [],
  };
}

export function PortfolioProjectsEditor() {
  const [page, setPage] = useState<CmsPage>();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(emptyStatus);
  const [selectedId, setSelectedId] = useState<string>();
  const refresh = useCallback(async () => {
    try {
      const result = await apiClient.get<CmsPage>("cms/admin/pages/portfolio");
      setPage(result);
      setSelectedId((id) =>
        id && result.sections.some((section) => section.id === id) ? id : undefined,
      );
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to load projects.",
      });
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(refresh);
  }, [refresh]);
  const projects = useMemo(
    () =>
      (page?.sections ?? [])
        .filter((entry) => entry.type === PORTFOLIO_PROJECT_TYPE)
        .sort((a, b) => a.draftOrder - b.draftOrder),
    [page],
  );
  async function addProject() {
    if (!page) return;
    setStatus({ ...emptyStatus, saving: true });
    try {
      const created = await apiClient.post<CmsSection>(`cms/admin/pages/${page.id}/sections`, {
        type: PORTFOLIO_PROJECT_TYPE,
        content: createBlankProject(),
        order: Math.max(-1, ...page.sections.map((section) => section.draftOrder)) + 1,
      });
      await refresh();
      setSelectedId(created.id);
      setStatus({
        ...emptyStatus,
        message: "Project draft created. Complete its fields before publishing.",
      });
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to create project draft.",
      });
    }
  }
  async function reorder(section: CmsSection, delta: number, published: boolean) {
    if (!page) return;
    const index = projects.findIndex((item) => item.id === section.id),
      target = index + delta;
    if (target < 0 || target >= projects.length) return;
    const ordered = [...projects];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setStatus({ ...emptyStatus, saving: true });
    try {
      const path = published
        ? `cms/admin/pages/${page.id}/sections/publish-order`
        : `cms/admin/pages/${page.id}/sections/order`;
      const sectionIds = published
        ? ordered.filter((item) => item.publishedContent !== null).map((item) => item.id)
        : (() => {
            const all = [...page.sections].sort((a, b) => a.draftOrder - b.draftOrder);
            let projectIndex = 0;
            return all.map((item) =>
              item.type === PORTFOLIO_PROJECT_TYPE ? ordered[projectIndex++].id : item.id,
            );
          })();
      await apiClient.put(path, { sectionIds });
      await refresh();
      setStatus({
        ...emptyStatus,
        message: published ? "Published project order updated." : "Draft project order saved.",
      });
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to reorder projects.",
      });
    }
  }
  async function removeProject(section: CmsSection) {
    const title = isPortfolioProjectDraftContent(section.draftContent)
      ? (section.draftContent as PortfolioProjectContent).title
      : "this project";
    if (
      !globalThis.confirm(
        `Delete “${title || "Untitled project"}” and its draft and published project entry? Media files remain in the library.`,
      )
    )
      return;
    setStatus({ ...emptyStatus, saving: true });
    try {
      await apiClient.request(`cms/admin/sections/${section.id}`, {
        method: "DELETE",
        body: { confirm: true },
      });
      await refresh();
      setStatus({ ...emptyStatus, message: "Project deleted." });
    } catch (error) {
      setStatus({
        ...emptyStatus,
        error: error instanceof ApiError ? error.message : "Unable to delete project.",
      });
    }
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading Portfolio projects…</p>;
  if (!page) return <StatusMessage {...status} />;
  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Website CMS / Portfolio
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-2 text-muted-foreground">
            Each project has its own draft and publication state.
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            The Portfolio also displays the four existing Home featured projects. Continue editing
            those under{" "}
            <Link
              className="font-medium text-primary underline"
              href="/website/home/sections/home.selected-projects"
            >
              Home → Selected Projects
            </Link>
            ; they are not duplicated here.
          </p>
        </div>
        <ActionButton loading={status.saving} onClick={() => void addProject()}>
          <Plus aria-hidden="true" />
          Add project
        </ActionButton>
      </header>
      <StatusMessage {...status} />
      <FormSection
        title={`Project drafts (${projects.length})`}
        description="Reordering changes draft order; publish the order separately to update the live portfolio."
      >
        {projects.length === 0 ? (
          <p className="text-sm text-muted-foreground">No project drafts yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((section, index) => {
              const content = isPortfolioProjectDraftContent(section.draftContent)
                ? (section.draftContent as PortfolioProjectContent)
                : createBlankProject();
              const published = section.publishedContent !== null;
              return (
                <li key={section.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      aria-controls={`portfolio-project-editor-${section.id}`}
                      aria-expanded={selectedId === section.id}
                      className="text-left"
                      type="button"
                      onClick={() => {
                        setSelectedId(selectedId === section.id ? undefined : section.id);
                      }}
                    >
                      <span className="font-medium">
                        {content.title || `Untitled project ${index + 1}`}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {published
                          ? section.publishedIsVisible
                            ? "Published"
                            : "Unpublished"
                          : "Draft only"}{" "}
                        · /{content.slug || "no-slug"}
                      </span>
                    </button>
                    <div className="flex flex-wrap gap-2">
                      <ActionButton
                        aria-label={`Move ${content.title || `project ${index + 1}`} draft up`}
                        disabled={!index || status.saving}
                        variant="outline"
                        onClick={() => void reorder(section, -1, false)}
                      >
                        <ArrowUp aria-hidden="true" />
                      </ActionButton>
                      <ActionButton
                        aria-label={`Move ${content.title || `project ${index + 1}`} draft down`}
                        disabled={index === projects.length - 1 || status.saving}
                        variant="outline"
                        onClick={() => void reorder(section, 1, false)}
                      >
                        <ArrowDown aria-hidden="true" />
                      </ActionButton>
                      <ActionButton
                        disabled={status.saving}
                        variant="destructive"
                        onClick={() => void removeProject(section)}
                      >
                        <Trash2 aria-hidden="true" />
                        Delete
                      </ActionButton>
                    </div>
                  </div>
                  <div
                    hidden={selectedId !== section.id}
                    id={`portfolio-project-editor-${section.id}`}
                  >
                    {selectedId === section.id ? (
                      <ProjectEditor
                        section={section}
                        onDone={async () => {
                          setSelectedId(undefined);
                          await refresh();
                        }}
                        onSaved={refresh}
                      />
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </FormSection>
      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          disabled={status.saving || !projects.some((project) => project.publishedContent !== null)}
          loading={status.saving}
          variant="outline"
          onClick={() => void publishOrder(page, projects, setStatus, refresh)}
        >
          Publish current project order
        </ActionButton>
        <p className="text-sm text-muted-foreground">
          Order publication does not publish project content.
        </p>
      </div>
    </section>
  );
}

async function publishOrder(
  page: CmsPage,
  projects: CmsSection[],
  setStatus: (status: Status) => void,
  refresh: () => Promise<void>,
) {
  setStatus({ ...emptyStatus, saving: true });
  try {
    await apiClient.put(`cms/admin/pages/${page.id}/sections/publish-order`, {
      sectionIds: projects
        .filter((item) => item.type === PORTFOLIO_PROJECT_TYPE && item.publishedContent !== null)
        .map((item) => item.id),
    });
    await refresh();
    setStatus({ ...emptyStatus, message: "Published project order updated." });
  } catch (error) {
    setStatus({
      ...emptyStatus,
      error: error instanceof ApiError ? error.message : "Unable to publish project order.",
    });
  }
}

function ProjectEditor({
  section,
  onDone,
  onSaved,
}: {
  section: CmsSection;
  onDone: () => Promise<void>;
  onSaved: () => Promise<void>;
}) {
  const [content, setContent] = useState<PortfolioProjectContent>(() =>
    isPortfolioProjectDraftContent(section.draftContent)
      ? (section.draftContent as PortfolioProjectContent)
      : createBlankProject(),
  );
  const [visible, setVisible] = useState(section.draftIsVisible);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const validation = useFormFieldErrors();
  const field = (name: string) => formFieldId("portfolio-project", name);
  const update = <K extends keyof PortfolioProjectContent>(
    key: K,
    value: PortfolioProjectContent[K],
  ) => {
    const fieldNames: Partial<Record<keyof PortfolioProjectContent, string>> = {
      title: "title",
      slug: "slug",
      category: "category",
      location: "location",
      completionYear: "completionYear",
      shortDescription: "shortDescription",
      overview: "overview",
      story: "story",
      coverImage: "coverImage",
    };
    const fieldName = fieldNames[key];
    if (fieldName) validation.clear(field(fieldName));
    else validation.clear();
    setContent((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
  };
  async function save(publish: boolean, unpublish = false) {
    setError("");
    setMessage("");
    const nextVisible = unpublish ? false : visible;
    const invalidDraft = !isPortfolioProjectDraftContent(content);
    const invalidForPublish = publish && !unpublish && !isPortfolioProjectContent(content);
    if (!unpublish && (invalidDraft || invalidForPublish)) {
      const issues = validateFormFields(portfolioProjectRules(content, publish));
      validation.report(
        issues.length
          ? issues
          : [
              {
                id: field("title"),
                label: "Project details",
                message: "Correct the invalid value before saving this project.",
              },
            ],
      );
      return;
    }
    validation.clear();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const contentToSave =
        unpublish && isPortfolioProjectContent(section.publishedContent)
          ? section.publishedContent
          : content;
      await apiClient.patch<CmsSection>(`cms/admin/sections/${section.id}`, {
        content: contentToSave,
        isVisible: nextVisible,
      });
      if (publish) await apiClient.post<CmsSection>(`cms/admin/sections/${section.id}/publish`);
      setMessage(
        unpublish
          ? "Project unpublished; its published content is retained."
          : publish
            ? "Project draft published."
            : "Project draft saved.",
      );
      if (publish) await onDone();
      else await onSaved();
    } catch (cause) {
      const text = cause instanceof ApiError ? cause.message : "Unable to save project.";
      if (
        cause instanceof ApiError &&
        cause.message.toLowerCase().includes("already uses this slug")
      ) {
        validation.report([
          {
            id: field("slug"),
            label: "Slug",
            message:
              "This slug is already used by another draft or published project. Choose a unique slug.",
          },
        ]);
        setError("");
      } else {
        setError(text);
      }
    } finally {
      setSaving(false);
    }
  }
  function addSection() {
    update("contentSections", [
      ...content.contentSections,
      { id: `section-${crypto.randomUUID()}`, heading: "", body: "", image: null },
    ]);
  }
  function moveImage(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= content.gallery.length) return;
    const gallery = [...content.gallery];
    [gallery[index], gallery[target]] = [gallery[target], gallery[index]];
    update("gallery", gallery);
  }
  const selectedImageIds = [
    ...(content.coverImage ? [content.coverImage.publicId] : []),
    ...content.gallery.map((image) => image.publicId),
  ];
  const duplicateImages = new Set(selectedImageIds).size !== selectedImageIds.length;
  return (
    <div className="mt-5 space-y-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
      <FormErrorSummary errors={validation.errors} focusKey={validation.focusKey} />
      <StatusMessage error={error} message={message} />
      <FormSection
        title="Project details"
        description="Slug is the public URL segment; keep it unique and stable."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id={field("title")}
            label="Project title"
            description="Required when publishing."
            maxLength={160}
            required
            value={content.title}
            error={fieldErrorMessage(validation.errors, field("title"))}
            onChange={(e) => update("title", e.target.value)}
          />
          <TextField
            id={field("slug")}
            label="Slug"
            description="Required when publishing. Use lowercase letters, numbers, and hyphens; the home- prefix is reserved."
            maxLength={100}
            required
            value={content.slug}
            error={fieldErrorMessage(validation.errors, field("slug"))}
            onChange={(e) => update("slug", e.target.value)}
          />
          <TextField
            id={field("category")}
            label="Category"
            description="Required when publishing."
            maxLength={100}
            required
            value={content.category}
            error={fieldErrorMessage(validation.errors, field("category"))}
            onChange={(e) => update("category", e.target.value)}
          />
          <TextField
            id={field("location")}
            label="Location"
            maxLength={160}
            value={content.location}
            error={fieldErrorMessage(validation.errors, field("location"))}
            onChange={(e) => update("location", e.target.value)}
          />
          <TextField
            id={field("completionYear")}
            label="Completion year"
            type="number"
            min={1900}
            max={2200}
            step={1}
            value={content.completionYear ?? ""}
            error={fieldErrorMessage(validation.errors, field("completionYear"))}
            onChange={(e) =>
              update("completionYear", e.target.value ? Number(e.target.value) : null)
            }
          />
        </div>
        <TextareaField
          id={field("shortDescription")}
          label="Short description"
          description="Required when publishing."
          maxLength={500}
          required
          value={content.shortDescription}
          error={fieldErrorMessage(validation.errors, field("shortDescription"))}
          onChange={(e) => update("shortDescription", e.target.value)}
        />
        <TextareaField
          id={field("overview")}
          label="Overview"
          maxLength={5000}
          value={content.overview}
          error={fieldErrorMessage(validation.errors, field("overview"))}
          onChange={(e) => update("overview", e.target.value)}
        />
        <SwitchField
          label="Project visible when published"
          checked={visible}
          onChange={setVisible}
        />
      </FormSection>
      <FormSection title="Cover image">
        <ImageUploadField
          allowLibrary
          id={field("coverImage")}
          label="Cover image"
          description="Required when publishing; choose a photo that is distinct from the project gallery."
          value={asset(content.coverImage)}
          error={fieldErrorMessage(validation.errors, field("coverImage"))}
          onChange={(image) => {
            if (image && content.gallery.some((item) => item.publicId === image.publicId)) {
              validation.report([
                {
                  id: field("coverImage"),
                  label: "Cover image",
                  message: "This photo is already in the gallery. Choose a different cover image.",
                },
              ]);
              return;
            }
            validation.clear(field("coverImage"));
            if (!image) validation.clear(field("coverImage-alt"));
            update("coverImage", media(image));
          }}
          required
        />
        <TextField
          id={field("coverImage-alt")}
          label="Cover alt text"
          description="Required after choosing a cover image; describe it for visitors using assistive technology."
          required={Boolean(content.coverImage)}
          value={content.coverImage?.alt ?? ""}
          error={fieldErrorMessage(validation.errors, field("coverImage-alt"))}
          onChange={(e) => {
            validation.clear(field("coverImage-alt"));
            update(
              "coverImage",
              content.coverImage ? { ...content.coverImage, alt: e.target.value } : null,
            );
          }}
        />
      </FormSection>
      <FormSection
        title={`Gallery (${content.gallery.length})`}
        description="At least one distinct photo is required when publishing. Add up to 50, then reorder them; removing an image only changes this draft."
      >
        {duplicateImages ? (
          <p aria-live="polite" className="text-sm text-destructive">
            The cover and gallery must use distinct photos. Remove or replace the repeated image.
          </p>
        ) : null}
        <ImageUploadField
          allowLibrary
          id={field("gallery")}
          label="Add gallery image"
          error={fieldErrorMessage(validation.errors, field("gallery"))}
          required={content.gallery.length === 0}
          onChange={(image) => {
            if (!image) return;
            if (
              image.publicId === content.coverImage?.publicId ||
              content.gallery.some((item) => item.publicId === image.publicId)
            ) {
              validation.report([
                {
                  id: field("gallery"),
                  label: "Gallery images",
                  message:
                    "This photo is already in the cover or gallery. Choose a different image.",
                },
              ]);
              return;
            }
            if (content.gallery.length >= 50) {
              validation.report([
                {
                  id: field("gallery"),
                  label: "Gallery images",
                  message: "A project can have up to 50 gallery images.",
                },
              ]);
              return;
            }
            validation.clear(field("gallery"));
            update("gallery", [...content.gallery, media(image)!]);
          }}
        />
        <div className="space-y-3">
          {content.gallery.map((image, index) => (
            <div
              key={`${image.publicId}-${index}`}
              id={field(`gallery-${index}-image`)}
              aria-label={`Gallery image ${index + 1}`}
              aria-describedby={
                fieldErrorMessage(validation.errors, field(`gallery-${index}-image`))
                  ? `${field(`gallery-${index}-image`)}-error`
                  : undefined
              }
              role="group"
              tabIndex={-1}
              className="grid gap-3 rounded-lg border border-border bg-card p-3 focus:outline-none focus:ring-3 focus:ring-ring/50 sm:grid-cols-[8rem_1fr_auto]"
            >
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
                {image.url ? (
                  <Image
                    alt={image.alt || `Gallery image ${index + 1}`}
                    fill
                    sizes="128px"
                    src={image.url}
                    className="object-cover"
                  />
                ) : null}
              </div>
              <TextField
                id={field(`gallery-${index}-image-alt`)}
                label={`Gallery image ${index + 1} alt text`}
                description="Describe what is visible in this project photo."
                required
                value={image.alt ?? ""}
                error={fieldErrorMessage(validation.errors, field(`gallery-${index}-image-alt`))}
                onChange={(e) => {
                  validation.clear(field(`gallery-${index}-image-alt`));
                  update(
                    "gallery",
                    content.gallery.map((item, i) =>
                      i === index ? { ...item, alt: e.target.value } : item,
                    ),
                  );
                }}
              />
              <div className="sm:col-span-3">
                <FormError id={`${field(`gallery-${index}-image`)}-error`}>
                  {fieldErrorMessage(validation.errors, field(`gallery-${index}-image`))}
                </FormError>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <ActionButton
                  aria-label={`Move gallery image ${index + 1} up`}
                  disabled={index === 0}
                  variant="outline"
                  onClick={() => moveImage(index, -1)}
                >
                  <ArrowUp aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  aria-label={`Move gallery image ${index + 1} down`}
                  disabled={index === content.gallery.length - 1}
                  variant="outline"
                  onClick={() => moveImage(index, 1)}
                >
                  <ArrowDown aria-hidden="true" />
                </ActionButton>
                <ActionButton
                  variant="destructive"
                  onClick={() =>
                    update(
                      "gallery",
                      content.gallery.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 aria-hidden="true" />
                  Remove
                </ActionButton>
              </div>
            </div>
          ))}
        </div>
      </FormSection>
      <FormSection
        title="Project story"
        description="Each editorial section needs a heading and either body copy or an image."
      >
        <TextareaField
          id={field("story")}
          label="Story"
          maxLength={20000}
          value={content.story}
          error={fieldErrorMessage(validation.errors, field("story"))}
          onChange={(e) => update("story", e.target.value)}
        />
        <div
          id={field("contentSections")}
          aria-label="Project content sections"
          aria-describedby={
            fieldErrorMessage(validation.errors, field("contentSections"))
              ? `${field("contentSections")}-error`
              : undefined
          }
          role="group"
          tabIndex={-1}
          className="flex items-center justify-between gap-3 rounded-md focus:outline-none focus:ring-3 focus:ring-ring/50"
        >
          <h3 className="font-medium">Content sections</h3>
          <ActionButton
            variant="outline"
            disabled={content.contentSections.length >= 30}
            onClick={addSection}
          >
            <Plus aria-hidden="true" />
            Add section
          </ActionButton>
        </div>
        <FormError id={`${field("contentSections")}-error`}>
          {fieldErrorMessage(validation.errors, field("contentSections"))}
        </FormError>
        {content.contentSections.map((part, index) => (
          <div key={part.id} className="space-y-4 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Section {index + 1}</h4>
              <ActionButton
                variant="destructive"
                onClick={() =>
                  update(
                    "contentSections",
                    content.contentSections.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                Remove
              </ActionButton>
            </div>
            <TextField
              id={field(`section-${index}-heading`)}
              label="Heading"
              description="Required when publishing this section."
              maxLength={160}
              required
              value={part.heading}
              error={fieldErrorMessage(validation.errors, field(`section-${index}-heading`))}
              onChange={(e) =>
                update(
                  "contentSections",
                  content.contentSections.map((item, i) =>
                    i === index ? { ...item, heading: e.target.value } : item,
                  ),
                )
              }
            />
            <TextareaField
              id={field(`section-${index}-body`)}
              label="Body"
              description="Required to publish when no section image is selected."
              maxLength={10000}
              required={!part.image}
              value={part.body}
              error={fieldErrorMessage(validation.errors, field(`section-${index}-body`))}
              onChange={(e) =>
                update(
                  "contentSections",
                  content.contentSections.map((item, i) =>
                    i === index ? { ...item, body: e.target.value } : item,
                  ),
                )
              }
            />
            <ImageUploadField
              allowLibrary
              id={field(`section-${index}-image`)}
              label="Section image"
              value={asset(part.image)}
              error={fieldErrorMessage(validation.errors, field(`section-${index}-image`))}
              onChange={(image) =>
                update(
                  "contentSections",
                  content.contentSections.map((item, i) =>
                    i === index ? { ...item, image: media(image) } : item,
                  ),
                )
              }
            />
            <TextField
              id={field(`section-${index}-image-alt`)}
              label="Section image alt text"
              description="Required when an image is selected."
              required={Boolean(part.image)}
              value={part.image?.alt ?? ""}
              error={fieldErrorMessage(validation.errors, field(`section-${index}-image-alt`))}
              onChange={(e) =>
                update(
                  "contentSections",
                  content.contentSections.map((item, i) =>
                    i === index
                      ? {
                          ...item,
                          image: item.image ? { ...item.image, alt: e.target.value } : null,
                        }
                      : item,
                  ),
                )
              }
            />
          </div>
        ))}
      </FormSection>
      <div className="flex flex-wrap gap-3">
        <ActionButton
          loading={saving}
          disabled={saving}
          variant="outline"
          onClick={() => void save(false)}
        >
          Save draft
        </ActionButton>
        <ActionButton loading={saving} disabled={saving} onClick={() => void save(true)}>
          Publish project
        </ActionButton>
        {section.publishedContent && section.publishedIsVisible ? (
          <ActionButton
            loading={saving}
            disabled={saving}
            variant="outline"
            onClick={() => void save(true, true)}
          >
            Unpublish project
          </ActionButton>
        ) : null}
        <ActionButton disabled={saving} variant="ghost" onClick={() => void onDone()}>
          Close editor
        </ActionButton>
      </div>
    </div>
  );
}
