"use client";

import {
  PROCESS_STEPS_TYPE,
  isProcessStepsContent,
  isProcessStepsDraftContent,
  processStepsDefaultContent,
  type CmsImage,
  type CmsMediaAsset,
  type ProcessStep,
  type ProcessStepsContent,
} from "@fs/cms-contracts";
import { ArrowDown, ArrowUp, CopyPlus, Plus, Trash2 } from "lucide-react";
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

const FORM_ID = "process-steps";
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

const focalPointOptions = [
  ["center", "Center"],
  ["top", "Top"],
  ["bottom", "Bottom"],
  ["left", "Left"],
  ["right", "Right"],
  ["top-left", "Top left"],
  ["top-right", "Top right"],
  ["bottom-left", "Bottom left"],
  ["bottom-right", "Bottom right"],
] as const;

function mediaIsValid(value: unknown): value is CmsMediaAsset {
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
  )
    return false;
  try {
    const url = new URL(asset.url);
    return url.protocol === "https:" && url.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

function mediaForUpload(image: CmsMediaAsset | null, alt: string): CmsImage | undefined {
  return image ? { ...image, alt } : undefined;
}

function newStepId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `process-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function createStep(order: number): ProcessStep {
  return {
    id: newStepId(),
    order,
    enabled: false,
    eyebrow: "",
    title: "",
    summary: "",
    description: "",
    image: null,
    imageAlt: "",
    imageDecorative: false,
    secondaryCaption: "",
    imagePosition: "center",
  };
}

function orderSteps(steps: readonly ProcessStep[]) {
  return steps.map((step, order) => ({ ...step, order }));
}

function pageRules(content: ProcessStepsContent, publish: boolean): FormFieldRule[] {
  const steps = [...content.steps].sort((a, b) => a.order - b.order);
  const rules: FormFieldRule[] = [
    {
      id: formFieldId(FORM_ID, "heading"),
      label: "Page heading",
      value: content.heading,
      required: publish,
      maxLength: 160,
    },
    {
      id: formFieldId(FORM_ID, "eyebrow"),
      label: "Page eyebrow",
      value: content.eyebrow,
      maxLength: 100,
    },
    {
      id: formFieldId(FORM_ID, "description"),
      label: "Page introduction",
      value: content.description,
      maxLength: 360,
    },
    {
      id: formFieldId(FORM_ID, "seoTitle"),
      label: "Search title",
      value: content.seoTitle,
      maxLength: 180,
    },
    {
      id: formFieldId(FORM_ID, "seoDescription"),
      label: "Search description",
      value: content.seoDescription,
      maxLength: 320,
    },
    {
      id: formFieldId(FORM_ID, "skipLinkLabel"),
      label: "Text alternative button label",
      value: content.skipLinkLabel,
      required: publish && content.enabled && steps.filter((step) => step.enabled).length > 1,
      maxLength: 100,
    },
  ];

  for (const [index, step] of steps.entries()) {
    const fieldId = (field: string) => formFieldId(FORM_ID, `step-${step.id}-${field}`);
    rules.push(
      {
        id: fieldId("title"),
        label: `Step ${index + 1} title`,
        value: step.title,
        required: publish && step.enabled,
        maxLength: 120,
      },
      {
        id: fieldId("summary"),
        label: `Step ${index + 1} summary`,
        value: step.summary,
        required: publish && step.enabled,
        maxLength: 320,
      },
      {
        id: fieldId("description"),
        label: `Step ${index + 1} description`,
        value: step.description,
        maxLength: 2400,
      },
      {
        id: fieldId("image"),
        label: `Step ${index + 1} image`,
        value: step.image,
        required: publish && step.enabled,
        validate: (value) => value === null || mediaIsValid(value),
        requiredMessage: "Choose an uploaded interior image before publishing this enabled step.",
        invalidMessage: "Choose a valid Cloudinary image.",
      },
      {
        id: fieldId("image-alt"),
        label: `Step ${index + 1} image alt text`,
        value: step.imageAlt,
        required: publish && step.enabled && !step.imageDecorative,
        maxLength: 240,
        requiredMessage: "Describe this image or mark it decorative.",
      },
      {
        id: fieldId("eyebrow"),
        label: `Step ${index + 1} eyebrow`,
        value: step.eyebrow,
        maxLength: 100,
      },
      {
        id: fieldId("caption"),
        label: `Step ${index + 1} secondary caption`,
        value: step.secondaryCaption,
        maxLength: 180,
      },
    );
  }
  return rules;
}

export function ProcessStepsEditor() {
  const [page, setPage] = useState<DraftPage | null>(null);
  const [section, setSection] = useState<DraftSection | null>(null);
  const [content, setContent] = useState<ProcessStepsContent>(processStepsDefaultContent);
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<SavingAction>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const validation = useFormFieldErrors();

  useEffect(() => {
    let active = true;
    apiClient
      .get<DraftPage>("cms/admin/pages/process")
      .then((draft) => {
        if (!active) return;
        setPage(draft);
        const found = draft.sections.find((candidate) => candidate.type === PROCESS_STEPS_TYPE);
        if (!found) return;
        setSection(found);
        setVisible(found.draftIsVisible);
        if (isProcessStepsDraftContent(found.draftContent)) setContent(found.draftContent);
        else
          setError(
            "This draft has an unsupported structure. Reload it before editing to avoid replacing content.",
          );
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof ApiError ? cause.message : "Unable to load the Process page draft.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function updateContent<K extends keyof ProcessStepsContent>(
    key: K,
    value: ProcessStepsContent[K],
  ) {
    setContent((current) => ({ ...current, [key]: value }));
    setMessage("");
    setError("");
    validation.clear(formFieldId(FORM_ID, String(key)));
  }

  function updateStep(id: string, patch: Partial<ProcessStep>) {
    const current = [...content.steps].sort((a, b) => a.order - b.order);
    const index = current.findIndex((step) => step.id === id);
    if (index < 0) return;
    current[index] = { ...current[index], ...patch };
    updateContent("steps", orderSteps(current));
    if (patch.enabled === false) {
      validation.clear(formFieldId(FORM_ID, `step-${id}-title`));
      validation.clear(formFieldId(FORM_ID, `step-${id}-summary`));
      validation.clear(formFieldId(FORM_ID, `step-${id}-description`));
      validation.clear(formFieldId(FORM_ID, `step-${id}-image`));
      validation.clear(formFieldId(FORM_ID, `step-${id}-image-alt`));
    }
  }

  function moveStep(index: number, delta: number) {
    const ordered = [...content.steps].sort((a, b) => a.order - b.order);
    const target = index + delta;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    validation.clear();
    updateContent("steps", orderSteps(ordered));
  }

  function addStep() {
    validation.clear();
    const ordered = [...content.steps].sort((a, b) => a.order - b.order);
    updateContent("steps", [...ordered, createStep(ordered.length)]);
  }

  function duplicateStep(index: number) {
    const ordered = [...content.steps].sort((a, b) => a.order - b.order);
    const source = ordered[index];
    if (!source) return;
    const duplicate = { ...source, id: newStepId(), order: index + 1, enabled: false };
    ordered.splice(index + 1, 0, duplicate);
    updateContent("steps", orderSteps(ordered));
  }

  function removeStep(index: number) {
    const ordered = [...content.steps].sort((a, b) => a.order - b.order);
    const step = ordered[index];
    if (!step) return;
    const label = step.title.trim() || `Step ${index + 1}`;
    if (
      !globalThis.confirm(
        `Remove “${label}” from the draft? Its uploaded image will remain in the media library.`,
      )
    )
      return;
    validation.clear();
    updateContent("steps", orderSteps(ordered.filter((candidate) => candidate.id !== step.id)));
  }

  async function save(publish = false) {
    if (!section) return;
    setMessage("");
    setError("");
    if (!isProcessStepsDraftContent(content)) {
      setError(
        "The draft structure is invalid. Reload the page before saving so no CMS content is lost.",
      );
      return;
    }
    if (publish) {
      const issues = validateFormFields(pageRules(content, true));
      const complete = isProcessStepsContent(content);
      if (issues.length || !complete) {
        validation.report(
          issues.length
            ? issues
            : [
                {
                  id: formFieldId(FORM_ID, "heading"),
                  label: "Process content",
                  message:
                    "Complete every enabled step, add its image, and provide descriptive alt text or mark that image decorative.",
                },
              ],
        );
        return;
      }
    } else {
      validation.clear();
    }

    setSaving(publish ? "publish" : "draft");
    try {
      const saved = await apiClient.patch<DraftSection>(`cms/admin/sections/${section.id}`, {
        content,
        isVisible: visible,
      });
      setSection(saved);
      if (!publish) {
        setMessage(
          "Draft saved. The public Process page is unchanged until you publish this section.",
        );
        return;
      }
      try {
        const published = await apiClient.post<DraftSection>(
          `cms/admin/sections/${section.id}/publish`,
        );
        setSection(published);
        setMessage("Process content published.");
      } catch (cause) {
        setError(
          `${cause instanceof ApiError ? cause.message : "Publishing failed."} The draft was saved; the published version is unchanged.`,
        );
      }
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the Process page draft.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="space-y-4">
        <h1 className="text-3xl font-semibold">Process story</h1>
        <p className="text-muted-foreground">Loading Process page draft…</p>
      </section>
    );
  }
  if (!page || !section) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Website CMS / Our Process
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Process story</h1>
        </header>
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </p>
        ) : (
          <p className="rounded-lg border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
            The Process draft is not seeded yet. Run <code>pnpm cms:seed:process</code> in the
            backend, then reload this page.
          </p>
        )}
      </section>
    );
  }

  const orderedSteps = [...content.steps].sort((a, b) => a.order - b.order);
  const enabledCount = orderedSteps.filter((step) => step.enabled).length;
  const publishedContent = isProcessStepsContent(section.publishedContent)
    ? section.publishedContent
    : null;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Our Process
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Process story</h1>
        <p className="max-w-3xl text-muted-foreground">
          Manage the page introduction and an ordered collection of process steps. Add as many steps
          as the studio needs; only enabled, complete steps appear publicly.
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
            description="Use approved studio language. Search metadata is optional and falls back to the page heading and introduction."
          >
            <SwitchField
              checked={content.enabled}
              description="When enabled, two or more visible steps use the scroll-driven story on desktop. Mobile and reduced-motion visitors always receive a readable list."
              label="Enable immersive scroll story"
              onChange={(enabled) => updateContent("enabled", enabled)}
            />
            <SwitchField
              checked={visible}
              description="Turn this off to keep the published section hidden from the public Process page."
              label="Show process content on the public page"
              onChange={setVisible}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={formFieldId(FORM_ID, "eyebrow")}
                label="Page eyebrow"
                maxLength={100}
                value={content.eyebrow}
                onChange={(event) => updateContent("eyebrow", event.target.value)}
              />
              <TextField
                id={formFieldId(FORM_ID, "heading")}
                label="Page heading"
                maxLength={160}
                required
                error={fieldErrorMessage(validation.errors, formFieldId(FORM_ID, "heading"))}
                value={content.heading}
                onChange={(event) => updateContent("heading", event.target.value)}
              />
            </div>
            <TextareaField
              id={formFieldId(FORM_ID, "description")}
              label="Page introduction"
              maxLength={360}
              value={content.description}
              onChange={(event) => updateContent("description", event.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={formFieldId(FORM_ID, "seoTitle")}
                label="Search title"
                maxLength={180}
                value={content.seoTitle}
                onChange={(event) => updateContent("seoTitle", event.target.value)}
              />
              <TextareaField
                id={formFieldId(FORM_ID, "seoDescription")}
                label="Search description"
                maxLength={320}
                value={content.seoDescription}
                onChange={(event) => updateContent("seoDescription", event.target.value)}
              />
            </div>
            <TextField
              id={formFieldId(FORM_ID, "skipLinkLabel")}
              label="Text alternative button label"
              maxLength={100}
              value={content.skipLinkLabel}
              onChange={(event) => updateContent("skipLinkLabel", event.target.value)}
              description="Shown in the desktop story so visitors can switch to the full written process."
            />
          </FormSection>

          <FormSection
            title={`Process steps (${enabledCount} enabled)`}
            description="Each enabled step needs a title, concise summary, detailed explanation, and an uploaded image. Add, duplicate, hide, delete, or reorder without a fixed item count."
          >
            <div className="space-y-5">
              {orderedSteps.map((step, index) => {
                const itemId = (field: string) => formFieldId(FORM_ID, `step-${step.id}-${field}`);
                const imageAlt = step.imageAlt;
                return (
                  <fieldset
                    key={step.id}
                    className="space-y-5 rounded-xl border border-border p-4 sm:p-5"
                  >
                    <legend className="sr-only">Step {index + 1}</legend>
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
                      <div>
                        <p className="text-sm font-semibold">Step {index + 1}</p>
                        <p className="text-xs text-muted-foreground">
                          Order {index + 1} · stable item ID retained
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <ActionButton
                          aria-label={`Move step ${index + 1} up`}
                          disabled={index === 0 || Boolean(saving)}
                          onClick={() => moveStep(index, -1)}
                          className="h-11 w-11"
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <ArrowUp aria-hidden="true" />
                        </ActionButton>
                        <ActionButton
                          aria-label={`Move step ${index + 1} down`}
                          disabled={index === orderedSteps.length - 1 || Boolean(saving)}
                          onClick={() => moveStep(index, 1)}
                          className="h-11 w-11"
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <ArrowDown aria-hidden="true" />
                        </ActionButton>
                        <ActionButton
                          aria-label={`Duplicate step ${index + 1}`}
                          disabled={Boolean(saving)}
                          onClick={() => duplicateStep(index)}
                          className="h-11 w-11"
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <CopyPlus aria-hidden="true" />
                        </ActionButton>
                        <ActionButton
                          aria-label={`Remove step ${index + 1}`}
                          disabled={Boolean(saving)}
                          onClick={() => removeStep(index)}
                          className="h-11 w-11"
                          size="icon"
                          type="button"
                          variant="outline"
                        >
                          <Trash2 aria-hidden="true" />
                        </ActionButton>
                      </div>
                    </div>
                    <SwitchField
                      checked={step.enabled}
                      description="Disabled steps remain in the draft and can be enabled later."
                      label={`Show step ${index + 1} publicly`}
                      onChange={(enabled) => updateStep(step.id, { enabled })}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField
                        id={itemId("eyebrow")}
                        label="Optional step eyebrow"
                        maxLength={100}
                        value={step.eyebrow}
                        onChange={(event) => updateStep(step.id, { eyebrow: event.target.value })}
                      />
                      <TextField
                        id={itemId("title")}
                        label="Step title"
                        maxLength={120}
                        required={step.enabled}
                        error={fieldErrorMessage(validation.errors, itemId("title"))}
                        value={step.title}
                        onChange={(event) => updateStep(step.id, { title: event.target.value })}
                      />
                    </div>
                    <TextareaField
                      id={itemId("summary")}
                      label="Concise summary"
                      maxLength={320}
                      required={step.enabled}
                      error={fieldErrorMessage(validation.errors, itemId("summary"))}
                      value={step.summary}
                      onChange={(event) => updateStep(step.id, { summary: event.target.value })}
                    />
                    <TextareaField
                      id={itemId("description")}
                      label="Optional detailed explanation"
                      maxLength={2400}
                      error={fieldErrorMessage(validation.errors, itemId("description"))}
                      value={step.description}
                      onChange={(event) => updateStep(step.id, { description: event.target.value })}
                    />
                    <ImageUploadField
                      allowLibrary
                      description="Choose a process-specific interior image from Cloudinary or the media library."
                      error={fieldErrorMessage(validation.errors, itemId("image"))}
                      id={itemId("image")}
                      label="Step image"
                      onChange={(image) =>
                        updateStep(step.id, {
                          image: image
                            ? {
                                publicId: image.publicId,
                                url: image.url,
                                width: image.width,
                                height: image.height,
                              }
                            : null,
                        })
                      }
                      required={step.enabled}
                      value={mediaForUpload(step.image, imageAlt)}
                    />
                    <SwitchField
                      checked={step.imageDecorative}
                      description="Decorative images use an empty alt attribute; otherwise write a concise description below."
                      label={`Mark step ${index + 1} image decorative`}
                      onChange={(imageDecorative) => updateStep(step.id, { imageDecorative })}
                    />
                    {!step.imageDecorative ? (
                      <TextField
                        id={itemId("image-alt")}
                        label="Image alt text"
                        maxLength={240}
                        required={step.enabled}
                        error={fieldErrorMessage(validation.errors, itemId("image-alt"))}
                        value={step.imageAlt}
                        onChange={(event) => updateStep(step.id, { imageAlt: event.target.value })}
                      />
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <SelectField
                        id={itemId("image-position")}
                        label="Image focal point"
                        value={step.imagePosition}
                        onChange={(event) =>
                          updateStep(step.id, {
                            imagePosition: event.target.value as ProcessStep["imagePosition"],
                          })
                        }
                      >
                        {focalPointOptions.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </SelectField>
                      <TextField
                        id={itemId("caption")}
                        label="Optional secondary caption"
                        maxLength={180}
                        value={step.secondaryCaption}
                        onChange={(event) =>
                          updateStep(step.id, { secondaryCaption: event.target.value })
                        }
                      />
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <ActionButton
              className="min-h-11"
              disabled={Boolean(saving)}
              onClick={addStep}
              type="button"
              variant="outline"
            >
              <Plus aria-hidden="true" /> Add process step
            </ActionButton>
          </FormSection>

          <div className="flex flex-wrap gap-3 border-t border-border pt-5">
            <ActionButton
              className="min-h-11 px-5"
              disabled={Boolean(saving)}
              loading={saving === "draft"}
              onClick={() => void save(false)}
              type="button"
              variant="outline"
            >
              Save draft
            </ActionButton>
            <ActionButton
              className="min-h-11 px-5"
              disabled={Boolean(saving)}
              loading={saving === "publish"}
              onClick={() => void save(true)}
              type="button"
            >
              Publish section
            </ActionButton>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Publishing checklist</h2>
            <ul className="mt-3 list-inside list-disc space-y-2 text-sm text-muted-foreground">
              <li>Only publish claims approved by the studio.</li>
              <li>Every enabled step needs a real image and accessible text alternative.</li>
              <li>Disabled steps keep their draft content but stay out of the public story.</li>
              <li>Mobile and reduced-motion visitors see the written reading layout.</li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Published version</h2>
            {publishedContent ? (
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                <p>{publishedContent.heading}</p>
                <p>{publishedContent.steps.filter((step) => step.enabled).length} enabled steps</p>
                <p>Scroll story {publishedContent.enabled ? "enabled" : "disabled"}</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No Process content has been published yet.
              </p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
