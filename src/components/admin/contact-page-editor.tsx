"use client";

import {
  CONTACT_PAGE_TYPE,
  contactPageDefaultContent,
  isContactPageContent,
  isContactPageDraftContent,
  type CmsImage,
  type CmsMediaAsset,
  type ContactPageContent,
} from "@fs/cms-contracts";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  formFieldId,
  validateFormFields,
  type FormFieldRule,
} from "../../features/cms/form-validation";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  FormError,
  FormErrorSummary,
  FormSection,
  ImageUploadField,
  TextField,
  TextareaField,
  fieldErrorMessage,
  useFormFieldErrors,
} from "./form-controls";

const FORM_ID = "contact-page";
const contactFieldId = (field: string) => formFieldId(FORM_ID, field);
type SavingAction = "draft" | "publish" | null;

type DraftSection = {
  id: string;
  type: string;
  draftContent: unknown;
  publishedContent: unknown | null;
  draftIsVisible: boolean;
  publishedIsVisible?: boolean;
};
type DraftPage = { id: string; sections: DraftSection[] };

type ContactTextKey =
  | "eyebrow"
  | "heading"
  | "description"
  | "formHeading"
  | "formDescription"
  | "nameLabel"
  | "emailLabel"
  | "phoneLabel"
  | "projectTypeLabel"
  | "messageLabel"
  | "submitLabel"
  | "successMessage"
  | "unavailableMessage"
  | "imageAlt";

const textRules: readonly {
  key: ContactTextKey;
  label: string;
  maxLength: number;
}[] = [
  { key: "eyebrow", label: "Page eyebrow", maxLength: 80 },
  { key: "heading", label: "Page heading", maxLength: 160 },
  { key: "description", label: "Page introduction", maxLength: 480 },
  { key: "formHeading", label: "Form heading", maxLength: 120 },
  { key: "formDescription", label: "Form introduction", maxLength: 240 },
  { key: "nameLabel", label: "Name field label", maxLength: 80 },
  { key: "emailLabel", label: "Email field label", maxLength: 80 },
  { key: "phoneLabel", label: "Phone field label", maxLength: 80 },
  { key: "projectTypeLabel", label: "Service field label", maxLength: 100 },
  { key: "messageLabel", label: "Message field label", maxLength: 100 },
  { key: "submitLabel", label: "Submit button label", maxLength: 80 },
  { key: "successMessage", label: "Success message", maxLength: 180 },
  { key: "unavailableMessage", label: "Unavailable message", maxLength: 240 },
  { key: "imageAlt", label: "Contact image alt text", maxLength: 240 },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isValidMediaAsset(value: unknown): value is CmsMediaAsset {
  if (!isRecord(value)) return false;
  if (
    typeof value.publicId !== "string" ||
    !value.publicId.trim() ||
    typeof value.url !== "string" ||
    typeof value.width !== "number" ||
    !Number.isFinite(value.width) ||
    value.width <= 0 ||
    typeof value.height !== "number" ||
    !Number.isFinite(value.height) ||
    value.height <= 0
  ) {
    return false;
  }
  try {
    const url = new URL(value.url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function imageForField(image: CmsMediaAsset | null, alt: string): CmsImage | undefined {
  return image ? { ...image, alt } : undefined;
}

function mediaAssetFromField(image: CmsImage): CmsMediaAsset {
  return {
    publicId: image.publicId,
    url: image.url,
    width: image.width,
    height: image.height,
  };
}

function contactRules(content: ContactPageContent, publish: boolean): FormFieldRule[] {
  const rules: FormFieldRule[] = textRules.map(({ key, label, maxLength }) => ({
    id: contactFieldId(key),
    label,
    value: content[key],
    required: publish && (key !== "imageAlt" || content.image !== null),
    maxLength,
  }));

  rules.push({
    id: contactFieldId("image"),
    label: "Contact image",
    value: content.image,
    validate: (value) => value === null || isValidMediaAsset(value),
    invalidMessage: "Choose a valid image from the Cloudinary media library or upload one.",
  });
  rules.push({
    id: contactFieldId("projectTypes"),
    label: "Service choices",
    value: content.projectTypes,
    minItems: publish ? 1 : undefined,
    minItemsMessage: "Add at least one service choice before publishing.",
    validate: (value) => Array.isArray(value) && value.length <= 12,
    invalidMessage: "Use no more than 12 service choices.",
  });

  content.projectTypes.forEach((choice, index) => {
    const normalized = choice.trim().toLowerCase();
    rules.push({
      id: contactFieldId(`projectType-${index}`),
      label: `Service choice ${index + 1}`,
      value: choice,
      required: true,
      maxLength: 80,
      validate: (value) =>
        typeof value === "string" &&
        content.projectTypes.filter((item) => item.trim().toLowerCase() === normalized).length ===
          1,
      invalidMessage:
        "Service choices must be unique, ignoring letter case and surrounding spaces.",
    });
  });

  return rules;
}

export function ContactPageEditor() {
  const [section, setSection] = useState<DraftSection | null>(null);
  const [content, setContent] = useState<ContactPageContent>(contactPageDefaultContent);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [missingSection, setMissingSection] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const validation = useFormFieldErrors();

  useEffect(() => {
    let active = true;
    apiClient
      .get<DraftPage>("cms/admin/pages/contact")
      .then((page) => {
        if (!active) return;
        const found = page.sections.find((candidate) => candidate.type === CONTACT_PAGE_TYPE);
        if (!found) {
          setMissingSection(true);
          return;
        }
        setSection(found);
        if (isContactPageDraftContent(found.draftContent)) {
          setContent(found.draftContent);
        } else {
          setError(
            "The Contact draft has an unsupported structure. Reload it before editing so no CMS content is lost.",
          );
        }
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof ApiError ? cause.message : "Unable to load the Contact page draft.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateContent<K extends keyof ContactPageContent>(
    key: K,
    value: ContactPageContent[K],
    field?: string,
  ) {
    setContent((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
    if (field) validation.clear(field);
    else validation.clear();
  }

  function updateServiceChoice(index: number, value: string) {
    const choices = [...content.projectTypes];
    choices[index] = value;
    updateContent("projectTypes", choices);
  }

  function addServiceChoice() {
    if (content.projectTypes.length >= 12) return;
    updateContent("projectTypes", [...content.projectTypes, ""]);
  }

  function removeServiceChoice(index: number) {
    updateContent(
      "projectTypes",
      content.projectTypes.filter((_, choiceIndex) => choiceIndex !== index),
    );
  }

  async function save(publish = false) {
    if (!section) return;
    setError("");
    setMessage("");

    const issues = validateFormFields(contactRules(content, publish));
    const validDraft = isContactPageDraftContent(content);
    const validPublished = !publish || isContactPageContent(content);
    if (issues.length || !validDraft || !validPublished) {
      validation.report(
        issues.length
          ? issues
          : [
              {
                id: contactFieldId("heading"),
                label: "Contact page content",
                message:
                  "Review the page copy, service choices, and optional image details before saving.",
              },
            ],
      );
      return;
    }

    validation.clear();
    setSaving(publish ? "publish" : "draft");
    try {
      const saved = await apiClient.patch<DraftSection>(`cms/admin/sections/${section.id}`, {
        content,
        isVisible: true,
      });
      setSection(saved);
      if (!publish) {
        setMessage(
          "Draft saved. The public Contact page is unchanged until you publish this section.",
        );
        return;
      }
      try {
        const published = await apiClient.post<DraftSection>(
          `cms/admin/sections/${section.id}/publish`,
        );
        setSection(published);
        setMessage("Contact page content published.");
      } catch (cause) {
        setError(
          `${cause instanceof ApiError ? cause.message : "Publishing failed."} The draft was saved; the published version is unchanged.`,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the Contact page draft.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="space-y-4">
        <h1 className="text-3xl font-semibold">Contact page content</h1>
        <p className="text-muted-foreground">Loading Contact page draft…</p>
      </section>
    );
  }

  if (missingSection) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Website CMS / Contact
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Contact page content
          </h1>
        </header>
        <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
          The Contact page section has not been added to the CMS page yet. No content has been
          changed.
        </p>
      </section>
    );
  }

  if (!section) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Website CMS / Contact
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Contact page content
          </h1>
        </header>
        {error ? (
          <p
            aria-live="polite"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}
      </section>
    );
  }

  const publishedContent = isContactPageContent(section.publishedContent)
    ? section.publishedContent
    : null;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Contact
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Contact page content</h1>
        <p className="max-w-3xl text-muted-foreground">
          Edit the public Contact page copy, form labels, service choices, and optional image.
          Public email and phone details are managed separately in the global Footer.
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)]">
        <div className="space-y-6">
          <FormSection
            title="Page introduction"
            description="These fields control the Contact page heading and introductory copy."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={contactFieldId("eyebrow")}
                label="Page eyebrow"
                maxLength={80}
                value={content.eyebrow}
                onChange={(event) =>
                  updateContent("eyebrow", event.target.value, contactFieldId("eyebrow"))
                }
              />
              <TextField
                id={contactFieldId("heading")}
                label="Page heading"
                maxLength={160}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("heading"))}
                value={content.heading}
                onChange={(event) =>
                  updateContent("heading", event.target.value, contactFieldId("heading"))
                }
              />
            </div>
            <TextareaField
              id={contactFieldId("description")}
              label="Page introduction"
              maxLength={480}
              required
              error={fieldErrorMessage(validation.errors, contactFieldId("description"))}
              value={content.description}
              onChange={(event) =>
                updateContent("description", event.target.value, contactFieldId("description"))
              }
            />
          </FormSection>

          <FormSection
            title="Enquiry form copy and labels"
            description="These labels and messages are part of the public enquiry form. The form's delivery settings are managed separately."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={contactFieldId("formHeading")}
                label="Form heading"
                maxLength={120}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("formHeading"))}
                value={content.formHeading}
                onChange={(event) =>
                  updateContent("formHeading", event.target.value, contactFieldId("formHeading"))
                }
              />
              <TextareaField
                id={contactFieldId("formDescription")}
                label="Form introduction"
                maxLength={240}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("formDescription"))}
                value={content.formDescription}
                onChange={(event) =>
                  updateContent(
                    "formDescription",
                    event.target.value,
                    contactFieldId("formDescription"),
                  )
                }
              />
              <TextField
                id={contactFieldId("nameLabel")}
                label="Name field label"
                maxLength={80}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("nameLabel"))}
                value={content.nameLabel}
                onChange={(event) =>
                  updateContent("nameLabel", event.target.value, contactFieldId("nameLabel"))
                }
              />
              <TextField
                id={contactFieldId("emailLabel")}
                label="Email field label"
                maxLength={80}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("emailLabel"))}
                value={content.emailLabel}
                onChange={(event) =>
                  updateContent("emailLabel", event.target.value, contactFieldId("emailLabel"))
                }
              />
              <TextField
                id={contactFieldId("phoneLabel")}
                label="Phone field label"
                maxLength={80}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("phoneLabel"))}
                value={content.phoneLabel}
                onChange={(event) =>
                  updateContent("phoneLabel", event.target.value, contactFieldId("phoneLabel"))
                }
              />
              <TextField
                id={contactFieldId("projectTypeLabel")}
                label="Service field label"
                maxLength={100}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("projectTypeLabel"))}
                value={content.projectTypeLabel}
                onChange={(event) =>
                  updateContent(
                    "projectTypeLabel",
                    event.target.value,
                    contactFieldId("projectTypeLabel"),
                  )
                }
              />
              <TextField
                id={contactFieldId("messageLabel")}
                label="Message field label"
                maxLength={100}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("messageLabel"))}
                value={content.messageLabel}
                onChange={(event) =>
                  updateContent("messageLabel", event.target.value, contactFieldId("messageLabel"))
                }
              />
              <TextField
                id={contactFieldId("submitLabel")}
                label="Submit button label"
                maxLength={80}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("submitLabel"))}
                value={content.submitLabel}
                onChange={(event) =>
                  updateContent("submitLabel", event.target.value, contactFieldId("submitLabel"))
                }
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextareaField
                id={contactFieldId("successMessage")}
                label="Success message"
                maxLength={180}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("successMessage"))}
                value={content.successMessage}
                onChange={(event) =>
                  updateContent(
                    "successMessage",
                    event.target.value,
                    contactFieldId("successMessage"),
                  )
                }
              />
              <TextareaField
                id={contactFieldId("unavailableMessage")}
                label="Unavailable message"
                maxLength={240}
                required
                error={fieldErrorMessage(validation.errors, contactFieldId("unavailableMessage"))}
                value={content.unavailableMessage}
                onChange={(event) =>
                  updateContent(
                    "unavailableMessage",
                    event.target.value,
                    contactFieldId("unavailableMessage"),
                  )
                }
              />
            </div>
          </FormSection>

          <FormSection
            title="Service choices"
            description="These choices appear in the public enquiry form. Each must be unique; up to 12 choices are supported."
          >
            <div className="space-y-4" id={contactFieldId("projectTypes")}>
              {content.projectTypes.map((choice, index) => {
                const choiceId = contactFieldId(`projectType-${index}`);
                return (
                  <div className="flex items-end gap-3" key={`${index}-${choiceId}`}>
                    <div className="min-w-0 flex-1">
                      <TextField
                        id={choiceId}
                        label={`Service choice ${index + 1}`}
                        maxLength={80}
                        required
                        error={fieldErrorMessage(validation.errors, choiceId)}
                        value={choice}
                        onChange={(event) => updateServiceChoice(index, event.target.value)}
                      />
                    </div>
                    <ActionButton
                      aria-label={`Remove service choice ${index + 1}`}
                      onClick={() => removeServiceChoice(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </ActionButton>
                  </div>
                );
              })}
            </div>
            <FormError id={`${contactFieldId("projectTypes")}-error`}>
              {fieldErrorMessage(validation.errors, contactFieldId("projectTypes"))}
            </FormError>
            <ActionButton
              disabled={content.projectTypes.length >= 12}
              onClick={addServiceChoice}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" />
              Add service choice
            </ActionButton>
          </FormSection>

          <FormSection
            title="Optional contact image"
            description="Choose an existing Cloudinary asset or upload a new image. If an image is selected, provide descriptive alt text before publishing."
          >
            <ImageUploadField
              allowLibrary
              id={contactFieldId("image")}
              label="Contact page image"
              value={imageForField(content.image, content.imageAlt)}
              error={fieldErrorMessage(validation.errors, contactFieldId("image"))}
              onChange={(image) => {
                updateContent(
                  "image",
                  image ? mediaAssetFromField(image) : null,
                  contactFieldId("image"),
                );
                updateContent("imageAlt", image?.alt ?? "", contactFieldId("imageAlt"));
              }}
            />
            <TextField
              id={contactFieldId("imageAlt")}
              label="Contact image alt text"
              maxLength={240}
              required={content.image !== null}
              error={fieldErrorMessage(validation.errors, contactFieldId("imageAlt"))}
              description={
                content.image
                  ? "Describe the visible content and purpose of the image."
                  : "Optional while no image is selected."
              }
              value={content.imageAlt}
              onChange={(event) =>
                updateContent("imageAlt", event.target.value, contactFieldId("imageAlt"))
              }
            />
          </FormSection>

          <FormSection
            title="Public contact details"
            description="Public email and phone are not stored in Contact page content. They come from the global Footer so the same details stay consistent across the site."
          >
            <div className="rounded-lg border border-info/30 bg-info/10 p-4 text-sm text-foreground">
              <p>
                To update the public email address or phone number, edit the Footer CMS content.
              </p>
              <Link
                className="mt-2 inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                href="/website/footer"
              >
                Manage public email and phone in the Footer
              </Link>
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              disabled={saving !== null}
              loading={saving === "draft"}
              onClick={() => void save(false)}
              type="button"
              variant="outline"
            >
              Save draft
            </ActionButton>
            <ActionButton
              disabled={saving !== null}
              loading={saving === "publish"}
              onClick={() => void save(true)}
              type="button"
            >
              Publish Contact page
            </ActionButton>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Published version</h2>
            {publishedContent ? (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>{publishedContent.heading}</p>
                <p>{publishedContent.projectTypes.length} service choices</p>
                <p>Contact image {publishedContent.image ? "set" : "not set"}</p>
                <p>Section {section.publishedIsVisible ? "visible" : "hidden"}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No valid Contact page content has been published yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
