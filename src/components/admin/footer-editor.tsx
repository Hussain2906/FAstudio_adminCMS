"use client";

import type {
  CmsImage,
  CmsMediaAsset,
  FooterContent,
  FooterLink,
  FooterSocial,
} from "@fs/cms-contracts";
import {
  footerDefaultContent,
  getFooterContentIssues,
  GLOBAL_FOOTER_TYPE,
} from "@fs/cms-contracts";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  formFieldId,
  validateFormFields,
  type FormFieldIssue,
  type FormFieldRule,
} from "../../features/cms/form-validation";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  fieldErrorMessage,
  FormError,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
  SelectField,
  SwitchField,
  TextareaField,
  TextField,
  useFormFieldErrors,
} from "./form-controls";

type Response = { draftContent: FooterContent; publishedContent: FooterContent | null };
type LinkSection = "explore" | "services";
type LinkField = "label" | "href" | "enabled" | "remove";
type SocialField = "platform" | "href" | "enabled" | "remove";

const footerFormId = "global-footer";
const footerFieldId = (fieldName: string) => formFieldId(footerFormId, fieldName);
const footerLinkFieldId = (section: LinkSection, index: number, field: LinkField) =>
  footerFieldId(`${section}-${index}-${field}`);
const footerSocialFieldId = (index: number, field: SocialField) =>
  footerFieldId(`social-${index}-${field}`);
const socialPlatforms = ["Instagram", "YouTube", "Pinterest", "LinkedIn"] as const;
const textFields: readonly [keyof FooterContent, string][] = [
  ["brandName", "Brand name"],
  ["brandSubtitle", "Subtitle"],
  ["description", "Brand description"],
  ["backgroundAlt", "Image alt text"],
  ["exploreHeading", "Explore column heading"],
  ["servicesHeading", "Services column heading"],
  ["location", "Location"],
  ["email", "Email"],
  ["phone", "Phone"],
  ["copyright", "Copyright text"],
  ["privacyHref", "Privacy Policy URL"],
  ["termsHref", "Terms of Use URL"],
];
const directFieldNames = new Set([
  "enabled",
  "logo",
  "background",
  ...textFields.map(([key]) => key),
]);
const linkTitles: Record<LinkSection, string> = { explore: "Explore", services: "Services" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function asString(value: unknown): string {
  return isString(value) ? value : "";
}

function asBoolean(value: unknown): boolean {
  return isBoolean(value) ? value : false;
}

function isMediaAsset(value: unknown): value is CmsMediaAsset {
  if (!isRecord(value)) return false;
  return (
    typeof value.publicId === "string" &&
    value.publicId.trim().length > 0 &&
    typeof value.url === "string" &&
    value.url.trim().length > 0 &&
    typeof value.width === "number" &&
    value.width > 0 &&
    typeof value.height === "number" &&
    value.height > 0
  );
}

function isOptionalMediaAsset(value: unknown): boolean {
  return value === null || isMediaAsset(value);
}

function isSocialPlatform(value: unknown): value is (typeof socialPlatforms)[number] {
  return typeof value === "string" && (socialPlatforms as readonly string[]).includes(value);
}

function imageValue(asset: unknown, alt: unknown): CmsImage | undefined {
  if (!isMediaAsset(asset)) return undefined;
  return { ...asset, alt: asString(alt) } as CmsImage;
}

function getLinkItems(content: FooterContent, section: LinkSection): unknown[] {
  const value = (content as unknown as Record<string, unknown>)[section];
  return Array.isArray(value) ? value : [];
}

function getSocialItems(content: FooterContent): unknown[] {
  const value = (content as unknown as Record<string, unknown>).socials;
  return Array.isArray(value) ? value : [];
}

function buildFooterShapeRules(content: FooterContent): FormFieldRule[] {
  const source = content as unknown as Record<string, unknown>;
  const rules: FormFieldRule[] = [
    {
      id: footerFieldId("enabled"),
      label: "Footer visibility",
      value: source.enabled,
      validate: isBoolean,
      invalidMessage: "Choose whether the footer is visible on public pages.",
    },
    {
      id: footerFieldId("logo"),
      label: "Footer logo",
      value: source.logo,
      validate: isOptionalMediaAsset,
      invalidMessage: "Choose a valid logo image or select a replacement.",
    },
    {
      id: footerFieldId("background"),
      label: "Footer background image",
      value: source.background,
      validate: isOptionalMediaAsset,
      invalidMessage: "Choose a valid background image or select a replacement.",
    },
    ...textFields.map(([key, label]) => ({
      id: footerFieldId(key),
      label,
      value: source[key],
      validate: isString,
      invalidMessage: `${label} must be text. Review this field before saving.`,
    })),
  ];

  (["explore", "services"] as const).forEach((section) => {
    const listValue = source[section];
    const title = linkTitles[section];
    rules.push({
      id: footerFieldId(`${section}-add`),
      label: `${title} links`,
      value: listValue,
      validate: Array.isArray,
      invalidMessage: `The ${title.toLowerCase()} links list is not valid. Add a new item to replace it.`,
    });
    if (!Array.isArray(listValue)) return;

    listValue.forEach((item, index) => {
      const row = isRecord(item) ? item : undefined;
      const labelId = footerLinkFieldId(section, index, "label");
      if (!row) {
        rules.push({
          id: labelId,
          label: `${title} link ${index + 1}`,
          value: item,
          validate: isRecord,
          invalidMessage: "This link row is not valid. Replace its label or remove it.",
        });
        return;
      }
      rules.push(
        {
          id: labelId,
          label: `${title} link ${index + 1} label`,
          value: row.label,
          validate: isString,
          invalidMessage: "The link label must be text.",
        },
        {
          id: footerLinkFieldId(section, index, "href"),
          label: `${title} link ${index + 1} destination URL`,
          value: row.href,
          validate: isString,
          invalidMessage: "The destination URL must be text.",
        },
        {
          id: footerLinkFieldId(section, index, "enabled"),
          label: `${title} link ${index + 1} visibility`,
          value: row.enabled,
          validate: isBoolean,
          invalidMessage: "Choose whether this link is enabled.",
        },
        {
          id: footerLinkFieldId(section, index, "remove"),
          label: `${title} link ${index + 1}`,
          value: row.id,
          validate: isString,
          invalidMessage:
            "This link has an invalid internal identifier. Remove it and add it again.",
        },
      );
    });
  });

  const socialsValue = source.socials;
  rules.push({
    id: footerFieldId("socials-add"),
    label: "Social links",
    value: socialsValue,
    validate: Array.isArray,
    invalidMessage: "The social links list is not valid. Add a social link to replace it.",
  });
  if (Array.isArray(socialsValue)) {
    socialsValue.forEach((item, index) => {
      const row = isRecord(item) ? item : undefined;
      const platformId = footerSocialFieldId(index, "platform");
      if (!row) {
        rules.push({
          id: platformId,
          label: `Social link ${index + 1} platform`,
          value: item,
          validate: isRecord,
          invalidMessage: "This social link row is not valid. Choose a platform or remove the row.",
        });
        return;
      }
      rules.push(
        {
          id: platformId,
          label: `Social link ${index + 1} platform`,
          value: row.platform,
          validate: isSocialPlatform,
          invalidMessage: "Choose Instagram, YouTube, Pinterest, or LinkedIn.",
        },
        {
          id: footerSocialFieldId(index, "href"),
          label: `Social link ${index + 1} URL`,
          value: row.href,
          validate: isString,
          invalidMessage: "The social link URL must be text.",
        },
        {
          id: footerSocialFieldId(index, "enabled"),
          label: `Social link ${index + 1} visibility`,
          value: row.enabled,
          validate: isBoolean,
          invalidMessage: "Choose whether this social link is enabled.",
        },
        {
          id: footerSocialFieldId(index, "remove"),
          label: `Social link ${index + 1}`,
          value: row.id,
          validate: isString,
          invalidMessage:
            "This social link has an invalid internal identifier. Remove it and add it again.",
        },
      );
    });
  }

  return rules;
}

function footerPathTargets(path: string): string[] | undefined {
  if (path === "content") return undefined;
  if (directFieldNames.has(path)) return [footerFieldId(path)];
  if (path === "explore" || path === "services") {
    return [footerFieldId(`${path}-add`)];
  }
  if (path === "socials") return [footerFieldId("socials-add")];

  const linkRow = /^(explore|services)\[(\d+)\]$/.exec(path);
  if (linkRow) {
    const section = linkRow[1] as LinkSection;
    const index = Number(linkRow[2]);
    return (["label", "href", "enabled", "remove"] as const).map((field) =>
      footerLinkFieldId(section, index, field),
    );
  }

  const socialField = /^socials\[(\d+)\]\.(platform|id|href|enabled)$/.exec(path);
  if (socialField) {
    const index = Number(socialField[1]);
    const field =
      socialField[2] === "id" ? "remove" : (socialField[2] as Exclude<SocialField, "remove">);
    return [footerSocialFieldId(index, field)];
  }

  const socialRow = /^socials\[(\d+)\]$/.exec(path);
  if (socialRow) return [footerSocialFieldId(Number(socialRow[1]), "platform")];

  return undefined;
}

function fallbackIssueForPath(path: string, id: string): FormFieldIssue {
  const row = /^(explore|services)\[(\d+)\]$/.exec(path);
  if (row) {
    return {
      id,
      label: `${linkTitles[row[1] as LinkSection]} link ${Number(row[2]) + 1}`,
      message: "This link row is not valid. Correct its fields or remove it and add it again.",
    };
  }

  const social = /^socials\[(\d+)\](?:\.(platform|id|href|enabled))?$/.exec(path);
  if (social) {
    return {
      id,
      label: `Social link ${Number(social[1]) + 1}`,
      message:
        "This social link row is not valid. Correct its fields or remove it and add it again.",
    };
  }

  const labels: Record<string, string> = {
    enabled: "Footer visibility",
    logo: "Footer logo",
    background: "Footer background image",
    ...Object.fromEntries(textFields),
  };
  const label = labels[path] ?? "Footer content";
  return {
    id,
    label,
    message: `${label} does not match the required content structure. Review this field before saving.`,
  };
}

function validateFooterContent(content: FooterContent) {
  const contractPaths = getFooterContentIssues(content);
  const issuesById = new Map(
    validateFormFields(buildFooterShapeRules(content)).map((issue) => [issue.id, issue]),
  );
  const unmappedPaths: string[] = [];

  contractPaths.forEach((path) => {
    const targets = footerPathTargets(path);
    if (!targets) {
      unmappedPaths.push(path);
      return;
    }
    if (!targets.some((id) => issuesById.has(id))) {
      issuesById.set(targets[0], fallbackIssueForPath(path, targets[0]));
    }
  });

  return { fieldIssues: [...issuesById.values()], unmappedPaths };
}

export function FooterEditor() {
  const [content, setContent] = useState<FooterContent>(footerDefaultContent);
  const [published, setPublished] = useState<FooterContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fieldErrors = useFormFieldErrors();

  useEffect(() => {
    apiClient
      .get<Response>(`cms/admin/components/${GLOBAL_FOOTER_TYPE}`)
      .then((response) => {
        setContent(response.draftContent);
        setPublished(response.publishedContent);
      })
      .catch(() => setError("Unable to load footer settings."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof FooterContent>(
    key: K,
    value: FooterContent[K],
    fieldId?: string,
  ) {
    setContent((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
    if (fieldId) fieldErrors.clear(fieldId);
    else fieldErrors.clear();
  }

  function editItems(
    section: LinkSection,
    index: number,
    patch: Partial<FooterLink>,
    fieldId: string,
  ) {
    const items = getLinkItems(content, section);
    const current = items[index];
    const fallback: FooterLink = { id: crypto.randomUUID(), label: "", href: "/", enabled: true };
    items[index] = { ...(isRecord(current) ? current : fallback), ...patch } as FooterLink;
    update(section, items as FooterContent[typeof section], fieldId);
  }

  function moveLink(section: LinkSection, index: number, delta: number) {
    const items = getLinkItems(content, section);
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update(section, items as FooterContent[typeof section]);
  }

  function editSocial(index: number, patch: Partial<FooterSocial>, fieldId: string) {
    const items = getSocialItems(content);
    const current = items[index];
    const fallback: FooterSocial = {
      id: crypto.randomUUID(),
      platform: "Instagram",
      href: "",
      enabled: true,
    };
    items[index] = { ...(isRecord(current) ? current : fallback), ...patch } as FooterSocial;
    update("socials", items as FooterContent["socials"], fieldId);
  }

  function moveSocial(index: number, delta: number) {
    const items = getSocialItems(content);
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update("socials", items as FooterContent["socials"]);
  }

  async function save(publish = false) {
    setError("");
    setMessage("");
    const validation = validateFooterContent(content);
    fieldErrors.report(validation.fieldIssues);
    if (validation.fieldIssues.length > 0 || validation.unmappedPaths.length > 0) {
      if (validation.unmappedPaths.length > 0) {
        setError(
          "Some footer content could not be linked to an editable field. Refresh the draft and try again; no changes were saved.",
        );
      }
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`cms/admin/components/${GLOBAL_FOOTER_TYPE}/draft`, { content });
      if (publish) {
        await apiClient.post(`cms/admin/components/${GLOBAL_FOOTER_TYPE}/publish`);
        setPublished(content);
        setMessage("Footer saved and published.");
      } else {
        setMessage("Draft saved. The storefront remains unchanged until publishing.");
      }
      fieldErrors.report([]);
    } catch (cause) {
      fieldErrors.report([]);
      setError(cause instanceof ApiError ? cause.message : "Unable to save footer.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading Footer Management…</p>;

  const links = (section: LinkSection) => {
    const items = getLinkItems(content, section);
    const title = linkTitles[section];
    const addId = footerFieldId(`${section}-add`);
    const addError = fieldErrorMessage(fieldErrors.errors, addId);

    return (
      <div className="space-y-4">
        {items.map((item, index) => {
          const row = isRecord(item) ? item : {};
          const labelId = footerLinkFieldId(section, index, "label");
          const hrefId = footerLinkFieldId(section, index, "href");
          const enabledId = footerLinkFieldId(section, index, "enabled");
          const removeId = footerLinkFieldId(section, index, "remove");
          const removeError = fieldErrorMessage(fieldErrors.errors, removeId);

          return (
            <div
              className="grid items-end gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_1fr_auto]"
              key={`${section}-${index}`}
            >
              <TextField
                error={fieldErrorMessage(fieldErrors.errors, labelId)}
                id={labelId}
                label="Label"
                onChange={(event) =>
                  editItems(section, index, { label: event.target.value }, labelId)
                }
                value={asString(row.label)}
              />
              <TextField
                error={fieldErrorMessage(fieldErrors.errors, hrefId)}
                id={hrefId}
                label="Destination URL"
                onChange={(event) =>
                  editItems(section, index, { href: event.target.value }, hrefId)
                }
                value={asString(row.href)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <SwitchField
                  checked={asBoolean(row.enabled)}
                  error={fieldErrorMessage(fieldErrors.errors, enabledId)}
                  id={enabledId}
                  label="Enabled"
                  onChange={(enabled) => editItems(section, index, { enabled }, enabledId)}
                />
                <button
                  aria-label={`Move ${title.toLowerCase()} link ${index + 1} up`}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onClick={() => moveLink(section, index, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move ${title.toLowerCase()} link ${index + 1} down`}
                  className="rounded-md border border-border px-3 py-2 text-sm"
                  onClick={() => moveLink(section, index, 1)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-describedby={removeError ? `${removeId}-error` : undefined}
                  aria-label={`Remove ${title.toLowerCase()} link ${index + 1}`}
                  className="rounded-md border border-border px-3 py-2 text-sm text-destructive"
                  id={removeId}
                  onClick={() =>
                    update(
                      section,
                      items.filter(
                        (_, rowIndex) => rowIndex !== index,
                      ) as FooterContent[typeof section],
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
                <FormError id={`${removeId}-error`}>{removeError}</FormError>
              </div>
            </div>
          );
        })}
        <ActionButton
          aria-describedby={addError ? `${addId}-error` : undefined}
          id={addId}
          onClick={() =>
            update(section, [
              ...items,
              { id: crypto.randomUUID(), label: "New link", href: "/", enabled: true },
            ] as FooterContent[typeof section])
          }
          type="button"
          variant="outline"
        >
          Add item
        </ActionButton>
        <FormError id={`${addId}-error`}>{addError}</FormError>
      </div>
    );
  };

  const socials = getSocialItems(content);
  const socialsAddId = footerFieldId("socials-add");
  const socialsAddError = fieldErrorMessage(fieldErrors.errors, socialsAddId);
  const publishedAsset = published?.background;
  const publishedBackground = isMediaAsset(publishedAsset) ? publishedAsset.url : "";

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Global Footer
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Footer Management</h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage the global storefront footer. Draft changes stay private until publishing.
        </p>
      </header>

      <FormErrorSummary errors={fieldErrors.errors} focusKey={fieldErrors.focusKey} />
      {error ? (
        <p
          aria-live="polite"
          className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          role="status"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p
          aria-live="polite"
          className="rounded-lg bg-success/10 p-3 text-sm text-success"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <FormSection title="Visibility">
        <SwitchField
          checked={asBoolean(content.enabled)}
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("enabled"))}
          id={footerFieldId("enabled")}
          label="Show footer on public pages"
          onChange={(value) => update("enabled", value, footerFieldId("enabled"))}
        />
      </FormSection>

      <FormSection
        description="The logo configured in Site Branding can be selected through the media library."
        title="Branding"
      >
        <ImageUploadField
          allowLibrary
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("logo"))}
          id={footerFieldId("logo")}
          label="Footer logo"
          onChange={(value) =>
            update(
              "logo",
              value
                ? {
                    publicId: value.publicId,
                    url: value.url,
                    width: value.width,
                    height: value.height,
                  }
                : null,
              footerFieldId("logo"),
            )
          }
          value={imageValue(content.logo, content.brandName)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("brandName"))}
            id={footerFieldId("brandName")}
            label="Brand name"
            onChange={(event) =>
              update("brandName", event.target.value, footerFieldId("brandName"))
            }
            value={asString(content.brandName)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("brandSubtitle"))}
            id={footerFieldId("brandSubtitle")}
            label="Subtitle"
            onChange={(event) =>
              update("brandSubtitle", event.target.value, footerFieldId("brandSubtitle"))
            }
            value={asString(content.brandSubtitle)}
          />
        </div>
        <TextareaField
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("description"))}
          id={footerFieldId("description")}
          label="Brand description"
          onChange={(event) =>
            update("description", event.target.value, footerFieldId("description"))
          }
          value={asString(content.description)}
        />
      </FormSection>

      <FormSection
        description="Decorative image; upload or choose an existing Cloudinary asset. A semantic theme surface is used when absent."
        title="Background image"
      >
        <ImageUploadField
          allowLibrary
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("background"))}
          id={footerFieldId("background")}
          label="Footer background"
          onChange={(value) =>
            update(
              "background",
              value
                ? {
                    publicId: value.publicId,
                    url: value.url,
                    width: value.width,
                    height: value.height,
                  }
                : null,
              footerFieldId("background"),
            )
          }
          value={imageValue(content.background, content.backgroundAlt)}
        />
        <TextField
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("backgroundAlt"))}
          id={footerFieldId("backgroundAlt")}
          label="Image alt text (optional for decorative background)"
          onChange={(event) =>
            update("backgroundAlt", event.target.value, footerFieldId("backgroundAlt"))
          }
          value={asString(content.backgroundAlt)}
        />
        {publishedBackground ? (
          <div className="relative aspect-[3/1] overflow-hidden rounded-lg">
            <Image
              alt="Published footer background preview"
              className="object-cover"
              fill
              sizes="100vw"
              src={publishedBackground}
            />
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Explore links">
        <TextField
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("exploreHeading"))}
          id={footerFieldId("exploreHeading")}
          label="Column heading"
          onChange={(event) =>
            update("exploreHeading", event.target.value, footerFieldId("exploreHeading"))
          }
          value={asString(content.exploreHeading)}
        />
        {links("explore")}
      </FormSection>

      <FormSection title="Services">
        <TextField
          error={fieldErrorMessage(fieldErrors.errors, footerFieldId("servicesHeading"))}
          id={footerFieldId("servicesHeading")}
          label="Column heading"
          onChange={(event) =>
            update("servicesHeading", event.target.value, footerFieldId("servicesHeading"))
          }
          value={asString(content.servicesHeading)}
        />
        {links("services")}
      </FormSection>

      <FormSection title="Contact">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("location"))}
            id={footerFieldId("location")}
            label="Location"
            onChange={(event) => update("location", event.target.value, footerFieldId("location"))}
            value={asString(content.location)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("email"))}
            id={footerFieldId("email")}
            label="Email"
            onChange={(event) => update("email", event.target.value, footerFieldId("email"))}
            type="email"
            value={asString(content.email)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("phone"))}
            id={footerFieldId("phone")}
            label="Phone"
            onChange={(event) => update("phone", event.target.value, footerFieldId("phone"))}
            type="tel"
            value={asString(content.phone)}
          />
        </div>
      </FormSection>

      <FormSection
        description="Supported platforms: Instagram, YouTube, Pinterest, LinkedIn."
        title="Social links"
      >
        {socials.map((social, index) => {
          const row = isRecord(social) ? social : {};
          const platformId = footerSocialFieldId(index, "platform");
          const hrefId = footerSocialFieldId(index, "href");
          const enabledId = footerSocialFieldId(index, "enabled");
          const removeId = footerSocialFieldId(index, "remove");
          const removeError = fieldErrorMessage(fieldErrors.errors, removeId);

          return (
            <div className="grid gap-3 sm:grid-cols-3" key={`social-${index}`}>
              <SelectField
                error={fieldErrorMessage(fieldErrors.errors, platformId)}
                id={platformId}
                label="Platform"
                onChange={(event) =>
                  editSocial(
                    index,
                    { platform: event.target.value as FooterSocial["platform"] },
                    platformId,
                  )
                }
                value={asString(row.platform)}
              >
                <option>Instagram</option>
                <option>YouTube</option>
                <option>Pinterest</option>
                <option>LinkedIn</option>
              </SelectField>
              <TextField
                error={fieldErrorMessage(fieldErrors.errors, hrefId)}
                id={hrefId}
                label="URL"
                onChange={(event) => editSocial(index, { href: event.target.value }, hrefId)}
                value={asString(row.href)}
              />
              <div className="flex flex-wrap items-center gap-2">
                <SwitchField
                  checked={asBoolean(row.enabled)}
                  error={fieldErrorMessage(fieldErrors.errors, enabledId)}
                  id={enabledId}
                  label="Enabled"
                  onChange={(value) => editSocial(index, { enabled: value }, enabledId)}
                />
                <button
                  aria-label={`Move social link ${index + 1} up`}
                  className="rounded border border-border px-2 py-1 text-sm"
                  onClick={() => moveSocial(index, -1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label={`Move social link ${index + 1} down`}
                  className="rounded border border-border px-2 py-1 text-sm"
                  onClick={() => moveSocial(index, 1)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-describedby={removeError ? `${removeId}-error` : undefined}
                  aria-label={`Remove social link ${index + 1}`}
                  className="text-sm text-destructive"
                  id={removeId}
                  onClick={() =>
                    update(
                      "socials",
                      socials.filter(
                        (_, rowIndex) => rowIndex !== index,
                      ) as FooterContent["socials"],
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
                <FormError id={`${removeId}-error`}>{removeError}</FormError>
              </div>
            </div>
          );
        })}
        <ActionButton
          aria-describedby={socialsAddError ? `${socialsAddId}-error` : undefined}
          id={socialsAddId}
          onClick={() =>
            update("socials", [
              ...socials,
              { id: crypto.randomUUID(), platform: "Instagram", href: "", enabled: true },
            ] as FooterContent["socials"])
          }
          type="button"
          variant="outline"
        >
          Add social link
        </ActionButton>
        <FormError id={`${socialsAddId}-error`}>{socialsAddError}</FormError>
      </FormSection>

      <FormSection title="Bottom bar">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("copyright"))}
            id={footerFieldId("copyright")}
            label="Copyright text"
            onChange={(event) =>
              update("copyright", event.target.value, footerFieldId("copyright"))
            }
            value={asString(content.copyright)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("privacyHref"))}
            id={footerFieldId("privacyHref")}
            label="Privacy Policy URL"
            onChange={(event) =>
              update("privacyHref", event.target.value, footerFieldId("privacyHref"))
            }
            value={asString(content.privacyHref)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, footerFieldId("termsHref"))}
            id={footerFieldId("termsHref")}
            label="Terms of Use URL"
            onChange={(event) =>
              update("termsHref", event.target.value, footerFieldId("termsHref"))
            }
            value={asString(content.termsHref)}
          />
        </div>
        <p className="text-xs text-muted-foreground">The current year is added automatically.</p>
      </FormSection>

      <div className="flex justify-end gap-3">
        <ActionButton loading={saving} onClick={() => void save()} type="button" variant="outline">
          Save draft
        </ActionButton>
        <ActionButton loading={saving} onClick={() => void save(true)} type="button">
          Publish footer
        </ActionButton>
      </div>
    </section>
  );
}
