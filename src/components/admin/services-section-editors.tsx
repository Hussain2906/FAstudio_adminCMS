"use client";

import {
  SERVICES_CATALOGUE_TYPE,
  SERVICES_HERO_TYPE,
  isServicesCatalogueContent,
  isServicesHeroContent,
  servicesCatalogueDefaultContent,
  servicesHeroDefaultContent,
  type CmsImage,
  type ServiceCatalogueItem,
  type ServicesCatalogueContent,
  type ServicesHeroContent,
} from "@fs/cms-contracts";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import Image from "next/image";
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
  type FormFieldIssue,
  type FormFieldRule,
} from "../../features/cms/form-validation";

type ServicesSectionType = typeof SERVICES_HERO_TYPE | typeof SERVICES_CATALOGUE_TYPE;
type DraftSection = {
  id: string;
  type: string;
  draftContent: unknown;
  publishedContent: unknown | null;
  draftIsVisible: boolean;
  publishedIsVisible?: boolean;
  draftOrder: number;
  publishedOrder?: number | null;
};
type DraftPage = { sections: DraftSection[] };
type SavingAction = "draft" | "publish" | null;
type ServicesFieldValidation = ReturnType<typeof useFormFieldErrors>;

const SERVICES_HERO_FORM_ID = "services-hero";
const SERVICES_CATALOGUE_FORM_ID = "services-catalogue";

function serviceItemFieldId(itemId: string, fieldName: string) {
  return formFieldId(SERVICES_CATALOGUE_FORM_ID, `${itemId}-${fieldName}`);
}

function isValidServicesMediaAsset(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const asset = value as Record<string, unknown>;
  if (
    typeof asset.publicId !== "string" ||
    !asset.publicId.trim() ||
    typeof asset.url !== "string" ||
    !asset.url.trim() ||
    typeof asset.width !== "number" ||
    !Number.isFinite(asset.width) ||
    asset.width <= 0 ||
    typeof asset.height !== "number" ||
    !Number.isFinite(asset.height) ||
    asset.height <= 0
  ) {
    return false;
  }
  try {
    const url = new URL(asset.url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function isSafeServiceDestination(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const destination = value.trim();
  if (!destination) return true;
  if (destination.startsWith("/") && !destination.startsWith("//") && !destination.includes("\\")) {
    return true;
  }
  if (destination.startsWith("#") && destination.length > 1) return true;
  if (!/^https:\/\/[^/]+/i.test(destination)) return false;
  try {
    const url = new URL(destination);
    return (
      url.protocol === "https:" &&
      url.hostname.length > 0 &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

function servicesHeroRules(content: ServicesHeroContent, publish: boolean): FormFieldRule[] {
  return [
    {
      id: formFieldId(SERVICES_HERO_FORM_ID, "eyebrow"),
      label: "Eyebrow",
      value: content.eyebrow,
      required: publish,
    },
    {
      id: formFieldId(SERVICES_HERO_FORM_ID, "heading"),
      label: "Heading",
      value: content.heading,
      required: publish,
    },
    {
      id: formFieldId(SERVICES_HERO_FORM_ID, "description"),
      label: "Description",
      value: content.description,
      required: publish,
    },
    {
      id: formFieldId(SERVICES_HERO_FORM_ID, "image"),
      label: "Hero image",
      value: content.image,
      required: publish,
      requiredMessage: "Choose a Hero image before publishing.",
      validate: isValidServicesMediaAsset,
      invalidMessage: "Choose a valid uploaded Cloudinary image.",
    },
    {
      id: formFieldId(SERVICES_HERO_FORM_ID, "image-alt"),
      label: "Hero image alt text",
      value: content.imageAlt,
      required: publish,
      requiredMessage: "Describe the image for visitors using assistive technology.",
    },
  ];
}

function servicesCatalogueRules(
  content: ServicesCatalogueContent,
  publish: boolean,
): FormFieldRule[] {
  const rules: FormFieldRule[] = [
    {
      id: formFieldId(SERVICES_CATALOGUE_FORM_ID, "heading"),
      label: "Catalogue heading",
      value: content.heading,
      required: publish,
      requiredMessage: "Enter a catalogue heading before publishing.",
    },
  ];
  const items = [...content.items].sort((a, b) => a.order - b.order);
  for (const [index, item] of items.entries()) {
    const label = `Service ${index + 1}`;
    rules.push({
      id: serviceItemFieldId(item.id, "destination-url"),
      label: `${label} destination URL`,
      value: item.destinationUrl,
      validate: isSafeServiceDestination,
      invalidMessage:
        "Use an FA Studio path, a #section link, or a secure HTTPS URL without credentials.",
    });
    if (item.image) {
      rules.push({
        id: serviceItemFieldId(item.id, "image"),
        label: `${label} image`,
        value: item.image,
        validate: isValidServicesMediaAsset,
        invalidMessage: "Choose a valid uploaded Cloudinary image.",
      });
    }
    if (!item.enabled) continue;
    rules.push(
      {
        id: serviceItemFieldId(item.id, "title"),
        label: `${label} name`,
        value: item.title,
        required: publish,
        requiredMessage: `Enter the name for ${label.toLowerCase()}.`,
      },
      {
        id: serviceItemFieldId(item.id, "short-description"),
        label: `${label} short description`,
        value: item.shortDescription,
        required: publish,
        requiredMessage: `Enter a short description for ${label.toLowerCase()}.`,
      },
    );
    if (item.image) {
      rules.push({
        id: serviceItemFieldId(item.id, "image-alt"),
        label: `${label} image alt text`,
        value: item.imageAlt,
        required: publish,
        requiredMessage: `Describe the image for ${label.toLowerCase()} for visitors using assistive technology.`,
      });
    }
  }
  return rules;
}

function collectPublishIssues(
  rules: FormFieldRule[],
  contentIsValid: boolean,
  fallback: FormFieldIssue,
): FormFieldIssue[] {
  const issues = validateFormFields(rules);
  if (!contentIsValid && issues.length === 0) issues.push(fallback);
  return issues;
}

function useServicesSectionEditor<TContent extends object>(
  type: ServicesSectionType,
  defaultContent: TContent,
) {
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<TContent>(defaultContent);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const validation = useFormFieldErrors();

  useEffect(() => {
    let active = true;
    apiClient
      .get<DraftPage>("cms/admin/pages/services")
      .then((page) => {
        if (!active) return;
        const found = page.sections.find((candidate) => candidate.type === type);
        if (found) {
          setSection(found);
          setContent(found.draftContent as TContent);
          setVisible(found.draftIsVisible);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load the Services page draft.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [type]);

  function update<K extends keyof TContent>(key: K, value: TContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
  }

  async function save(publish = false) {
    if (!section) return;
    setSaving(publish ? "publish" : "draft");
    setMessage("");
    setError("");
    try {
      const savedSection = await apiClient.patch<DraftSection>(`cms/admin/sections/${section.id}`, {
        content,
        isVisible: visible,
      });
      setSection(savedSection);
      if (!publish) {
        setMessage("Draft saved. The Storefront remains unchanged until you publish this section.");
        return;
      }
      try {
        const publishedSection = await apiClient.post<DraftSection>(
          `cms/admin/sections/${section.id}/publish`,
        );
        setSection(publishedSection);
        setMessage("Draft saved and section published.");
      } catch (cause) {
        setError(
          `${cause instanceof ApiError ? cause.message : "Publishing failed."} The draft was saved; the current published version is unchanged.`,
        );
      }
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save this Services section.");
    } finally {
      setSaving(null);
    }
  }

  return {
    section,
    content,
    visible,
    setVisible,
    loading,
    saving,
    message,
    error,
    setError,
    update,
    save,
    validation,
  };
}

function EditorStatus({ message, error }: { message: string; error: string }) {
  return (
    <>
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

function EditorActions({
  saving,
  onSave,
}: {
  saving: SavingAction;
  onSave: (publish: boolean) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3 border-t border-border pt-5">
      <ActionButton
        className="min-h-11 px-5"
        disabled={Boolean(saving)}
        loading={saving === "draft"}
        onClick={() => onSave(false)}
        type="button"
        variant="outline"
      >
        Save draft
      </ActionButton>
      <ActionButton
        className="min-h-11 px-5"
        disabled={Boolean(saving)}
        loading={saving === "publish"}
        onClick={() => onSave(true)}
        type="button"
      >
        Publish section
      </ActionButton>
    </div>
  );
}

function MissingSection({ name, error }: { name: string; error: string }) {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Services
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
      </header>
      {error ? (
        <p aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
          The Services CMS draft is not seeded yet. Run <code>pnpm cms:seed:services</code> in the
          backend, then reload this page.
        </p>
      )}
    </section>
  );
}

function EditorLoading({ name }: { name: string }) {
  return (
    <section className="space-y-4">
      <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
        Website CMS / Services
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{name}</h1>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        Loading Services draft…
      </p>
    </section>
  );
}

function imageAsset(image?: CmsImage) {
  if (!image) return null;
  return { publicId: image.publicId, url: image.url, width: image.width, height: image.height };
}

export function ServicesHeroEditor() {
  const editor = useServicesSectionEditor(SERVICES_HERO_TYPE, servicesHeroDefaultContent);
  const {
    section,
    content,
    visible,
    setVisible,
    loading,
    saving,
    message,
    error,
    update,
    save,
    validation,
  } = editor;

  if (loading) return <EditorLoading name="Services Hero" />;
  if (!section) return <MissingSection error={error} name="Services Hero" />;

  const eyebrowId = formFieldId(SERVICES_HERO_FORM_ID, "eyebrow");
  const headingId = formFieldId(SERVICES_HERO_FORM_ID, "heading");
  const descriptionId = formFieldId(SERVICES_HERO_FORM_ID, "description");
  const imageId = formFieldId(SERVICES_HERO_FORM_ID, "image");
  const imageAltId = formFieldId(SERVICES_HERO_FORM_ID, "image-alt");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Services / Hero
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Services Hero</h1>
        <p className="max-w-2xl text-muted-foreground">
          Edit the Services introduction and lead photograph. This section publishes independently
          from the catalogue.
        </p>
      </header>
      <FormErrorSummary errors={validation.errors} focusKey={validation.focusKey} />
      <EditorStatus error={error} message={message} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(20rem,0.72fr)]">
        <div className="space-y-6">
          <FormSection
            description="These values are used only after this Hero section is published."
            title="Hero content"
          >
            <TextField
              id={eyebrowId}
              description="Required when publishing."
              label="Eyebrow"
              onChange={(event) => {
                validation.clear(eyebrowId);
                update("eyebrow", event.target.value);
              }}
              required
              value={content.eyebrow}
              error={fieldErrorMessage(validation.errors, eyebrowId)}
            />
            <TextField
              id={headingId}
              description="Required when publishing."
              label="Heading"
              onChange={(event) => {
                validation.clear(headingId);
                update("heading", event.target.value);
              }}
              required
              value={content.heading}
              error={fieldErrorMessage(validation.errors, headingId)}
            />
            <TextareaField
              id={descriptionId}
              description="Required when publishing."
              label="Description"
              onChange={(event) => {
                validation.clear(descriptionId);
                update("description", event.target.value);
              }}
              required
              value={content.description}
              error={fieldErrorMessage(validation.errors, descriptionId)}
            />
            <ImageUploadField
              allowLibrary
              description="Choose an existing Cloudinary asset or upload a new image. A lead image and alt text are required to publish."
              error={fieldErrorMessage(validation.errors, imageId)}
              id={imageId}
              label="Hero image"
              onChange={(image) => {
                validation.clear(imageId);
                validation.clear(imageAltId);
                update("image", imageAsset(image));
                update("imageAlt", image?.alt ?? "");
              }}
              required
              value={content.image ? { ...content.image, alt: content.imageAlt } : undefined}
            />
            <TextField
              id={imageAltId}
              description="Required when publishing. Describe the image for visitors using assistive technology."
              label="Hero image alt text"
              onChange={(event) => {
                validation.clear(imageAltId);
                update("imageAlt", event.target.value);
              }}
              required
              value={content.imageAlt}
              error={fieldErrorMessage(validation.errors, imageAltId)}
            />
            <SwitchField
              checked={visible}
              description="Turning this off affects the Storefront only after publishing. The draft remains saved."
              label="Show Hero on the Storefront"
              onChange={setVisible}
            />
          </FormSection>
          <EditorActions
            onSave={(publish) => {
              if (publish) {
                const issues = collectPublishIssues(
                  servicesHeroRules(content, publish),
                  isServicesHeroContent(content),
                  {
                    id: imageId,
                    label: "Hero image",
                    message: "Choose a valid uploaded Cloudinary image before publishing.",
                  },
                );
                if (issues.length) {
                  validation.report(issues);
                  return;
                }
              }
              validation.clear();
              void save(publish);
            }}
            saving={saving}
          />
        </div>
        <div className="space-y-5">
          <HeroPreview content={content} label="Draft preview" />
          <PublishedHeroPreview
            content={section.publishedContent}
            visible={section.publishedIsVisible}
          />
        </div>
      </div>
    </section>
  );
}

function HeroPreview({ content, label }: { content: ServicesHeroContent; label: string }) {
  return (
    <aside
      aria-label={label}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm"
    >
      <div className="relative aspect-[4/3] bg-muted">
        {content.image?.url ? (
          <Image
            alt={content.imageAlt || "Hero image preview"}
            className="object-cover"
            fill
            sizes="(min-width: 1280px) 35vw, 100vw"
            src={content.image.url}
          />
        ) : (
          <div className="grid size-full place-items-center p-8 text-center text-sm text-muted-foreground">
            Select a published interior photograph to preview the Hero.
          </div>
        )}
      </div>
      <div className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {content.eyebrow || "Eyebrow"}
        </p>
        <h2 className="font-display text-3xl leading-tight">{content.heading || "Hero heading"}</h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {content.description || "Hero description preview."}
        </p>
      </div>
    </aside>
  );
}

function PublishedHeroPreview({ content, visible }: { content: unknown; visible?: boolean }) {
  const published = isServicesHeroContent(content) ? content : null;
  return (
    <aside className="rounded-xl border border-border bg-muted p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Published version
      </p>
      {!published ? (
        <p className="mt-2 text-sm text-muted-foreground">
          This Hero section has not been published yet.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted-foreground">
            {visible ? "Visible on the Storefront" : "Hidden on the Storefront"}
          </p>
          <h2 className="mt-3 font-display text-2xl">{published.heading}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{published.description}</p>
        </>
      )}
    </aside>
  );
}

function createService(order: number): ServiceCatalogueItem {
  return {
    id: globalThis.crypto.randomUUID(),
    title: "",
    shortDescription: "",
    detailedDescription: "",
    image: null,
    imageAlt: "",
    destinationUrl: "",
    enabled: true,
    order,
  };
}

function orderItems(items: readonly ServiceCatalogueItem[]) {
  return items.map((item, order) => ({ ...item, order }));
}

export function ServicesCatalogueEditor() {
  const editor = useServicesSectionEditor(SERVICES_CATALOGUE_TYPE, servicesCatalogueDefaultContent);
  const {
    section,
    content,
    visible,
    setVisible,
    loading,
    saving,
    message,
    error,
    update,
    save,
    validation,
  } = editor;
  const items = [...content.items].sort((a, b) => a.order - b.order);

  function addService() {
    update("items", orderItems([...items, createService(items.length)]));
  }

  function changeItem(index: number, patch: Partial<ServiceCatalogueItem>) {
    const next = [...content.items].sort((a, b) => a.order - b.order);
    const currentItem = next[index];
    if (!currentItem) return;
    const clearFieldError = (fieldName: string) =>
      validation.clear(serviceItemFieldId(currentItem.id, fieldName));

    if ("title" in patch) clearFieldError("title");
    if ("shortDescription" in patch) clearFieldError("short-description");
    if ("destinationUrl" in patch) clearFieldError("destination-url");
    if ("image" in patch) clearFieldError("image");
    if ("imageAlt" in patch || ("image" in patch && !patch.image)) {
      clearFieldError("image-alt");
    }
    if (patch.enabled === false) {
      clearFieldError("title");
      clearFieldError("short-description");
      clearFieldError("image-alt");
    }

    next[index] = { ...currentItem, ...patch };
    update("items", orderItems(next));
  }

  function moveItem(index: number, delta: number) {
    validation.clear();
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("items", orderItems(next));
  }

  function removeItem(index: number) {
    const item = items[index];
    const label = item.title.trim() || `Service ${index + 1}`;
    if (
      !globalThis.confirm(
        `Remove “${label}” from the draft catalogue? Its media file will remain in the library.`,
      )
    )
      return;
    validation.clear();
    update("items", orderItems(items.filter((_, itemIndex) => itemIndex !== index)));
  }

  if (loading) return <EditorLoading name="Service Catalogue" />;
  if (!section) return <MissingSection error={error} name="Service Catalogue" />;

  const published = isServicesCatalogueContent(section.publishedContent)
    ? section.publishedContent
    : null;
  const headingId = formFieldId(SERVICES_CATALOGUE_FORM_ID, "heading");

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Services / Catalogue
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Service Catalogue</h1>
        <p className="max-w-2xl text-muted-foreground">
          Add, edit, hide, remove, or reorder service entries. There is no item-count limit. Changes
          remain draft-only until you publish this section.
        </p>
      </header>
      <FormErrorSummary errors={validation.errors} focusKey={validation.focusKey} />
      <EditorStatus error={error} message={message} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
        <div className="space-y-6">
          <FormSection
            description="The catalogue heading and section visibility are independent from the Services Hero."
            title="Catalogue content"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                label="Eyebrow"
                onChange={(event) => update("eyebrow", event.target.value)}
                value={content.eyebrow}
              />
              <TextField
                id={headingId}
                description="Required when publishing."
                label="Heading"
                onChange={(event) => {
                  validation.clear(headingId);
                  update("heading", event.target.value);
                }}
                required
                value={content.heading}
                error={fieldErrorMessage(validation.errors, headingId)}
              />
            </div>
            <TextareaField
              label="Section description (optional)"
              onChange={(event) => update("description", event.target.value)}
              value={content.description}
            />
            <SwitchField
              checked={visible}
              description="Turning this off affects the Storefront only after publishing. Service item visibility is controlled separately below."
              label="Show Catalogue section on the Storefront"
              onChange={setVisible}
            />
          </FormSection>

          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
            <div>
              <h2 className="text-lg font-semibold">Services in this draft</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length} total · {items.filter((item) => item.enabled).length} marked visible
              </p>
            </div>
            <ActionButton
              className="min-h-11 px-5"
              onClick={addService}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" />
              Add service
            </ActionButton>
          </div>

          {items.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
              There are no draft service entries yet. Add a service when its details are approved.
            </p>
          ) : (
            <div className="space-y-5">
              {items.map((item, index) => (
                <ServiceItemEditor
                  index={index}
                  item={item}
                  key={item.id}
                  onChange={(patch) => changeItem(index, patch)}
                  onMove={(delta) => moveItem(index, delta)}
                  onRemove={() => removeItem(index)}
                  total={items.length}
                  validation={validation}
                />
              ))}
            </div>
          )}
          <EditorActions
            onSave={(publishNow) => {
              if (publishNow) {
                const issues = collectPublishIssues(
                  servicesCatalogueRules(content, publishNow),
                  isServicesCatalogueContent(content),
                  {
                    id: headingId,
                    label: "Catalogue content",
                    message:
                      "Review the catalogue content and correct any values outside the allowed format.",
                  },
                );
                if (issues.length) {
                  validation.report(issues);
                  return;
                }
              }
              validation.clear();
              void save(publishNow);
            }}
            saving={saving}
          />
        </div>

        <aside className="h-fit rounded-xl border border-border bg-muted p-5 xl:sticky xl:top-24">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Published catalogue
          </p>
          {!published ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This catalogue section has not been published yet.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                {section.publishedIsVisible ? "Section visible" : "Section hidden"} ·{" "}
                {published.items.length} saved items ·{" "}
                {published.items.filter((item) => item.enabled).length} enabled items
              </p>
              {published.items.filter((item) => item.enabled).length ? (
                <ul className="mt-4 divide-y divide-border">
                  {published.items
                    .filter((item) => item.enabled)
                    .map((item) => (
                      <li className="py-3 text-sm font-medium" key={item.id}>
                        {item.title}
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  No visible service entries are published. The public page will omit the empty
                  catalogue.
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  );
}

function ServiceItemEditor({
  item,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  validation,
}: {
  item: ServiceCatalogueItem;
  index: number;
  total: number;
  onChange: (patch: Partial<ServiceCatalogueItem>) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
  validation: ServicesFieldValidation;
}) {
  const titleId = serviceItemFieldId(item.id, "title");
  const shortDescriptionId = serviceItemFieldId(item.id, "short-description");
  const imageId = serviceItemFieldId(item.id, "image");
  const imageAltId = serviceItemFieldId(item.id, "image-alt");
  const destinationUrlId = serviceItemFieldId(item.id, "destination-url");

  return (
    <FormSection
      description="The Storefront displays only enabled entries in this published catalogue."
      title={`Service ${index + 1}${item.title.trim() ? ` · ${item.title}` : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Display order {index + 1}</p>
        <div
          aria-label={`Actions for service ${index + 1}`}
          className="flex flex-wrap gap-2"
          role="group"
        >
          <ActionButton
            aria-label={`Move service ${index + 1} up`}
            className="min-h-11 min-w-11"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <ArrowUp aria-hidden="true" />
          </ActionButton>
          <ActionButton
            aria-label={`Move service ${index + 1} down`}
            className="min-h-11 min-w-11"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            size="icon-lg"
            type="button"
            variant="outline"
          >
            <ArrowDown aria-hidden="true" />
          </ActionButton>
          <ActionButton
            aria-label={`Remove service ${index + 1}`}
            className="min-h-11 px-4"
            onClick={onRemove}
            type="button"
            variant="destructive"
          >
            <Trash2 aria-hidden="true" />
            Remove
          </ActionButton>
        </div>
      </div>
      <TextField
        id={titleId}
        description={
          item.enabled
            ? "Required when publishing this enabled service."
            : "Optional while this service is disabled."
        }
        label="Service name"
        onChange={(event) => onChange({ title: event.target.value })}
        required={item.enabled}
        value={item.title}
        error={fieldErrorMessage(validation.errors, titleId)}
      />
      <TextareaField
        id={shortDescriptionId}
        description={
          item.enabled
            ? "Required when publishing this enabled service."
            : "Optional while this service is disabled."
        }
        label="Short description"
        onChange={(event) => onChange({ shortDescription: event.target.value })}
        required={item.enabled}
        value={item.shortDescription}
        error={fieldErrorMessage(validation.errors, shortDescriptionId)}
      />
      <TextareaField
        label="Detailed description (optional)"
        onChange={(event) => onChange({ detailedDescription: event.target.value })}
        value={item.detailedDescription}
      />
      <ImageUploadField
        allowLibrary
        description="Optional. Use an existing Cloudinary asset or upload a new image; removing it from this draft never deletes the media file."
        error={fieldErrorMessage(validation.errors, imageId)}
        id={imageId}
        label="Service image (optional)"
        onChange={(image) => onChange({ image: imageAsset(image), imageAlt: image?.alt ?? "" })}
        value={item.image ? { ...item.image, alt: item.imageAlt } : undefined}
      />
      <TextField
        id={imageAltId}
        description={
          item.enabled && item.image
            ? "Required when publishing this enabled service."
            : "Optional while this service is disabled or has no image."
        }
        disabled={!item.image}
        label="Image alt text"
        onChange={(event) => onChange({ imageAlt: event.target.value })}
        required={Boolean(item.image) && item.enabled}
        value={item.imageAlt}
        error={fieldErrorMessage(validation.errors, imageAltId)}
      />
      <TextField
        id={destinationUrlId}
        description="Leave blank for a non-clickable card. Use an existing FA Studio route or a secure HTTPS URL."
        label="Destination URL (optional)"
        onChange={(event) => onChange({ destinationUrl: event.target.value })}
        value={item.destinationUrl}
        error={fieldErrorMessage(validation.errors, destinationUrlId)}
      />
      <SwitchField
        checked={item.enabled}
        description="Disabled entries remain in this draft and can be re-enabled later."
        label={`Show ${item.title.trim() || `service ${index + 1}`} on the Storefront`}
        onChange={(enabled) => onChange({ enabled })}
      />
    </FormSection>
  );
}
