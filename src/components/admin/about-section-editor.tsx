"use client";

import type {
  AboutListItem,
  AboutSectionContent,
  AboutSectionType,
  CmsImage,
  CmsMediaAsset,
} from "@fs/cms-contracts";
import { aboutSectionDefaults, isAboutSectionContent, sectionRegistry } from "@fs/cms-contracts";
import { useEffect, useState } from "react";
import {
  formFieldId,
  validateFormFields,
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
  SwitchField,
  TextareaField,
  TextField,
  useFormFieldErrors,
} from "./form-controls";

type DraftSection = {
  id: string;
  type: AboutSectionType;
  draftContent: AboutSectionContent;
  publishedContent: AboutSectionContent | null;
  draftIsVisible: boolean;
  draftOrder: number;
};
type DraftPage = { id: string; sections: DraftSection[] };

type AboutContentKey = keyof AboutSectionContent;

const titles = Object.fromEntries(
  sectionRegistry
    .filter((item) => item.page === "about")
    .map(({ type, displayName }) => [type, displayName]),
) as Record<AboutSectionType, string>;
const aboutFormId = "about-section";
const aboutFieldId = (fieldName: string) => formFieldId(aboutFormId, fieldName);
const aboutItemFieldId = (index: number, fieldName: string) =>
  aboutFieldId(`items-${index}-${fieldName}`);

const aboutTextFields: readonly [Exclude<AboutContentKey, "image" | "items">, string][] = [
  ["eyebrow", "Eyebrow"],
  ["heading", "Heading"],
  ["description", "Description"],
  ["imageAlt", "Image alt text"],
  ["designerName", "Designer name"],
  ["role", "Role / title"],
  ["biography", "Biography"],
  ["quote", "Quote"],
  ["ctaLabel", "CTA label"],
  ["ctaUrl", "CTA URL"],
];

const listSectionTypes: readonly AboutSectionType[] = [
  "about.metrics",
  "about.values",
  "about.process",
  "about.press",
  "about.projects",
  "about.testimonials",
];
const imageSectionTypes: readonly AboutSectionType[] = [
  "about.hero",
  "about.studio",
  "about.designer",
  "about.closing",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function asString(value: unknown): string {
  return isString(value) ? value : "";
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

function imageValue(asset: unknown, alt: unknown): CmsImage | undefined {
  if (!isMediaAsset(asset)) return undefined;
  return { ...asset, alt: asString(alt) } as CmsImage;
}

function buildAboutShapeRules(content: AboutSectionContent): FormFieldRule[] {
  const rules: FormFieldRule[] = aboutTextFields.map(([key, label]) => ({
    id: aboutFieldId(key),
    label,
    value: content[key],
    validate: isString,
    invalidMessage: `${label} must be text. Review this field before saving.`,
  }));

  rules.push(
    {
      id: aboutFieldId("image"),
      label: "Section image",
      value: content.image,
      validate: isOptionalMediaAsset,
      invalidMessage: "Choose a valid image or select a replacement.",
    },
    {
      id: aboutFieldId("items-add"),
      label: "Section items",
      value: content.items,
      validate: Array.isArray,
      invalidMessage: "The item list is not valid. Add an item to replace the list.",
    },
  );

  if (!Array.isArray(content.items)) return rules;

  content.items.forEach((item, index) => {
    if (!isRecord(item)) {
      rules.push({
        id: aboutItemFieldId(index, "remove"),
        label: `Item ${index + 1}`,
        value: item,
        validate: isRecord,
        invalidMessage: "This item has an invalid structure. Remove it and add a new item.",
      });
      return;
    }

    rules.push(
      {
        id: aboutItemFieldId(index, "remove"),
        label: `Item ${index + 1}`,
        value: item.id,
        validate: isString,
        invalidMessage: "This item identifier is invalid. Remove the item and add it again.",
      },
      ...(
        [
          ["title", "Title"],
          ["description", "Description"],
          ["value", "Value / publication"],
          ["imageAlt", "Display name / attribution"],
          ["href", "Item link"],
        ] as const
      ).map(([fieldName, label]) => ({
        id: aboutItemFieldId(index, fieldName),
        label: `Item ${index + 1} ${label.toLowerCase()}`,
        value: item[fieldName],
        validate: isString,
        invalidMessage: `${label} must be text. Review this item before saving.`,
      })),
      {
        id: aboutItemFieldId(index, "image"),
        label: `Item ${index + 1} image`,
        value: item.image,
        validate: isOptionalMediaAsset,
        invalidMessage: "Choose a valid image or select a replacement.",
      },
    );
  });

  return rules;
}

function visibleAboutFieldIds(type: AboutSectionType, items: readonly unknown[]): Set<string> {
  const ids = new Set([aboutFieldId("eyebrow"), aboutFieldId("heading")]);
  const showDescription = ![
    "about.metrics",
    "about.values",
    "about.press",
    "about.testimonials",
  ].includes(type);

  if (showDescription) ids.add(aboutFieldId("description"));
  if (type === "about.designer") {
    ids.add(aboutFieldId("designerName"));
    ids.add(aboutFieldId("role"));
    ids.add(aboutFieldId("biography"));
    ids.add(aboutFieldId("quote"));
  }
  if (imageSectionTypes.includes(type)) {
    ids.add(aboutFieldId("image"));
    ids.add(aboutFieldId("imageAlt"));
  }
  if (type === "about.closing") {
    ids.add(aboutFieldId("ctaLabel"));
    ids.add(aboutFieldId("ctaUrl"));
  }
  if (listSectionTypes.includes(type)) {
    ids.add(aboutFieldId("items-add"));
    items.forEach((_, index) => {
      ["remove", "value", "title", "description", "imageAlt"].forEach((fieldName) => {
        ids.add(aboutItemFieldId(index, fieldName));
      });
      if (type === "about.press" || type === "about.projects") {
        ids.add(aboutItemFieldId(index, "href"));
        ids.add(aboutItemFieldId(index, "image"));
      }
    });
  }

  return ids;
}

export function AboutSectionEditor({ type }: { type: AboutSectionType }) {
  const [page, setPage] = useState<DraftPage>();
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<AboutSectionContent>(aboutSectionDefaults[type]);
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const fieldErrors = useFormFieldErrors();

  async function load() {
    const draft = await apiClient.get<DraftPage>("cms/admin/pages/about");
    setPage(draft);
    const found = draft.sections.find((candidate) => candidate.type === type);
    if (found) {
      setSection(found);
      setContent(found.draftContent);
      setVisible(found.draftIsVisible);
    }
  }

  useEffect(() => {
    let active = true;
    apiClient
      .get<DraftPage>("cms/admin/pages/about")
      .then((draft) => {
        if (!active) return;
        setPage(draft);
        const found = draft.sections.find((candidate) => candidate.type === type);
        if (found) {
          setSection(found);
          setContent(found.draftContent);
          setVisible(found.draftIsVisible);
        }
      })
      .catch(() => {
        if (active) setError("Unable to load About page drafts.");
      });
    return () => {
      active = false;
    };
  }, [type]);

  function update<K extends keyof AboutSectionContent>(
    key: K,
    value: AboutSectionContent[K],
    fieldId?: string,
  ) {
    setContent((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
    if (fieldId) fieldErrors.clear(fieldId);
    else fieldErrors.clear();
  }

  async function moveSection(delta: number) {
    if (!page || !section) return;
    const ordered = [...page.sections].sort((a, b) => a.draftOrder - b.draftOrder);
    const index = ordered.findIndex((item) => item.id === section.id);
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    await apiClient.put(`cms/admin/pages/${page.id}/sections/order`, {
      sectionIds: ordered.map((item) => item.id),
    });
    await load();
    setMessage("Section order updated.");
  }

  async function save(publish = false) {
    if (!section) return;

    setMessage("");
    setError("");
    const items = Array.isArray(content.items) ? content.items : [];
    const shapeIssues = validateFormFields(buildAboutShapeRules(content));
    const visibleIds = visibleAboutFieldIds(type, items);
    const visibleIssues = shapeIssues.filter((issue) => visibleIds.has(issue.id));
    const hasUnmappedShapeIssue =
      shapeIssues.some((issue) => !visibleIds.has(issue.id)) ||
      (!isAboutSectionContent(content) && shapeIssues.length === 0);

    fieldErrors.report(visibleIssues);
    if (visibleIssues.length > 0 || hasUnmappedShapeIssue || !isAboutSectionContent(content)) {
      if (hasUnmappedShapeIssue) {
        setError(
          "Some About content has an invalid structure that is not editable in this section. Reload the draft to restore its structure, then try again.",
        );
      }
      return;
    }

    setSaving(true);
    try {
      await apiClient.patch(`cms/admin/sections/${section.id}`, { content, isVisible: visible });
      if (publish) await apiClient.post(`cms/admin/sections/${section.id}/publish`);
      fieldErrors.report([]);
      setMessage(
        publish
          ? "Draft saved and section published."
          : "Draft saved. The Storefront is unchanged until publishing.",
      );
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Unable to save this About section.");
    } finally {
      setSaving(false);
    }
  }

  if (!page) {
    return (
      <section className="space-y-4">
        <header>
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Website CMS / About
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{titles[type]}</h1>
        </header>
        {error ? (
          <p
            aria-live="polite"
            className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            role="status"
          >
            {error}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
            The About page is not seeded yet. Run <code>pnpm cms:seed:about</code> in the backend,
            then reload.
          </p>
        )}
      </section>
    );
  }
  if (!section) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
        This About section has not been seeded. Run <code>pnpm cms:seed:about</code> in the backend.
      </p>
    );
  }

  const listItems = (
    Array.isArray(content.items) ? content.items : []
  ) as AboutSectionContent["items"];

  function updateItem(index: number, patch: Partial<AboutListItem>, fieldId: string) {
    const items = [...listItems];
    const existing = isRecord(items[index]) ? items[index] : {};
    items[index] = { ...existing, ...patch } as AboutListItem;
    update("items", items, fieldId);
  }

  function moveItem(index: number, delta: number) {
    const items = [...listItems];
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    update("items", items);
  }

  const showList = listSectionTypes.includes(type);
  const showDescription = ![
    "about.metrics",
    "about.values",
    "about.press",
    "about.testimonials",
  ].includes(type);
  const showItemMedia = type === "about.press" || type === "about.projects";
  const itemsAddId = aboutFieldId("items-add");
  const itemsError = fieldErrorMessage(fieldErrors.errors, itemsAddId);

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / About / {titles[type]}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{titles[type]}</h1>
        <p className="max-w-2xl text-muted-foreground">
          Edit this section independently. Hidden sections keep their draft content and can be
          enabled later.
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

      <FormSection title="Section content">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("eyebrow"))}
            id={aboutFieldId("eyebrow")}
            label="Eyebrow"
            onChange={(event) => update("eyebrow", event.target.value, aboutFieldId("eyebrow"))}
            value={asString(content.eyebrow)}
          />
          <TextField
            error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("heading"))}
            id={aboutFieldId("heading")}
            label="Heading"
            onChange={(event) => update("heading", event.target.value, aboutFieldId("heading"))}
            value={asString(content.heading)}
          />
        </div>
        {showDescription ? (
          <TextareaField
            error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("description"))}
            id={aboutFieldId("description")}
            label="Description"
            onChange={(event) =>
              update("description", event.target.value, aboutFieldId("description"))
            }
            value={asString(content.description)}
          />
        ) : null}

        {type === "about.designer" ? (
          <>
            <TextField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("designerName"))}
              id={aboutFieldId("designerName")}
              label="Designer name (confirm before publishing)"
              onChange={(event) =>
                update("designerName", event.target.value, aboutFieldId("designerName"))
              }
              value={asString(content.designerName)}
            />
            <TextField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("role"))}
              id={aboutFieldId("role")}
              label="Role / title"
              onChange={(event) => update("role", event.target.value, aboutFieldId("role"))}
              value={asString(content.role)}
            />
            <TextareaField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("biography"))}
              id={aboutFieldId("biography")}
              label="Biography"
              onChange={(event) =>
                update("biography", event.target.value, aboutFieldId("biography"))
              }
              value={asString(content.biography)}
            />
            <TextareaField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("quote"))}
              id={aboutFieldId("quote")}
              label="Optional quote"
              onChange={(event) => update("quote", event.target.value, aboutFieldId("quote"))}
              value={asString(content.quote)}
            />
          </>
        ) : null}

        {imageSectionTypes.includes(type) ? (
          <>
            <ImageUploadField
              allowLibrary
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("image"))}
              id={aboutFieldId("image")}
              label="Section image"
              onChange={(image) =>
                update(
                  "image",
                  image
                    ? {
                        publicId: image.publicId,
                        url: image.url,
                        width: image.width,
                        height: image.height,
                      }
                    : null,
                  aboutFieldId("image"),
                )
              }
              value={imageValue(content.image, content.imageAlt)}
            />
            <TextField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("imageAlt"))}
              id={aboutFieldId("imageAlt")}
              label="Image alt text"
              onChange={(event) => update("imageAlt", event.target.value, aboutFieldId("imageAlt"))}
              value={asString(content.imageAlt)}
            />
          </>
        ) : null}

        {type === "about.closing" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("ctaLabel"))}
              id={aboutFieldId("ctaLabel")}
              label="Optional CTA label"
              onChange={(event) => update("ctaLabel", event.target.value, aboutFieldId("ctaLabel"))}
              value={asString(content.ctaLabel)}
            />
            <TextField
              error={fieldErrorMessage(fieldErrors.errors, aboutFieldId("ctaUrl"))}
              id={aboutFieldId("ctaUrl")}
              label="Optional CTA URL"
              onChange={(event) => update("ctaUrl", event.target.value, aboutFieldId("ctaUrl"))}
              value={asString(content.ctaUrl)}
            />
          </div>
        ) : null}
      </FormSection>

      {showList ? (
        <FormSection
          description="Add, edit, remove, and reorder entries. Only approved, factual content should be published."
          title={type === "about.process" ? "Process steps" : "Section items"}
        >
          {listItems.map((item, index) => {
            const record: Record<string, unknown> = isRecord(item) ? item : {};
            const itemTitle = asString(record.title);
            const itemDescription = asString(record.description);
            const itemValue = asString(record.value);
            const itemImageAlt = asString(record.imageAlt);
            const removeId = aboutItemFieldId(index, "remove");
            const removeError = fieldErrorMessage(fieldErrors.errors, removeId);

            return (
              <div
                className="space-y-4 rounded-lg border border-border p-4"
                key={`${index}-${asString(record.id)}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    error={fieldErrorMessage(fieldErrors.errors, aboutItemFieldId(index, "value"))}
                    id={aboutItemFieldId(index, "value")}
                    label={
                      type === "about.metrics"
                        ? "Metric value"
                        : type === "about.process"
                          ? "Step number"
                          : "Value / publication"
                    }
                    onChange={(event) =>
                      updateItem(
                        index,
                        { value: event.target.value },
                        aboutItemFieldId(index, "value"),
                      )
                    }
                    value={itemValue}
                  />
                  <TextField
                    error={fieldErrorMessage(fieldErrors.errors, aboutItemFieldId(index, "title"))}
                    id={aboutItemFieldId(index, "title")}
                    label="Title"
                    onChange={(event) =>
                      updateItem(
                        index,
                        { title: event.target.value },
                        aboutItemFieldId(index, "title"),
                      )
                    }
                    value={itemTitle}
                  />
                </div>
                <TextareaField
                  error={fieldErrorMessage(
                    fieldErrors.errors,
                    aboutItemFieldId(index, "description"),
                  )}
                  id={aboutItemFieldId(index, "description")}
                  label={type === "about.testimonials" ? "Approved testimonial" : "Description"}
                  onChange={(event) =>
                    updateItem(
                      index,
                      { description: event.target.value },
                      aboutItemFieldId(index, "description"),
                    )
                  }
                  value={itemDescription}
                />
                {showItemMedia ? (
                  <>
                    <TextField
                      error={fieldErrorMessage(fieldErrors.errors, aboutItemFieldId(index, "href"))}
                      id={aboutItemFieldId(index, "href")}
                      label={
                        type === "about.press"
                          ? "Article URL (optional)"
                          : "Project link (optional)"
                      }
                      onChange={(event) =>
                        updateItem(
                          index,
                          { href: event.target.value },
                          aboutItemFieldId(index, "href"),
                        )
                      }
                      value={asString(record.href)}
                    />
                    <ImageUploadField
                      allowLibrary
                      error={fieldErrorMessage(
                        fieldErrors.errors,
                        aboutItemFieldId(index, "image"),
                      )}
                      id={aboutItemFieldId(index, "image")}
                      label="Image / publication mark"
                      onChange={(image) =>
                        updateItem(
                          index,
                          {
                            image: image
                              ? {
                                  publicId: image.publicId,
                                  url: image.url,
                                  width: image.width,
                                  height: image.height,
                                }
                              : null,
                            imageAlt: image?.alt ?? "",
                          },
                          aboutItemFieldId(index, "image"),
                        )
                      }
                      value={imageValue(record.image, record.imageAlt)}
                    />
                  </>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <TextField
                    error={fieldErrorMessage(
                      fieldErrors.errors,
                      aboutItemFieldId(index, "imageAlt"),
                    )}
                    id={aboutItemFieldId(index, "imageAlt")}
                    label="Display name / attribution (optional)"
                    onChange={(event) =>
                      updateItem(
                        index,
                        { imageAlt: event.target.value },
                        aboutItemFieldId(index, "imageAlt"),
                      )
                    }
                    value={itemImageAlt}
                  />
                  <button
                    aria-label={`Move item ${index + 1} up`}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onClick={() => moveItem(index, -1)}
                    type="button"
                  >
                    Move up
                  </button>
                  <button
                    aria-label={`Move item ${index + 1} down`}
                    className="rounded-md border border-border px-3 py-2 text-sm"
                    onClick={() => moveItem(index, 1)}
                    type="button"
                  >
                    Move down
                  </button>
                  <button
                    aria-describedby={removeError ? `${removeId}-error` : undefined}
                    aria-label={`Remove item ${index + 1}`}
                    className="rounded-md border border-border px-3 py-2 text-sm text-destructive"
                    id={removeId}
                    onClick={() =>
                      update(
                        "items",
                        listItems.filter((_, position) => position !== index),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </div>
                <FormError id={`${removeId}-error`}>{removeError}</FormError>
              </div>
            );
          })}
          <ActionButton
            aria-describedby={itemsError ? `${itemsAddId}-error` : undefined}
            id={itemsAddId}
            onClick={() =>
              update("items", [
                ...listItems,
                {
                  id: crypto.randomUUID(),
                  title: "",
                  description: "",
                  value: "",
                  image: null,
                  imageAlt: "",
                  href: "",
                },
              ])
            }
            type="button"
            variant="outline"
          >
            Add item
          </ActionButton>
          <FormError id={`${itemsAddId}-error`}>{itemsError}</FormError>
        </FormSection>
      ) : null}

      <FormSection title="Visibility, ordering & publishing">
        <SwitchField
          checked={visible}
          description="Only visible sections that have been published appear on the Storefront."
          label={`Show ${titles[type]}`}
          onChange={setVisible}
        />
        <div className="flex flex-wrap gap-2">
          <ActionButton onClick={() => void moveSection(-1)} type="button" variant="outline">
            Move section up
          </ActionButton>
          <ActionButton onClick={() => void moveSection(1)} type="button" variant="outline">
            Move section down
          </ActionButton>
        </div>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            loading={saving}
            onClick={() => void save()}
            type="button"
            variant="outline"
          >
            Save draft
          </ActionButton>
          <ActionButton loading={saving} onClick={() => void save(true)} type="button">
            Save and publish
          </ActionButton>
        </div>
      </FormSection>

      <div className="grid gap-4 lg:grid-cols-2">
        <aside className="rounded-xl border border-border bg-muted p-5">
          <p className="type-caption text-muted-foreground">Draft preview</p>
          <h2 className="mt-2 font-display text-2xl">
            {asString(content.heading) || asString(content.designerName) || titles[type]}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {asString(content.description) ||
              asString(content.biography) ||
              "Add content to preview this section."}
          </p>
        </aside>
        <aside className="rounded-xl border border-border bg-card p-5">
          <p className="type-caption text-muted-foreground">Published version</p>
          {section.publishedContent ? (
            <>
              <h2 className="mt-2 font-display text-2xl">
                {asString(section.publishedContent.heading) ||
                  asString(section.publishedContent.designerName) ||
                  titles[type]}
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {asString(section.publishedContent.description) ||
                  asString(section.publishedContent.biography) ||
                  "Published content has no description."}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              This section has not been published yet.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
