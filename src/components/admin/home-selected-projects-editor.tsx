"use client";

import {
  HOME_SELECTED_PROJECTS_TYPE,
  type HomeSelectedProject,
  type HomeSelectedProjectsContent,
} from "@fs/cms-contracts";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
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
import { Button } from "../ui/button";

type DraftSection = {
  id: string;
  type: string;
  draftContent: HomeSelectedProjectsContent;
  draftIsVisible: boolean;
};
type DraftPage = { sections: DraftSection[] };

const destinationOptions = [
  ["portfolio", "Our Work"],
  ["services", "Services"],
  ["process", "The Process"],
  ["contact", "Contact"],
  ["about", "About"],
  ["home", "Home"],
] as const;

function imageValue(project: HomeSelectedProject) {
  return project.image ? { ...project.image, alt: project.imageAlt } : undefined;
}

function createProject(): HomeSelectedProject {
  return {
    id: `project-${crypto.randomUUID()}`,
    title: "",
    category: "",
    image: null,
    imageAlt: "",
    destination: "portfolio",
  };
}

const formId = "home-selected-projects";

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

function selectedProjectsRules(
  content: HomeSelectedProjectsContent,
  publish: boolean,
): FormFieldRule[] {
  const projects = Array.isArray(content.projects) ? content.projects : [];
  const ids = projects.map((project) => project.id);
  const rules: FormFieldRule[] = [
    {
      id: formFieldId(formId, "eyebrow"),
      label: "Eyebrow",
      value: content.eyebrow,
      required: publish,
      maxLength: 80,
      validate: (value) => typeof value === "string",
      invalidMessage: "Enter an eyebrow of 80 characters or fewer.",
    },
    {
      id: formFieldId(formId, "heading"),
      label: "Heading",
      value: content.heading,
      required: publish,
      maxLength: 120,
      validate: (value) => typeof value === "string",
      invalidMessage: "Enter a heading of 120 characters or fewer.",
    },
    {
      id: formFieldId(formId, "supporting-text"),
      label: "Supporting text",
      value: content.supportingText,
      maxLength: 240,
      validate: (value) => typeof value === "string",
      invalidMessage: "Enter supporting text of 240 characters or fewer.",
    },
    {
      id: formFieldId(formId, "projects"),
      label: "Featured projects",
      value: content.projects,
      validate: (value) =>
        Array.isArray(value) && value.length <= 8 && (!publish || value.length >= 3),
      invalidMessage: publish
        ? "Add three to eight featured projects before publishing."
        : "Keep the featured project list to eight projects or fewer.",
    },
  ];

  projects.forEach((project, index) => {
    const number = index + 1;
    const uniqueId =
      typeof project.id === "string" &&
      project.id.trim().length > 0 &&
      project.id.length <= 100 &&
      ids.indexOf(project.id) === index;
    rules.push(
      {
        id: formFieldId(formId, `project-${number}-title`),
        label: `Project ${number} title`,
        value: project.title,
        required: publish,
        maxLength: 100,
        validate: (value) => typeof value === "string" && uniqueId,
        invalidMessage:
          "This project row has an invalid or duplicate ID. Remove and re-add the project.",
      },
      {
        id: formFieldId(formId, `project-${number}-category`),
        label: `Project ${number} category`,
        value: project.category,
        required: publish,
        maxLength: 80,
        validate: (value) => typeof value === "string",
        invalidMessage: "Enter a category of 80 characters or fewer.",
      },
      {
        id: formFieldId(formId, `project-${number}-image`),
        label: `Project ${number} image`,
        value: project.image,
        required: publish,
        validate: (value) => value === null || isMediaAssetValue(value),
        requiredMessage: "Upload an image before publishing this project.",
        invalidMessage: "Choose a valid uploaded image.",
      },
      {
        id: formFieldId(formId, `project-${number}-image-alt`),
        label: `Project ${number} image alt text`,
        value: project.imageAlt,
        required: publish,
        maxLength: 180,
        validate: (value) => typeof value === "string",
        invalidMessage: "Enter image alt text with 180 characters or fewer.",
      },
      {
        id: formFieldId(formId, `project-${number}-destination`),
        label: `Project ${number} destination`,
        value: project.destination,
        validate: (value) => destinationOptions.some(([destination]) => destination === value),
        invalidMessage: "Choose a supported destination.",
      },
    );
  });

  return rules;
}

export function HomeSelectedProjectsEditor() {
  const [section, setSection] = useState<DraftSection>();
  const [content, setContent] = useState<HomeSelectedProjectsContent>();
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
        const found = page.sections.find(
          (candidate) => candidate.type === HOME_SELECTED_PROJECTS_TYPE,
        );
        if (found) {
          setSection(found);
          setContent(found.draftContent);
          setIsVisible(found.draftIsVisible);
        }
      })
      .catch(() => setError("Unable to load the Selected Projects draft."))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof HomeSelectedProjectsContent>(
    key: K,
    value: HomeSelectedProjectsContent[K],
  ) {
    setContent((current) => (current ? { ...current, [key]: value } : current));
    validation.clear();
    setMessage(undefined);
    setError(undefined);
  }

  function updateProject(index: number, patch: Partial<HomeSelectedProject>) {
    if (!content) return;
    update(
      "projects",
      content.projects.map((project, projectIndex) =>
        projectIndex === index ? { ...project, ...patch } : project,
      ),
    );
  }

  function moveProject(index: number, direction: -1 | 1) {
    if (!content) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= content.projects.length) return;
    const projects = [...content.projects];
    [projects[index], projects[nextIndex]] = [projects[nextIndex], projects[index]];
    update("projects", projects);
  }

  function removeProject(index: number) {
    if (!content) return;
    update(
      "projects",
      content.projects.filter((_, projectIndex) => projectIndex !== index),
    );
  }

  async function save(publish = false) {
    if (!section || !content) return;
    const issues = validateFormFields(selectedProjectsRules(content, publish));
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
          ? "Selected Projects draft saved and published."
          : "Draft saved. The live Home page is unchanged until publishing.",
      );
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Unable to save the Selected Projects draft.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return <p className="text-sm text-muted-foreground">Loading Selected Projects draft…</p>;
  if (!section || !content)
    return (
      <p className="rounded-md border border-dashed border-border bg-muted p-6 text-sm text-muted-foreground">
        The section is not seeded yet. Run <code>pnpm cms:seed:home-selected-projects</code> in the
        backend, then reload this page.
      </p>
    );

  const projects = Array.isArray(content.projects) ? content.projects : [];
  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Website CMS / Home / Selected Projects
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Selected Projects</h1>
        <p className="max-w-2xl text-muted-foreground">
          Curate the featured project carousel. Project order controls the initial sequence; the
          carousel movement and visual treatment remain code-owned.
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
          description="Keep this introduction concise and editorial."
          title="Section introduction"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id={formFieldId(formId, "eyebrow")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "eyebrow"))}
              description="Required when publishing; drafts may remain incomplete."
              label="Eyebrow"
              maxLength={80}
              onChange={(event) => update("eyebrow", event.target.value)}
              value={content.eyebrow}
            />
            <TextField
              id={formFieldId(formId, "heading")}
              error={fieldErrorMessage(validation.errors, formFieldId(formId, "heading"))}
              description="Required when publishing; drafts may remain incomplete."
              label="Heading"
              maxLength={120}
              onChange={(event) => update("heading", event.target.value)}
              value={content.heading}
            />
          </div>
          <TextareaField
            id={formFieldId(formId, "supporting-text")}
            error={fieldErrorMessage(validation.errors, formFieldId(formId, "supporting-text"))}
            description="Optional. Leave empty when the heading is enough."
            maxLength={240}
            label="Supporting text"
            onChange={(event) => update("supportingText", event.target.value)}
            value={content.supportingText}
          />
        </FormSection>
        <FormSection
          description="Add three to eight projects for publication. Draft rows may remain incomplete while you work."
          title={`Featured projects (${projects.length}/8)`}
        >
          <div className="space-y-6">
            {projects.map((project, index) => (
              <div
                className="space-y-5 rounded-lg border border-border p-4 sm:p-5"
                key={project.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">Project {index + 1}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      aria-label={`Move project ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveProject(index, -1)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Move project ${index + 1} down`}
                      disabled={index === projects.length - 1}
                      onClick={() => moveProject(index, 1)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button
                      aria-label={`Remove project ${index + 1}`}
                      onClick={() => removeProject(index)}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    id={formFieldId(formId, `project-${index + 1}-title`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `project-${index + 1}-title`),
                    )}
                    maxLength={100}
                    description="Required when publishing."
                    label="Project title"
                    onChange={(event) => updateProject(index, { title: event.target.value })}
                    value={project.title}
                  />
                  <TextField
                    id={formFieldId(formId, `project-${index + 1}-category`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `project-${index + 1}-category`),
                    )}
                    maxLength={80}
                    description="Required when publishing."
                    label="Category"
                    onChange={(event) => updateProject(index, { category: event.target.value })}
                    value={project.category}
                  />
                </div>
                <ImageUploadField
                  id={formFieldId(formId, `project-${index + 1}-image`)}
                  error={fieldErrorMessage(
                    validation.errors,
                    formFieldId(formId, `project-${index + 1}-image`),
                  )}
                  description="JPEG, PNG, WebP, or AVIF · Maximum 10 MB. Required to publish."
                  label="Project image"
                  onChange={(image) =>
                    updateProject(index, {
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
                  value={imageValue(project)}
                />
                <div className="grid gap-5 sm:grid-cols-2">
                  <TextField
                    id={formFieldId(formId, `project-${index + 1}-image-alt`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `project-${index + 1}-image-alt`),
                    )}
                    description="Describe the project image for assistive technology. Required to publish."
                    maxLength={180}
                    label="Image alt text"
                    onChange={(event) => updateProject(index, { imageAlt: event.target.value })}
                    value={project.imageAlt}
                  />
                  <SelectField
                    id={formFieldId(formId, `project-${index + 1}-destination`)}
                    error={fieldErrorMessage(
                      validation.errors,
                      formFieldId(formId, `project-${index + 1}-destination`),
                    )}
                    label="Destination"
                    onChange={(event) =>
                      updateProject(index, {
                        destination: event.target.value as HomeSelectedProject["destination"],
                      })
                    }
                    value={project.destination}
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
            {projects.length < 8 ? (
              <Button
                onClick={() => update("projects", [...projects, createProject()])}
                type="button"
                variant="outline"
              >
                <Plus aria-hidden="true" />
                Add project
              </Button>
            ) : null}
            {projects.length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-muted p-5 text-sm text-muted-foreground">
                No projects added yet. Add at least three complete projects before publishing.
              </p>
            ) : null}
            {fieldErrorMessage(validation.errors, formFieldId(formId, "projects")) ? (
              <p
                aria-live="polite"
                className="text-sm text-destructive"
                id={formFieldId(formId, "projects")}
                tabIndex={-1}
              >
                {fieldErrorMessage(validation.errors, formFieldId(formId, "projects"))}
              </p>
            ) : null}
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
