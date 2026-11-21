"use client";

import { isSiteLogoContent, type CmsMediaAsset, type SiteLogoContent } from "@fs/cms-contracts";
import Image from "next/image";
import { useEffect, useState } from "react";
import { GLOBAL_SITE_LOGO_TYPE } from "@fs/cms-contracts";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
  TextField,
  fieldErrorMessage,
  useFormFieldErrors,
} from "./form-controls";
import {
  formFieldId,
  validateFormFields,
  type FormFieldRule,
} from "../../features/cms/form-validation";

type GlobalComponentResponse = {
  type: string;
  draftContent: SiteLogoContent;
  publishedContent: SiteLogoContent | null;
  publishedAt: string | null;
};

type SessionResponse = { admin: { role: "SUPER_ADMIN" | "ADMIN" | "EDITOR" } };

const emptyContent: SiteLogoContent = { image: null, alt: "" };
const logoImageId = formFieldId("site-branding", "logo-image");
const logoAltId = formFieldId("site-branding", "logo-alt-text");

function LogoPreview({ asset, alt }: { asset: CmsMediaAsset | null; alt: string }) {
  if (!asset?.url)
    return (
      <div className="grid min-h-28 place-items-center rounded-lg border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
        No logo published
      </div>
    );
  return (
    <div className="relative min-h-28 overflow-hidden rounded-lg border border-border bg-primary p-6">
      <Image
        alt={alt || "Site logo preview"}
        className="object-contain"
        fill
        sizes="(min-width: 1024px) 420px, 100vw"
        src={asset.url}
      />
    </div>
  );
}

export function SiteBrandingEditor() {
  const [content, setContent] = useState<SiteLogoContent>(emptyContent);
  const [published, setPublished] = useState<SiteLogoContent | null>(null);
  const [role, setRole] = useState<SessionResponse["admin"]["role"]>("EDITOR");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const validation = useFormFieldErrors();

  useEffect(() => {
    Promise.all([
      apiClient.get<GlobalComponentResponse>(`cms/admin/components/${GLOBAL_SITE_LOGO_TYPE}`),
      apiClient.get<SessionResponse>("auth/session"),
    ])
      .then(([component, session]) => {
        setContent(component.draftContent);
        setPublished(component.publishedContent);
        setRole(session.admin.role);
      })
      .catch(() => setError("Unable to load Site Branding."))
      .finally(() => setLoading(false));
  }, []);

  async function save(publish = false) {
    if (publish) {
      const rules: FormFieldRule[] = [
        {
          id: logoImageId,
          label: "Logo image",
          value: content.image,
          required: true,
          requiredMessage: "Choose a logo image before publishing.",
          validate: (value) =>
            isSiteLogoContent({ image: value as CmsMediaAsset | null, alt: "Logo alt text" }),
          invalidMessage: "Choose a valid uploaded logo image.",
        },
        {
          id: logoAltId,
          label: "Logo alt text",
          value: content.alt,
          required: true,
          requiredMessage: "Describe the logo for visitors using assistive technology.",
        },
      ];
      const issues = validateFormFields(rules);
      if (!isSiteLogoContent(content) && issues.length === 0) {
        issues.push({
          id: logoImageId,
          label: "Logo image",
          message: "Choose a valid uploaded logo image before publishing.",
        });
      }
      if (issues.length) {
        validation.report(issues);
        return;
      }
    }
    validation.clear();
    setSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await apiClient.put(`cms/admin/components/${GLOBAL_SITE_LOGO_TYPE}/draft`, { content });
      if (publish) {
        await apiClient.post(`cms/admin/components/${GLOBAL_SITE_LOGO_TYPE}/publish`);
        setPublished(content);
        setMessage("Logo draft saved and published.");
      } else {
        setMessage("Logo draft saved. The live navbar is unchanged until publishing.");
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save the logo.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading Site Branding…</p>;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Site Branding
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Site Branding</h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage the published studio logo used by the public navbar. Navigation, availability
          information, layout, and responsive behavior remain code-owned.
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
      <div className="grid gap-6 xl:grid-cols-2">
        <FormSection
          description="Only a published logo is shown on the public website."
          title="Published logo"
        >
          <LogoPreview alt={published?.alt ?? ""} asset={published?.image ?? null} />
          {published?.alt ? (
            <p className="text-xs text-muted-foreground">Alt text: {published.alt}</p>
          ) : null}
        </FormSection>
        <FormSection
          description="Draft changes remain private until an authorized user publishes them."
          title="Logo draft"
        >
          <ImageUploadField
            description="Required when publishing. JPEG, PNG, WebP, or AVIF · Maximum 10 MB"
            error={fieldErrorMessage(validation.errors, logoImageId)}
            id={logoImageId}
            label="Logo image"
            onChange={(image) => {
              validation.clear(logoImageId);
              setContent((current) => ({
                ...current,
                image: image
                  ? {
                      publicId: image.publicId,
                      url: image.url,
                      width: image.width,
                      height: image.height,
                    }
                  : null,
              }));
            }}
            required
            value={content.image ? { ...content.image, alt: content.alt } : undefined}
          />
          <TextField
            description="Required when publishing. Describe the logo for visitors using assistive technology."
            error={fieldErrorMessage(validation.errors, logoAltId)}
            id={logoAltId}
            label="Alt text"
            onChange={(event) => {
              validation.clear(logoAltId);
              setContent((current) => ({ ...current, alt: event.target.value }));
            }}
            required
            value={content.alt}
          />
        </FormSection>
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <ActionButton loading={saving} onClick={() => void save()} type="button" variant="outline">
          Save draft
        </ActionButton>
        <ActionButton
          disabled={role === "EDITOR"}
          loading={saving}
          onClick={() => void save(true)}
          type="button"
        >
          {role === "EDITOR" ? "Publish unavailable to Editor" : "Publish logo"}
        </ActionButton>
      </div>
    </section>
  );
}
