"use client";

import type { HomeHeroContent } from "@fs/cms-contracts";
import Image from "next/image";
import { useEffect, useState } from "react";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
  fieldErrorMessage,
  useFormFieldErrors,
} from "./form-controls";
import {
  formFieldId,
  validateFormFields,
  type FormFieldRule,
} from "../../features/cms/form-validation";

type DraftSection = {
  id: string;
  type: string;
  draftContent: HomeHeroContent;
  draftIsVisible: boolean;
};
type DraftPage = { sections: DraftSection[] };

const formId = "home-hero";
const destinations = ["home", "about", "services", "portfolio", "process", "contact"];

function isDraftImageShape(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const image = value as Record<string, unknown>;
  return (
    typeof image.publicId === "string" &&
    typeof image.url === "string" &&
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    typeof image.alt === "string"
  );
}

function isPublishedImage(value: unknown): boolean {
  if (!isDraftImageShape(value)) return false;
  const image = value as HomeHeroContent["image"];
  return Boolean(
    image.publicId && image.url && image.width > 0 && image.height > 0 && image.alt.trim(),
  );
}

function heroRules(content: HomeHeroContent, publish: boolean): FormFieldRule[] {
  const serviceLabels = Array.isArray(content.serviceLabels) ? content.serviceLabels : [];
  const indicator = content.slideIndicator as unknown as Record<string, unknown> | null;
  const rules: FormFieldRule[] = [
    {
      id: formFieldId(formId, "eyebrow"),
      label: "Eyebrow",
      value: content.eyebrow,
      required: true,
    },
    {
      id: formFieldId(formId, "floating-label"),
      label: "Floating image label",
      value: content.floatingLabel,
      required: true,
    },
    {
      id: formFieldId(formId, "heading"),
      label: "Heading",
      value: content.heading,
      required: true,
    },
    {
      id: formFieldId(formId, "description"),
      label: "Description",
      value: content.description,
      required: true,
    },
    {
      id: formFieldId(formId, "primary-cta-label"),
      label: "Primary CTA label",
      value: content.primaryCtaLabel,
      required: true,
    },
    {
      id: formFieldId(formId, "primary-cta-destination"),
      label: "Primary destination",
      value: content.primaryCtaDestination,
      validate: (value) => destinations.includes(String(value)),
      invalidMessage: "Choose a supported destination.",
    },
    {
      id: formFieldId(formId, "secondary-cta-label"),
      label: "Secondary CTA label",
      value: content.secondaryCtaLabel,
      required: true,
    },
    {
      id: formFieldId(formId, "secondary-cta-destination"),
      label: "Secondary destination",
      value: content.secondaryCtaDestination,
      validate: (value) => destinations.includes(String(value)),
      invalidMessage: "Choose a supported destination.",
    },
    {
      id: formFieldId(formId, "service-labels"),
      label: "Service labels",
      value: content.serviceLabels,
      validate: (value) => Array.isArray(value) && value.length === 3,
      invalidMessage: "Provide exactly three service labels.",
    },
    ...serviceLabels.map((label, index) => ({
      id: formFieldId(formId, `service-${index + 1}`),
      label: `Service ${index + 1}`,
      value: label,
      required: true,
    })),
    {
      id: formFieldId(formId, "slide-indicator-enabled"),
      label: "Slide indicator enabled",
      value: indicator?.enabled,
      validate: (value) => typeof value === "boolean",
      invalidMessage: "Choose whether the slide indicator is enabled.",
    },
    {
      id: formFieldId(formId, "slide-indicator-current"),
      label: "Current slide number",
      value: indicator?.current,
      validate: (value) => typeof value === "number",
      invalidMessage: "Enter a numeric current slide value.",
    },
    {
      id: formFieldId(formId, "slide-indicator-total"),
      label: "Total slide count",
      value: indicator?.total,
      validate: (value) => typeof value === "number",
      invalidMessage: "Enter a numeric total slide count.",
    },
    {
      id: formFieldId(formId, "desktop-image"),
      label: "Desktop image",
      value: content.image,
      validate: publish ? isPublishedImage : isDraftImageShape,
      invalidMessage: publish
        ? "Upload a valid desktop image before publishing."
        : "Choose a valid desktop image asset.",
    },
    {
      id: formFieldId(formId, "desktop-image-alt"),
      label: "Desktop image alt text",
      value: content.image.alt,
      required: publish,
      requiredMessage: "Describe the desktop image for visitors using assistive technology.",
    },
    ...(content.mobileImage === undefined
      ? []
      : [
          {
            id: formFieldId(formId, "mobile-image"),
            label: "Mobile image",
            value: content.mobileImage,
            validate: publish ? isPublishedImage : isDraftImageShape,
            invalidMessage: publish
              ? "Upload a valid mobile image or remove it."
              : "Choose a valid mobile image asset or remove it.",
          },
          {
            id: formFieldId(formId, "mobile-image-alt"),
            label: "Mobile image alt text",
            value: content.mobileImage.alt,
            required: publish,
            requiredMessage: "Describe the mobile image or remove it before publishing.",
          },
        ]),
  ];
  return rules;
}

export function HeroEditor() {
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<HomeHeroContent>();
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const validation = useFormFieldErrors();

  useEffect(() => {
    apiClient
      .get<DraftPage>("cms/admin/pages/home")
      .then((page) => {
        const found = page.sections.find((candidate) => candidate.type === "home.hero");
        if (found) {
          setSection(found);
          setContent(found.draftContent);
          setIsVisible(found.draftIsVisible);
        }
      })
      .catch(() => setError("Unable to load the Home Hero draft."))
      .finally(() => setIsLoading(false));
  }, []);

  function update<K extends keyof HomeHeroContent>(key: K, value: HomeHeroContent[K]) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  async function save(publish = false) {
    if (!section || !content) return;
    const issues = validateFormFields(heroRules(content, publish));
    if (issues.length) {
      validation.report(issues);
      setMessage(undefined);
      setError(undefined);
      return;
    }
    validation.clear();
    setIsSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await apiClient.patch(`cms/admin/sections/${section.id}`, { content, isVisible });
      if (publish) await apiClient.post(`cms/admin/sections/${section.id}/publish`);
      setMessage(
        publish
          ? "Draft saved and published."
          : "Draft saved. The Storefront is unchanged until publishing.",
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save the Hero draft.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading Hero draft…</p>;
  if (!section || !content)
    return (
      <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        The Home Hero is not seeded yet. Run <code>pnpm cms:seed:home-hero</code> in the backend,
        then reload this page.
      </p>
    );

  const serviceLabels = Array.isArray(content.serviceLabels) ? content.serviceLabels : [];
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Home / Hero Section
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Hero Section</h1>
        <p className="text-muted-foreground">
          Edit the homepage introduction. Route destinations remain code-owned.
        </p>
      </header>
      <FormErrorSummary errors={validation.errors} focusKey={validation.focusKey} />
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.75fr)]">
        <form className="space-y-6" onSubmit={(event) => event.preventDefault()}>
          <FormSection
            description="Set the primary message visitors see when they arrive."
            title="Main Content"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id={formFieldId(formId, "eyebrow")}
                label="Eyebrow"
                error={fieldErrorMessage(validation.errors, formFieldId(formId, "eyebrow"))}
                onChange={(event) => update("eyebrow", event.target.value)}
                required
                value={content.eyebrow}
              />
              <TextField
                id={formFieldId(formId, "floating-label")}
                label="Floating image label"
                error={fieldErrorMessage(validation.errors, formFieldId(formId, "floating-label"))}
                onChange={(event) => update("floatingLabel", event.target.value)}
                required
                value={content.floatingLabel}
              />
            </div>
            <TextField
              id={formFieldId(formId, "heading")}
              label="Heading"
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "heading"))}
              onChange={(event) => update("heading", event.target.value)}
              required
              value={content.heading}
            />
            <TextareaField
              description="Keep this concise so it remains readable across breakpoints."
              id={formFieldId(formId, "description")}
              label="Description"
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "description"))}
              onChange={(event) => update("description", event.target.value)}
              required
              value={content.description}
            />
          </FormSection>
          <FormSection
            description="Choose labels and predefined destinations for the two actions."
            title="Call-to-Action Buttons"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id={formFieldId(formId, "primary-cta-label")}
                label="Primary CTA label"
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "primary-cta-label"),
                )}
                onChange={(event) => update("primaryCtaLabel", event.target.value)}
                required
                value={content.primaryCtaLabel}
              />
              <SelectField
                id={formFieldId(formId, "primary-cta-destination")}
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "primary-cta-destination"),
                )}
                label="Primary destination"
                onChange={(event) =>
                  update(
                    "primaryCtaDestination",
                    event.target.value as HomeHeroContent["primaryCtaDestination"],
                  )
                }
                value={content.primaryCtaDestination}
              >
                <option value="portfolio">Portfolio</option>
                <option value="process">The Process</option>
                <option value="contact">Contact</option>
              </SelectField>
              <TextField
                id={formFieldId(formId, "secondary-cta-label")}
                label="Secondary CTA label"
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "secondary-cta-label"),
                )}
                onChange={(event) => update("secondaryCtaLabel", event.target.value)}
                required
                value={content.secondaryCtaLabel}
              />
              <SelectField
                id={formFieldId(formId, "secondary-cta-destination")}
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "secondary-cta-destination"),
                )}
                label="Secondary destination"
                onChange={(event) =>
                  update(
                    "secondaryCtaDestination",
                    event.target.value as HomeHeroContent["secondaryCtaDestination"],
                  )
                }
                value={content.secondaryCtaDestination}
              >
                <option value="process">The Process</option>
                <option value="portfolio">Portfolio</option>
                <option value="contact">Contact</option>
              </SelectField>
            </div>
          </FormSection>
          <FormSection
            description="These labels are displayed as a compact service list."
            title="Service Labels"
          >
            <div className="grid gap-5 sm:grid-cols-3">
              {serviceLabels.map((label, index) => (
                <TextField
                  id={formFieldId(formId, `service-${index + 1}`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `service-${index + 1}`),
                  )}
                  key={index}
                  label={`Service ${index + 1}`}
                  onChange={(event) => {
                    const labels = [...content.serviceLabels] as [string, string, string];
                    labels[index] = event.target.value;
                    update("serviceLabels", labels);
                  }}
                  required
                  value={label}
                />
              ))}
            </div>
            {fieldErrorMessage(validation.errors, formFieldId(formId, "service-labels")) ? (
              <p
                aria-live="polite"
                className="text-sm text-destructive"
                id={formFieldId(formId, "service-labels")}
                tabIndex={-1}
              >
                {fieldErrorMessage(validation.errors, formFieldId(formId, "service-labels"))}
              </p>
            ) : null}
          </FormSection>
          <FormSection
            description="The indicator values are content-controlled; enter numeric slide values."
            title="Slide Indicator"
          >
            <SwitchField
              checked={content.slideIndicator?.enabled ?? false}
              error={fieldErrorMessage(
                validation.errors,
                formFieldId(formId, "slide-indicator-enabled"),
              )}
              id={formFieldId(formId, "slide-indicator-enabled")}
              label="Enable slide indicator"
              onChange={(enabled) =>
                update("slideIndicator", { ...content.slideIndicator, enabled })
              }
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                id={formFieldId(formId, "slide-indicator-current")}
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "slide-indicator-current"),
                )}
                label="Current slide number"
                onChange={(event) =>
                  update("slideIndicator", {
                    ...content.slideIndicator,
                    current: Number(event.target.value),
                  })
                }
                type="number"
                value={String(content.slideIndicator?.current ?? "")}
              />
              <TextField
                id={formFieldId(formId, "slide-indicator-total")}
                error={fieldErrorMessage(
                  validation.errors,
                  formFieldId(formId, "slide-indicator-total"),
                )}
                label="Total slide count"
                onChange={(event) =>
                  update("slideIndicator", {
                    ...content.slideIndicator,
                    total: Number(event.target.value),
                  })
                }
                type="number"
                value={String(content.slideIndicator?.total ?? "")}
              />
            </div>
          </FormSection>
          <FormSection
            description="Upload responsive imagery through the authenticated Cloudinary integration."
            title="Media"
          >
            <ImageUploadField
              id={formFieldId(formId, "desktop-image")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "desktop-image"))}
              description="The desktop image is required before publishing."
              label="Desktop image"
              onChange={(image) =>
                update("image", image ?? { publicId: "", url: "", width: 0, height: 0, alt: "" })
              }
              value={content.image}
            />
            <TextField
              id={formFieldId(formId, "desktop-image-alt")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "desktop-image-alt"))}
              description="Describe the image for visitors using assistive technology. Required before publishing."
              label="Desktop image alt text"
              onChange={(event) => update("image", { ...content.image, alt: event.target.value })}
              value={content.image.alt}
            />
            <ImageUploadField
              id={formFieldId(formId, "mobile-image")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "mobile-image"))}
              description="Optional alternate crop for smaller screens; if supplied, it must be valid and have alt text before publishing."
              label="Mobile image"
              onChange={(image) => update("mobileImage", image)}
              value={content.mobileImage}
            />
            <TextField
              id={formFieldId(formId, "mobile-image-alt")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "mobile-image-alt"))}
              description="Optional; required when a mobile image is supplied for publishing."
              label="Mobile image alt text"
              onChange={(event) =>
                update(
                  "mobileImage",
                  content.mobileImage
                    ? { ...content.mobileImage, alt: event.target.value }
                    : undefined,
                )
              }
              value={content.mobileImage?.alt ?? ""}
            />
          </FormSection>
          <FormSection
            description="Draft visibility is separate from publishing. Hidden sections will not render publicly after publishing."
            title="Visibility & Publishing"
          >
            <SwitchField
              checked={isVisible}
              description="Only visible, published content appears on the Storefront."
              label="Show Hero section"
              onChange={setIsVisible}
            />
            <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-card backdrop-blur">
              <ActionButton loading={isSaving} onClick={() => void save(false)} variant="outline">
                Save draft
              </ActionButton>
              <ActionButton loading={isSaving} onClick={() => void save(true)}>
                Save and publish
              </ActionButton>
            </div>
          </FormSection>
        </form>
        <HeroPreview content={content} />
      </div>
    </section>
  );
}

function HeroPreview({ content }: { content: HomeHeroContent }) {
  const serviceLabels = Array.isArray(content.serviceLabels) ? content.serviceLabels : [];
  return (
    <aside
      aria-label="Hero preview"
      className="h-fit overflow-hidden rounded-xl border border-border bg-muted shadow-card xl:sticky xl:top-24"
    >
      <div className="relative aspect-[4/3] bg-secondary">
        {content.image.url ? (
          <Image
            alt={content.image.alt}
            className="object-cover"
            fill
            sizes="(min-width: 1280px) 35vw, 100vw"
            src={content.image.url}
          />
        ) : (
          <div className="grid size-full place-items-center p-8 text-center text-sm text-muted-foreground">
            Upload a desktop image to preview the Hero.
          </div>
        )}
        <span className="absolute bottom-4 left-4 rounded-full bg-background/90 px-3 py-1 text-[10px] font-semibold tracking-[0.14em] text-foreground">
          {content.floatingLabel}
        </span>
      </div>
      <div className="space-y-3 bg-card p-6">
        <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground">
          {content.eyebrow}
        </p>
        <h2 className="font-display text-3xl leading-none tracking-tight">{content.heading}</h2>
        <p className="text-sm text-muted-foreground">{content.description}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          {serviceLabels.map((label) => (
            <span className="rounded-full border border-border px-2 py-1 text-xs" key={label}>
              {label}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}
