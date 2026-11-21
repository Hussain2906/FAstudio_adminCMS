"use client";

import {
  HOME_DESIGN_CONSULTATION_TYPE,
  homeDesignConsultationDefaultContent,
  normalizeHomeDesignConsultationContent,
  type CmsImage,
  type HomeDesignConsultationContent,
} from "@fs/cms-contracts";
import { useEffect, useState } from "react";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
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

type Section = {
  id: string;
  type: string;
  draftContent: HomeDesignConsultationContent;
  draftIsVisible: boolean;
};
type Page = { sections: Section[] };

function imageValue(content: HomeDesignConsultationContent): CmsImage | undefined {
  return content.consultationImage
    ? { ...content.consultationImage, alt: content.consultationImageAlt }
    : undefined;
}

const formId = "home-design-consultation";

function isMediaAssetValue(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  return (
    typeof asset.publicId === "string" &&
    asset.publicId.trim().length > 0 &&
    typeof asset.url === "string" &&
    asset.url.trim().length > 0 &&
    typeof asset.width === "number" &&
    asset.width > 0 &&
    typeof asset.height === "number" &&
    asset.height > 0
  );
}

function isCalcomEventUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    return (
      url.protocol === "https:" &&
      url.hostname === "cal.com" &&
      url.username === "" &&
      url.password === "" &&
      url.hash === "" &&
      pathSegments.length >= 2 &&
      pathSegments.every((part) => /^[a-z0-9][a-z0-9_-]*$/i.test(part))
    );
  } catch {
    return false;
  }
}

function consultationRules(content: HomeDesignConsultationContent): FormFieldRule[] {
  return [
    {
      id: formFieldId(formId, "eyebrow"),
      label: "Eyebrow",
      value: content.eyebrow,
      required: true,
      maxLength: 100,
    },
    {
      id: formFieldId(formId, "heading"),
      label: "Heading",
      value: content.heading,
      required: true,
      maxLength: 160,
    },
    {
      id: formFieldId(formId, "description"),
      label: "Description",
      value: content.description,
      maxLength: 300,
    },
    {
      id: formFieldId(formId, "calcom-url"),
      label: "Public Cal.com event URL",
      value: content.calcomUrl,
      required: true,
      validate: isCalcomEventUrl,
      requiredMessage: "Enter the public Cal.com event URL.",
      invalidMessage: "Use an HTTPS event URL on cal.com with a valid two-part event path.",
    },
    {
      id: formFieldId(formId, "consultation-image"),
      label: "Consultation workspace image",
      value: content.consultationImage,
      validate: (value) => value === null || isMediaAssetValue(value),
      invalidMessage: "Choose a valid uploaded Cloudinary image.",
    },
    {
      id: formFieldId(formId, "consultation-image-alt"),
      label: "Image alt text",
      value: content.consultationImageAlt,
      required: Boolean(content.consultationImage),
      maxLength: 180,
      validate: (value) => typeof value === "string",
      requiredMessage: "Describe the consultation image for visitors using assistive technology.",
      invalidMessage: "Enter image alt text with 180 characters or fewer.",
    },
  ];
}

export function HomeDesignConsultationEditor() {
  const [section, setSection] = useState<Section>();
  const [content, setContent] = useState<HomeDesignConsultationContent>(
    homeDesignConsultationDefaultContent,
  );
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();
  const validation = useFormFieldErrors();
  useEffect(() => {
    apiClient
      .get<Page>("cms/admin/pages/home")
      .then((page) => {
        const found = page.sections.find(
          (candidate) => candidate.type === HOME_DESIGN_CONSULTATION_TYPE,
        );
        if (found) {
          setSection(found);
          setContent(
            normalizeHomeDesignConsultationContent(found.draftContent) ??
              homeDesignConsultationDefaultContent,
          );
          setVisible(found.draftIsVisible);
        }
      })
      .catch(() => setError("Unable to load the consultation draft."))
      .finally(() => setLoading(false));
  }, []);
  function update<K extends keyof HomeDesignConsultationContent>(
    key: K,
    value: HomeDesignConsultationContent[K],
  ) {
    setContent((current) => ({ ...current, [key]: value }));
    validation.clear();
    setError(undefined);
    setMessage(undefined);
  }
  async function save(publish = false) {
    if (!section) return;
    const issues = validateFormFields(consultationRules(content));
    if (issues.length) {
      validation.report(issues);
      setError(undefined);
      setMessage(undefined);
      return;
    }
    validation.clear();
    setSaving(true);
    setError(undefined);
    setMessage(undefined);
    try {
      await apiClient.patch(`cms/admin/sections/${section.id}`, { content, isVisible: visible });
      if (publish) await apiClient.post(`cms/admin/sections/${section.id}/publish`);
      setMessage(
        publish
          ? "Consultation section draft saved and published."
          : "Draft saved. The live Home page is unchanged until publishing.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the consultation draft.",
      );
    } finally {
      setSaving(false);
    }
  }
  if (loading) return <p className="text-sm text-muted-foreground">Loading consultation draft…</p>;
  if (!section)
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold">Design Consultation</h1>
        <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
          The section is registered but has not been seeded yet. Run{" "}
          <code>pnpm cms:seed:home-design-consultation</code> in the backend, then reload.
        </p>
      </section>
    );
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Home / Design Consultation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Design Consultation</h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage the consultation copy and validated Cal.com event link. Cal.com controls real
          availability, timezone conversion, and booking.
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
      <div className="space-y-6">
        <FormSection
          description="These fields appear above the embedded booking flow."
          title="Section introduction"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={formFieldId(formId, "eyebrow")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "eyebrow"))}
              label="Eyebrow"
              maxLength={100}
              onChange={(event) => update("eyebrow", event.target.value)}
              required
              value={content.eyebrow}
            />
            <TextField
              id={formFieldId(formId, "heading")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "heading"))}
              label="Heading"
              maxLength={160}
              onChange={(event) => update("heading", event.target.value)}
              required
              value={content.heading}
            />
          </div>
          <TextareaField
            id={formFieldId(formId, "description")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "description"))}
            label="Description"
            maxLength={300}
            onChange={(event) => update("description", event.target.value)}
            value={content.description}
          />
        </FormSection>
        <FormSection
          description="The existing configured event is the initial default. Cal.com remains the sole scheduling authority."
          title="Cal.com event"
        >
          <TextField
            id={formFieldId(formId, "calcom-url")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "calcom-url"))}
            description="Must be an HTTPS public event page on cal.com. This event is configured in America/Toronto; Cal.com handles daylight saving and displays availability in each visitor’s local timezone."
            label="Public Cal.com event URL"
            onChange={(event) => update("calcomUrl", event.target.value.trim())}
            placeholder="https://cal.com/hussain-r8h2rf/fs-studio-design-consultation"
            required
            value={content.calcomUrl}
          />
        </FormSection>
        <FormSection
          description="Upload a wide interior consultation photograph or select an existing Cloudinary image. Visitors see a labelled placeholder until an image is added."
          title="Consultation image"
        >
          <ImageUploadField
            id={formFieldId(formId, "consultation-image")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "consultation-image"))}
            allowLibrary
            description="JPEG, PNG, WebP, or AVIF · Maximum 10 MB"
            label="Consultation workspace image"
            onChange={(image) => {
              update(
                "consultationImage",
                image
                  ? {
                      publicId: image.publicId,
                      url: image.url,
                      width: image.width,
                      height: image.height,
                    }
                  : null,
              );
              if (!image) update("consultationImageAlt", "");
            }}
            value={imageValue(content)}
          />
          <TextField
            id={formFieldId(formId, "consultation-image-alt")}
            error={fieldErrorMessage(
              validation.errors,
              formFieldId(formId, "consultation-image-alt"),
            )}
            description="Describe the consultation image for visitors using assistive technology."
            label="Image alt text"
            maxLength={180}
            onChange={(event) => update("consultationImageAlt", event.target.value)}
            required={Boolean(content.consultationImage)}
            value={content.consultationImageAlt}
          />
        </FormSection>
        <FormSection
          description="Visibility and ordering use the standard CMS section controls."
          title="Section settings"
        >
          <SwitchField
            checked={visible}
            label="Visible on the published Home page"
            onChange={setVisible}
          />
        </FormSection>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <ActionButton loading={saving} onClick={() => void save()} type="button" variant="outline">
          Save draft
        </ActionButton>
        <ActionButton loading={saving} onClick={() => void save(true)} type="button">
          Publish section
        </ActionButton>
      </div>
    </section>
  );
}
