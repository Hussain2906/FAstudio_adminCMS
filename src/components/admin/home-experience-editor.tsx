"use client";

import {
  HOME_EXPERIENCE_TYPE,
  type HomeExperienceContent,
  type HomeExperienceServiceCard,
} from "@fs/cms-contracts";
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
  draftContent: HomeExperienceContent;
  draftIsVisible: boolean;
};
type DraftPage = { sections: DraftSection[] };

const destinationOptions = [
  ["services", "Services"],
  ["portfolio", "Our Work"],
  ["process", "The Process"],
  ["contact", "Contact"],
  ["about", "About"],
  ["home", "Home"],
] as const;

function toImageValue(asset: HomeExperienceServiceCard["image"], alt: string) {
  return asset ? { ...asset, alt } : undefined;
}

const formId = "home-experience";

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

function experienceRules(content: HomeExperienceContent, publish: boolean): FormFieldRule[] {
  const statistics = Array.isArray(content.statistics) ? content.statistics : [];
  const services = Array.isArray(content.services) ? content.services : [];
  const rules: FormFieldRule[] = [
    {
      id: formFieldId(formId, "statistics"),
      label: "Statistics",
      value: content.statistics,
      validate: (value) => Array.isArray(value) && value.length === 4,
      invalidMessage:
        "The statistics section must contain exactly four rows. Reload the draft to restore its structure.",
    },
    {
      id: formFieldId(formId, "services"),
      label: "Services gallery",
      value: content.services,
      validate: (value) => Array.isArray(value) && value.length === 3,
      invalidMessage:
        "The services gallery must contain exactly three cards. Reload the draft to restore its structure.",
    },
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
      required: true,
      maxLength: 300,
    },
    {
      id: formFieldId(formId, "main-image"),
      label: "Main image",
      value: content.mainImage,
      required: publish,
      validate: (value) => value === null || isMediaAssetValue(value),
      requiredMessage: "Upload the main image before publishing.",
      invalidMessage: "Choose a valid uploaded image.",
    },
    {
      id: formFieldId(formId, "main-image-alt"),
      label: "Main image alt text",
      value: content.mainImageAlt,
      required: publish,
      maxLength: 160,
    },
  ];

  statistics.forEach((statistic, index) => {
    const number = index + 1;
    rules.push(
      {
        id: formFieldId(formId, `statistic-${number}-value`),
        label: `Statistic ${number} value`,
        value: statistic.value,
        validate: (value) =>
          typeof value === "number" &&
          Number.isFinite(value) &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 1_000_000,
        invalidMessage: "Enter a whole number from 0 to 1,000,000.",
      },
      {
        id: formFieldId(formId, `statistic-${number}-suffix`),
        label: `Statistic ${number} suffix`,
        value: statistic.suffix,
        maxLength: 4,
      },
      {
        id: formFieldId(formId, `statistic-${number}-label`),
        label: `Statistic ${number} label`,
        value: statistic.label,
        required: true,
        maxLength: 80,
      },
      {
        id: formFieldId(formId, `statistic-${number}-accessible-description`),
        label: `Statistic ${number} accessible description`,
        value: statistic.accessibleDescription,
        maxLength: 160,
        validate: (value) => !publish || typeof value === "string",
        invalidMessage: "Enter an accessible description or leave it blank.",
      },
    );
  });

  services.forEach((card, index) => {
    const number = index + 1;
    rules.push(
      {
        id: formFieldId(formId, `service-${number}-title`),
        label: `Card ${number} title`,
        value: card.title,
        required: true,
        maxLength: 80,
      },
      {
        id: formFieldId(formId, `service-${number}-subtitle`),
        label: `Card ${number} subtitle`,
        value: card.subtitle,
        required: true,
        maxLength: 120,
      },
      {
        id: formFieldId(formId, `service-${number}-image`),
        label: `Card ${number} image`,
        value: card.image,
        required: publish,
        validate: (value) => value === null || isMediaAssetValue(value),
        requiredMessage: "Upload an image before publishing this card.",
        invalidMessage: "Choose a valid uploaded image.",
      },
      {
        id: formFieldId(formId, `service-${number}-image-alt`),
        label: `Card ${number} image alt text`,
        value: card.imageAlt,
        required: publish,
        maxLength: 160,
      },
      {
        id: formFieldId(formId, `service-${number}-destination`),
        label: `Card ${number} destination`,
        value: card.destination,
        validate: (value) => destinationOptions.some(([destination]) => destination === value),
        invalidMessage: "Choose a supported destination.",
      },
    );
  });

  return rules;
}

export function HomeExperienceEditor() {
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<HomeExperienceContent>();
  const [isVisible, setIsVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const validation = useFormFieldErrors();

  useEffect(() => {
    apiClient
      .get<DraftPage>("cms/admin/pages/home")
      .then((page) => {
        const found = page.sections.find((candidate) => candidate.type === HOME_EXPERIENCE_TYPE);
        if (found) {
          setSection(found);
          setContent(found.draftContent);
          setIsVisible(found.draftIsVisible);
        }
      })
      .catch(() => setError("Unable to load the Built on Experience draft."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof HomeExperienceContent>(key: K, value: HomeExperienceContent[K]) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  function updateStatistic(
    index: number,
    key: "value" | "suffix" | "label" | "accessibleDescription",
    value: string | number,
  ) {
    if (!content) return;
    const statistics = [...content.statistics] as [...HomeExperienceContent["statistics"]];
    statistics[index] = { ...statistics[index], [key]: value };
    update("statistics", statistics);
  }

  function updateService(index: number, patch: Partial<HomeExperienceServiceCard>) {
    if (!content) return;
    const services = [...content.services] as [...HomeExperienceContent["services"]];
    services[index] = { ...services[index], ...patch };
    update("services", services);
  }

  async function save(publish = false) {
    if (!section || !content) return;
    const issues = validateFormFields(experienceRules(content, publish));
    if (issues.length) {
      validation.report(issues);
      setMessage(undefined);
      setError(undefined);
      return;
    }
    validation.clear();
    setSaving(true);
    setMessage(undefined);
    setError(undefined);
    try {
      await apiClient.patch(`cms/admin/sections/${section.id}`, { content, isVisible });
      if (publish) await apiClient.post(`cms/admin/sections/${section.id}/publish`);
      setMessage(
        publish
          ? "Draft saved and published."
          : "Draft saved. The Home page is unchanged until publishing.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the Built on Experience draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading Built on Experience draft…</p>;
  if (!section || !content)
    return (
      <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        The section is not seeded yet. Run <code>pnpm cms:seed:home-experience</code> in the
        backend, then reload this page.
      </p>
    );

  const statistics = Array.isArray(content.statistics) ? content.statistics : [];
  const services = Array.isArray(content.services) ? content.services : [];
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Home / Built on Experience
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Built on Experience</h1>
        <p className="max-w-2xl text-muted-foreground">
          Edit the Home foundation story, approved statistics, and three-card services gallery.
          Claims should be verified before publishing.
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
          description="The editorial introduction visitors see below the Hero."
          title="Introduction"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={formFieldId(formId, "eyebrow")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "eyebrow"))}
              label="Eyebrow"
              onChange={(event) => update("eyebrow", event.target.value)}
              required
              value={content.eyebrow}
            />
            <TextField
              id={formFieldId(formId, "heading")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "heading"))}
              label="Heading"
              onChange={(event) => update("heading", event.target.value)}
              required
              value={content.heading}
            />
          </div>
          <TextareaField
            id={formFieldId(formId, "description")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "description"))}
            label="Description"
            onChange={(event) => update("description", event.target.value)}
            required
            value={content.description}
          />
          <ImageUploadField
            id={formFieldId(formId, "main-image")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "main-image"))}
            description="JPEG, PNG, WebP, or AVIF · Maximum 10 MB. Required to publish."
            label="Main image"
            onChange={(image) =>
              update(
                "mainImage",
                image
                  ? {
                      publicId: image.publicId,
                      url: image.url,
                      width: image.width,
                      height: image.height,
                    }
                  : null,
              )
            }
            value={toImageValue(content.mainImage, content.mainImageAlt)}
          />
          <TextField
            id={formFieldId(formId, "main-image-alt")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "main-image-alt"))}
            description="Describe the architecture and visual subject for assistive technology. Required to publish."
            label="Main image alt text"
            onChange={(event) => update("mainImageAlt", event.target.value)}
            value={content.mainImageAlt}
          />
        </FormSection>
        <FormSection
          description="Exactly four fixed statistics are displayed in the design."
          title="Statistics"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            {statistics.map((statistic, index) => (
              <div className="space-y-4 rounded-lg border border-border p-4" key={index}>
                <p className="text-sm font-semibold">Statistic {index + 1}</p>
                <div className="grid grid-cols-[1fr_5rem] gap-3">
                  <TextField
                    id={formFieldId(formId, `statistic-${index + 1}-value`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `statistic-${index + 1}-value`),
                    )}
                    label="Value"
                    min={0}
                    max={1_000_000}
                    onChange={(event) =>
                      updateStatistic(index, "value", Number(event.target.value))
                    }
                    required
                    type="number"
                    value={String(statistic.value)}
                  />
                  <TextField
                    id={formFieldId(formId, `statistic-${index + 1}-suffix`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `statistic-${index + 1}-suffix`),
                    )}
                    label="Suffix"
                    maxLength={4}
                    onChange={(event) => updateStatistic(index, "suffix", event.target.value)}
                    value={statistic.suffix}
                  />
                </div>
                <TextField
                  id={formFieldId(formId, `statistic-${index + 1}-label`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `statistic-${index + 1}-label`),
                  )}
                  label="Label"
                  maxLength={80}
                  onChange={(event) => updateStatistic(index, "label", event.target.value)}
                  required
                  value={statistic.label}
                />
                <TextField
                  id={formFieldId(formId, `statistic-${index + 1}-accessible-description`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `statistic-${index + 1}-accessible-description`),
                  )}
                  description="Optional clarification for screen readers."
                  label="Accessible description"
                  maxLength={160}
                  onChange={(event) =>
                    updateStatistic(index, "accessibleDescription", event.target.value)
                  }
                  value={statistic.accessibleDescription ?? ""}
                />
              </div>
            ))}
          </div>
          {fieldErrorMessage(validation.errors, formFieldId(formId, "statistics")) ? (
            <p
              aria-live="polite"
              className="text-sm text-destructive"
              id={formFieldId(formId, "statistics")}
              tabIndex={-1}
            >
              {fieldErrorMessage(validation.errors, formFieldId(formId, "statistics"))}
            </p>
          ) : null}
        </FormSection>
        <FormSection
          description="Exactly three cards are displayed in the services gallery."
          title="Services gallery"
        >
          <div className="grid gap-6">
            {services.map((card, index) => (
              <div className="space-y-5 rounded-lg border border-border p-4 sm:p-5" key={index}>
                <p className="text-sm font-semibold">Card {index + 1}</p>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    id={formFieldId(formId, `service-${index + 1}-title`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `service-${index + 1}-title`),
                    )}
                    label="Title"
                    onChange={(event) => updateService(index, { title: event.target.value })}
                    required
                    value={card.title}
                  />
                  <TextField
                    id={formFieldId(formId, `service-${index + 1}-subtitle`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `service-${index + 1}-subtitle`),
                    )}
                    label="Subtitle"
                    onChange={(event) => updateService(index, { subtitle: event.target.value })}
                    required
                    value={card.subtitle}
                  />
                </div>
                <ImageUploadField
                  id={formFieldId(formId, `service-${index + 1}-image`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `service-${index + 1}-image`),
                  )}
                  description="JPEG, PNG, WebP, or AVIF · Maximum 10 MB. Required to publish."
                  label="Card image"
                  onChange={(image) =>
                    updateService(index, {
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
                  value={toImageValue(card.image, card.imageAlt)}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    id={formFieldId(formId, `service-${index + 1}-image-alt`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `service-${index + 1}-image-alt`),
                    )}
                    description="Required to publish when an image is selected."
                    label="Image alt text"
                    onChange={(event) => updateService(index, { imageAlt: event.target.value })}
                    value={card.imageAlt}
                  />
                  <SelectField
                    id={formFieldId(formId, `service-${index + 1}-destination`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `service-${index + 1}-destination`),
                    )}
                    label="Destination"
                    onChange={(event) =>
                      updateService(index, {
                        destination: event.target.value as HomeExperienceServiceCard["destination"],
                      })
                    }
                    value={card.destination}
                  >
                    {destinationOptions.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </SelectField>
                </div>
              </div>
            ))}
          </div>
          {fieldErrorMessage(validation.errors, formFieldId(formId, "services")) ? (
            <p
              aria-live="polite"
              className="text-sm text-destructive"
              id={formFieldId(formId, "services")}
              tabIndex={-1}
            >
              {fieldErrorMessage(validation.errors, formFieldId(formId, "services"))}
            </p>
          ) : null}
        </FormSection>
        <FormSection
          description="Visibility is saved as part of the draft and takes effect only when published."
          title="Section settings"
        >
          <SwitchField
            checked={isVisible}
            label="Visible on the published Home page"
            onChange={setIsVisible}
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
