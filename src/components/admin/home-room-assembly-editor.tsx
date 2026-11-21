"use client";

import {
  HOME_ROOM_ASSEMBLY_TYPE,
  type HomeRoomAssemblyContent,
  type RoomAnimationPreset,
  type RoomSceneElement,
  type RoomSceneElementType,
} from "@fs/cms-contracts";
import { useEffect, useState } from "react";
import { apiClient, ApiError } from "../../lib/api/client";
import {
  ActionButton,
  CheckboxField,
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
  draftContent: HomeRoomAssemblyContent;
  draftIsVisible: boolean;
};
type DraftPage = { sections: DraftSection[] };
type ImageKey =
  | "backdropImage"
  | "sofaImage"
  | "pillowsImage"
  | "centerTableImage"
  | "vaseImage"
  | "accentChairImage";
type AltKey =
  "backdropAlt" | "sofaAlt" | "pillowsAlt" | "centerTableAlt" | "vaseAlt" | "accentChairAlt";

const assets: readonly {
  image: ImageKey;
  alt: AltKey;
  label: string;
  required?: boolean;
  description: string;
}[] = [
  {
    image: "backdropImage",
    alt: "backdropAlt",
    label: "Empty-room backdrop",
    required: true,
    description: "Use the supplied empty-room composition. Do not crop or distort it.",
  },
  {
    image: "sofaImage",
    alt: "sofaAlt",
    label: "Sofa layer",
    required: true,
    description: "Prefer a transparent PNG/WebP with the sofa isolated.",
  },
  {
    image: "vaseImage",
    alt: "vaseAlt",
    label: "Vase / planter layer",
    required: true,
    description: "Prefer a transparent layer aligned to the backdrop perspective.",
  },
  {
    image: "centerTableImage",
    alt: "centerTableAlt",
    label: "Center table layer",
    required: true,
    description: "Prefer a transparent layer with no surrounding room background.",
  },
  {
    image: "pillowsImage",
    alt: "pillowsAlt",
    label: "Pillows layer",
    required: true,
    description: "Prefer a transparent layer that includes only the cushions.",
  },
  {
    image: "accentChairImage",
    alt: "accentChairAlt",
    label: "Optional accent chair layer",
    description: "Optional. Leave empty when the supplied composition does not need it.",
  },
];

const elementTypes: readonly {
  value: RoomSceneElementType;
  label: string;
  preset: RoomAnimationPreset;
}[] = [
  { value: "rug", label: "Rug / Carpet", preset: "floor-reveal" },
  { value: "table-vase", label: "Table vase", preset: "gentle-settle" },
  { value: "decorative-bowl", label: "Decorative bowl", preset: "gentle-settle" },
  { value: "decor", label: "Decor", preset: "gentle-settle" },
  { value: "accent-furniture", label: "Accent furniture", preset: "from-right" },
];
const animationPresets: readonly { value: RoomAnimationPreset; label: string }[] = [
  { value: "floor-reveal", label: "Floor reveal" },
  { value: "from-left", label: "From left" },
  { value: "from-right", label: "From right" },
  { value: "from-top", label: "From top" },
  { value: "from-bottom", label: "From bottom" },
  { value: "gentle-settle", label: "Gentle settle" },
];

function imageValue(content: HomeRoomAssemblyContent, image: ImageKey, alt: AltKey) {
  const asset = content[image];
  return asset ? { ...asset, alt: content[alt] ?? "" } : undefined;
}

const formId = "home-room-assembly";
const roomDestinations = ["home", "about", "services", "portfolio", "process", "contact"];

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

function roomRules(content: HomeRoomAssemblyContent, publish: boolean): FormFieldRule[] {
  const rules: FormFieldRule[] = [
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
      label: "Supporting text",
      value: content.description,
      maxLength: 300,
    },
    {
      id: formFieldId(formId, "primaryCtaLabel"),
      label: "Primary CTA label",
      value: content.primaryCtaLabel,
      maxLength: 100,
      validate: (value) =>
        value === undefined || (typeof value === "string" && value.trim().length > 0),
      invalidMessage: "Enter CTA text or leave the field unset.",
    },
    {
      id: formFieldId(formId, "primaryCtaDestination"),
      label: "Primary CTA destination",
      value: content.primaryCtaDestination,
      validate: (value) => value === undefined || roomDestinations.includes(String(value)),
      invalidMessage: "Choose a supported destination.",
    },
    {
      id: formFieldId(formId, "secondaryCtaLabel"),
      label: "Secondary CTA label",
      value: content.secondaryCtaLabel,
      maxLength: 100,
      validate: (value) =>
        value === undefined || (typeof value === "string" && value.trim().length > 0),
      invalidMessage: "Enter CTA text or leave the field unset.",
    },
    {
      id: formFieldId(formId, "secondaryCtaDestination"),
      label: "Secondary CTA destination",
      value: content.secondaryCtaDestination,
      validate: (value) => value === undefined || roomDestinations.includes(String(value)),
      invalidMessage: "Choose a supported destination.",
    },
  ];

  for (const asset of assets) {
    const value = content[asset.image];
    const altValue = content[asset.alt];
    const isOptional = asset.image === "accentChairImage";
    rules.push(
      {
        id: formFieldId(formId, asset.image),
        label: asset.label,
        value,
        required: publish && Boolean(asset.required),
        validate: (candidate) =>
          (isOptional && candidate === undefined) ||
          candidate === null ||
          isMediaAssetValue(candidate),
        requiredMessage: `Upload ${asset.label.toLowerCase()} before publishing.`,
        invalidMessage: `Choose a valid ${asset.label.toLowerCase()} asset.`,
      },
      {
        id: formFieldId(formId, asset.alt),
        label: `${asset.label} alt text`,
        value: altValue,
        required: publish && (Boolean(asset.required) || (isOptional && Boolean(value))),
        maxLength: 180,
        validate: (candidate) =>
          candidate === undefined ? isOptional : typeof candidate === "string",
        requiredMessage: `Describe the ${asset.label.toLowerCase()} before publishing.`,
        invalidMessage: "Enter alt text with 180 characters or fewer.",
      },
    );
  }

  const rawElements = content.additionalElements;
  const elements = Array.isArray(rawElements)
    ? rawElements.filter(
        (element): element is RoomSceneElement => Boolean(element) && typeof element === "object",
      )
    : [];
  rules.push({
    id: formFieldId(formId, "additional-elements"),
    label: "Additional scene elements",
    value: rawElements === undefined ? [] : rawElements,
    validate: (value) =>
      Array.isArray(value) &&
      value.length <= 8 &&
      value.every((element) => Boolean(element) && typeof element === "object"),
    invalidMessage: "Remove malformed scene rows or keep the list to eight elements or fewer.",
  });
  elements.forEach((element) => {
    const prefix = `element-${element.id}`;
    rules.push(
      {
        id: formFieldId(formId, `${prefix}-type`),
        label: "Element type",
        value: element.type,
        validate: (value) =>
          elementTypes.some((item) => item.value === value) &&
          /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(element.id),
        invalidMessage:
          "Choose a supported type, or remove and re-add this row if its internal ID is invalid.",
      },
      {
        id: formFieldId(formId, `${prefix}-animation-preset`),
        label: "Animation preset",
        value: element.animationPreset,
        validate: (value) => animationPresets.some((item) => item.value === value),
        invalidMessage: "Choose a supported animation preset.",
      },
      {
        id: formFieldId(formId, `${prefix}-image`),
        label: "Element image",
        value: element.image,
        required: publish && element.enabled,
        validate: (value) => value === null || isMediaAssetValue(value),
        requiredMessage: "Upload an image before publishing this enabled element.",
        invalidMessage: "Choose a valid uploaded image.",
      },
      {
        id: formFieldId(formId, `${prefix}-alt`),
        label: "Element image alt text",
        value: element.alt,
        required: publish && element.enabled,
        maxLength: 180,
        validate: (value) => typeof value === "string",
        requiredMessage: "Describe this enabled element before publishing.",
        invalidMessage: "Enter image alt text with 180 characters or fewer.",
      },
      {
        id: formFieldId(formId, `${prefix}-enabled`),
        label: "Element enabled state",
        value: element.enabled,
        validate: (value) => typeof value === "boolean",
        invalidMessage: "Choose whether this element is enabled in the scene.",
      },
    );
  });
  return rules;
}

export function HomeRoomAssemblyEditor() {
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<HomeRoomAssemblyContent>();
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
        const found = page.sections.find((candidate) => candidate.type === HOME_ROOM_ASSEMBLY_TYPE);
        if (found) {
          setSection(found);
          setContent(found.draftContent);
          setIsVisible(found.draftIsVisible);
        }
      })
      .catch(() => setError("Unable to load the Room Assembly draft."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof HomeRoomAssemblyContent>(
    key: K,
    value: HomeRoomAssemblyContent[K],
  ) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  function updateElement(id: string, patch: Partial<RoomSceneElement>) {
    setContent((current) =>
      current
        ? {
            ...current,
            additionalElements: (Array.isArray(current.additionalElements)
              ? current.additionalElements
              : []
            ).map((element) =>
              element && typeof element === "object" && element.id === id
                ? { ...element, ...patch }
                : element,
            ),
          }
        : current,
    );
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  function addElement() {
    const definition = elementTypes[0];
    const element: RoomSceneElement = {
      id: `element-${Date.now()}`,
      type: definition.value,
      image: null,
      alt: "",
      enabled: true,
      animationPreset: definition.preset,
    };
    setContent((current) =>
      current
        ? {
            ...current,
            additionalElements: [
              ...(Array.isArray(current.additionalElements) ? current.additionalElements : []),
              element,
            ],
          }
        : current,
    );
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  function removeElement(id: string) {
    setContent((current) =>
      current
        ? {
            ...current,
            additionalElements: (Array.isArray(current.additionalElements)
              ? current.additionalElements
              : []
            ).filter((element) => !element || typeof element !== "object" || element.id !== id),
          }
        : current,
    );
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  async function save(publish = false) {
    if (!section || !content) return;
    const issues = validateFormFields(roomRules(content, publish));
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
          ? "Room Assembly draft saved and published."
          : "Draft saved. The live Home page is unchanged until publishing.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the Room Assembly draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading Room Assembly draft…</p>;
  if (!section || !content)
    return (
      <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        The section is not seeded yet. Run <code>pnpm cms:seed:home-room-assembly</code> in the
        backend, then reload this page.
      </p>
    );

  const elements = Array.isArray(content.additionalElements)
    ? content.additionalElements.filter(
        (element): element is RoomSceneElement => Boolean(element) && typeof element === "object",
      )
    : [];
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Home / Room Assembly
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Room Assembly</h1>
        <p className="max-w-2xl text-muted-foreground">
          Manage the room backdrop and isolated furniture layers. Scroll choreography, final
          positions, pinning, and mobile behavior are intentionally code-owned.
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
          description="This copy remains restrained so the room composition stays dominant."
          title="Section introduction"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={formFieldId(formId, "eyebrow")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "eyebrow"))}
              maxLength={100}
              label="Eyebrow"
              onChange={(event) => update("eyebrow", event.target.value)}
              required
              value={content.eyebrow}
            />
            <TextField
              id={formFieldId(formId, "heading")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "heading"))}
              maxLength={160}
              label="Heading"
              onChange={(event) => update("heading", event.target.value)}
              required
              value={content.heading}
            />
          </div>
          <TextareaField
            id={formFieldId(formId, "description")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "description"))}
            maxLength={300}
            label="Supporting text"
            onChange={(event) => update("description", event.target.value)}
            value={content.description}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={formFieldId(formId, "primaryCtaLabel")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "primaryCtaLabel"))}
              maxLength={100}
              label="Primary CTA label"
              onChange={(event) => update("primaryCtaLabel", event.target.value)}
              value={content.primaryCtaLabel ?? "View Our Work"}
            />
            <SelectField
              id={formFieldId(formId, "primaryCtaDestination")}
              error={fieldErrorMessage(
                validation.errors,
                formFieldId(formId, "primaryCtaDestination"),
              )}
              label="Primary CTA destination"
              onChange={(event) =>
                update(
                  "primaryCtaDestination",
                  event.target.value as HomeRoomAssemblyContent["primaryCtaDestination"],
                )
              }
              value={content.primaryCtaDestination ?? "portfolio"}
            >
              {["home", "about", "services", "portfolio", "process", "contact"].map(
                (destination) => (
                  <option key={destination} value={destination}>
                    {destination}
                  </option>
                ),
              )}
            </SelectField>
            <TextField
              id={formFieldId(formId, "secondaryCtaLabel")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "secondaryCtaLabel"))}
              maxLength={100}
              label="Secondary CTA label"
              onChange={(event) => update("secondaryCtaLabel", event.target.value)}
              value={content.secondaryCtaLabel ?? "Book Consultation"}
            />
            <SelectField
              id={formFieldId(formId, "secondaryCtaDestination")}
              error={fieldErrorMessage(
                validation.errors,
                formFieldId(formId, "secondaryCtaDestination"),
              )}
              label="Secondary CTA destination"
              onChange={(event) =>
                update(
                  "secondaryCtaDestination",
                  event.target.value as HomeRoomAssemblyContent["secondaryCtaDestination"],
                )
              }
              value={content.secondaryCtaDestination ?? "contact"}
            >
              {["home", "about", "services", "portfolio", "process", "contact"].map(
                (destination) => (
                  <option key={destination} value={destination}>
                    {destination}
                  </option>
                ),
              )}
            </SelectField>
          </div>
        </FormSection>
        <FormSection
          description="Transparent furniture layers are recommended for clean assembly. Every published asset needs useful alt text."
          title="Room imagery"
        >
          <div className="space-y-7">
            {assets.map(({ image, alt, label, required, description }) => (
              <div className="grid gap-5 rounded-lg border border-border p-4 sm:p-5" key={image}>
                <ImageUploadField
                  id={formFieldId(formId, image)}
                  error={fieldErrorMessage(validation.errors, formFieldId(formId, image))}
                  description={`${description}${required ? " Required before publishing." : ""}`}
                  label={label}
                  onChange={(uploaded) =>
                    update(
                      image,
                      uploaded
                        ? {
                            publicId: uploaded.publicId,
                            url: uploaded.url,
                            width: uploaded.width,
                            height: uploaded.height,
                          }
                        : null,
                    )
                  }
                  value={imageValue(content, image, alt)}
                />
                <TextField
                  id={formFieldId(formId, alt)}
                  error={fieldErrorMessage(validation.errors, formFieldId(formId, alt))}
                  description={`${required ? "Required before publishing. " : ""}Describe only the visual subject represented by this layer.`}
                  maxLength={180}
                  label="Image alt text"
                  onChange={(event) => update(alt, event.target.value)}
                  value={content[alt] ?? ""}
                />
              </div>
            ))}
          </div>
        </FormSection>
        <FormSection
          description="Add approved decorative assets. Their scene positions and motion remain developer-controlled so content editors cannot break the composition."
          title="Additional Scene Elements"
        >
          <div className="space-y-6">
            {elements.map((element) => (
              <div
                className="space-y-5 rounded-lg border border-border p-4 sm:p-5"
                key={element.id}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <SelectField
                    id={formFieldId(formId, `element-${element.id}-type`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `element-${element.id}-type`),
                    )}
                    label="Element type"
                    onChange={(event) => {
                      const type = event.target.value as RoomSceneElementType;
                      const definition = elementTypes.find((item) => item.value === type);
                      updateElement(element.id, {
                        type,
                        animationPreset: definition?.preset ?? "gentle-settle",
                      });
                    }}
                    value={element.type}
                  >
                    {elementTypes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    id={formFieldId(formId, `element-${element.id}-animation-preset`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `element-${element.id}-animation-preset`),
                    )}
                    label="Animation preset"
                    onChange={(event) =>
                      updateElement(element.id, {
                        animationPreset: event.target.value as RoomAnimationPreset,
                      })
                    }
                    value={element.animationPreset}
                  >
                    {animationPresets.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </SelectField>
                </div>
                <ImageUploadField
                  id={formFieldId(formId, `element-${element.id}-image`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `element-${element.id}-image`),
                  )}
                  description={`Use a transparent image with perspective matching the room. The frontend owns its exact placement.${element.enabled ? " Required to publish while enabled." : ""}`}
                  label="Element image"
                  onChange={(uploaded) =>
                    updateElement(element.id, {
                      image: uploaded
                        ? {
                            publicId: uploaded.publicId,
                            url: uploaded.url,
                            width: uploaded.width,
                            height: uploaded.height,
                          }
                        : null,
                    })
                  }
                  value={element.image ? { ...element.image, alt: element.alt } : undefined}
                />
                <TextField
                  id={formFieldId(formId, `element-${element.id}-alt`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `element-${element.id}-alt`),
                  )}
                  description={`Describe the visual subject represented by this layer.${element.enabled ? " Required to publish while enabled." : ""}`}
                  maxLength={180}
                  label="Image alt text"
                  onChange={(event) => updateElement(element.id, { alt: event.target.value })}
                  value={element.alt}
                />
                <div className="flex items-center justify-between gap-4">
                  <CheckboxField
                    id={formFieldId(formId, `element-${element.id}-enabled`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `element-${element.id}-enabled`),
                    )}
                    checked={element.enabled === true}
                    label="Enabled in the published scene"
                    onChange={(enabled) => updateElement(element.id, { enabled })}
                  />
                  <ActionButton
                    onClick={() => removeElement(element.id)}
                    type="button"
                    variant="ghost"
                  >
                    Remove
                  </ActionButton>
                </div>
              </div>
            ))}
            {fieldErrorMessage(validation.errors, formFieldId(formId, "additional-elements")) ? (
              <p
                aria-live="polite"
                className="text-sm text-destructive"
                id={formFieldId(formId, "additional-elements")}
                tabIndex={-1}
              >
                {fieldErrorMessage(validation.errors, formFieldId(formId, "additional-elements"))}
              </p>
            ) : null}
            {elements.length < 8 ? (
              <ActionButton onClick={addElement} type="button" variant="outline">
                Add scene element
              </ActionButton>
            ) : (
              <p className="text-sm text-muted-foreground">
                Maximum of 8 additional elements reached.
              </p>
            )}
          </div>
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
