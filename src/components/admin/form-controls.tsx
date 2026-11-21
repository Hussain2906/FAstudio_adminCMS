"use client";

import { CMS_VIDEO_MAX_BYTES, type CmsImage, type CmsVideo } from "@fs/cms-contracts";
import { Film, ImagePlus, Images, LoaderCircle, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import type {
  ComponentProps,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { DragEvent, useEffect, useId, useRef, useState } from "react";
import { apiClient, ApiError } from "../../lib/api/client";
import type { FormFieldIssue } from "../../features/cms/form-validation";
import { Button } from "../ui/button";

const controlClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60";
const errorClass = "text-xs text-destructive";

export function FormDescription({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p className="text-xs leading-5 text-muted-foreground" id={id}>
      {children}
    </p>
  );
}

export function FormError({ children, id }: { children?: ReactNode; id?: string }) {
  return children ? (
    <p aria-live="polite" className={errorClass} id={id}>
      {children}
    </p>
  ) : null;
}

export function FormErrorSummary({
  errors,
  focusKey,
}: {
  errors: FormFieldIssue[];
  focusKey?: number;
}) {
  const headingId = useId();
  const summaryRef = useRef<HTMLDivElement>(null);
  const hasErrors = errors.length > 0;
  useEffect(() => {
    if (hasErrors) summaryRef.current?.focus();
  }, [focusKey, hasErrors]);
  if (!hasErrors) return null;
  return (
    <div
      aria-labelledby={headingId}
      className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive focus:outline-none focus:ring-3 focus:ring-ring/50"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <h2 className="font-semibold" id={headingId}>
        There {errors.length === 1 ? "is a problem" : "are problems"} with this form
      </h2>
      <p>Fix these fields before continuing:</p>
      <ul className="list-inside list-disc space-y-1">
        {errors.map((error, index) => (
          <li key={`${error.id}-${index}`}>
            <a className="underline underline-offset-2" href={`#${error.id}`}>
              {error.label}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function useFormFieldErrors() {
  const [errors, setErrors] = useState<FormFieldIssue[]>([]);
  const [focusKey, setFocusKey] = useState(0);
  return {
    errors,
    focusKey,
    report(nextErrors: FormFieldIssue[]) {
      setErrors(nextErrors);
      if (nextErrors.length) setFocusKey((current) => current + 1);
    },
    clear(id?: string) {
      setErrors((current) => (id ? current.filter((error) => error.id !== id) : []));
    },
  };
}

export function fieldErrorMessage(errors: FormFieldIssue[], id: string) {
  return errors.find((error) => error.id === id)?.message;
}

export function FormFieldWrapper({
  id,
  label,
  required,
  description,
  error,
  children,
  htmlForId,
}: {
  id?: string;
  label: string;
  required?: boolean;
  description?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlForId?: string;
}) {
  return (
    <div className="space-y-2">
      <label
        className="block text-sm font-medium"
        htmlFor={htmlForId ?? id}
        id={id ? `${id}-label` : undefined}
      >
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-primary">
            *
          </span>
        ) : null}
      </label>
      {children}
      {description ? (
        <FormDescription id={id ? `${id}-description` : undefined}>{description}</FormDescription>
      ) : null}
      <FormError id={id ? `${id}-error` : undefined}>{error}</FormError>
    </div>
  );
}

function describedBy(id: string, description: ReactNode, error: ReactNode, existing?: string) {
  return (
    [existing, description ? `${id}-description` : undefined, error ? `${id}-error` : undefined]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function TextField(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
    label: string;
    description?: ReactNode;
    error?: ReactNode;
    required?: boolean;
  },
) {
  const { label, description, error, required, id: providedId, ...inputProps } = props;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = describedBy(id, description, error, inputProps["aria-describedby"]);
  return (
    <FormFieldWrapper
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <input
        {...inputProps}
        aria-describedby={describedById}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} ${error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : ""}`}
        id={id}
        required={required}
      />
    </FormFieldWrapper>
  );
}

export function TextareaField(
  props: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
    label: string;
    description?: ReactNode;
    error?: ReactNode;
    required?: boolean;
  },
) {
  const { label, description, error, required, id: providedId, ...textareaProps } = props;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = describedBy(id, description, error, textareaProps["aria-describedby"]);
  return (
    <FormFieldWrapper
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <textarea
        {...textareaProps}
        aria-describedby={describedById}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} h-auto min-h-28 py-3 ${error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : ""}`}
        id={id}
        required={required}
      />
    </FormFieldWrapper>
  );
}

export function SelectField(
  props: Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & {
    label: string;
    description?: ReactNode;
    error?: ReactNode;
    required?: boolean;
    children: ReactNode;
  },
) {
  const { label, description, error, required, id: providedId, children, ...selectProps } = props;
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = describedBy(id, description, error, selectProps["aria-describedby"]);
  return (
    <FormFieldWrapper
      description={description}
      error={error}
      id={id}
      label={label}
      required={required}
    >
      <select
        {...selectProps}
        aria-describedby={describedById}
        aria-invalid={error ? true : undefined}
        className={`${controlClass} ${error ? "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20" : ""}`}
        id={id}
        required={required}
      >
        {children}
      </select>
    </FormFieldWrapper>
  );
}

export function CheckboxField({
  label,
  checked,
  onChange,
  description,
  disabled,
  error,
  id: providedId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  error?: ReactNode;
  id?: string;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = describedBy(id, description, error);
  return (
    <div className="flex items-start gap-3">
      <input
        aria-describedby={describedById}
        aria-invalid={error ? true : undefined}
        checked={checked}
        className={`mt-0.5 size-4 rounded border-input accent-primary focus-visible:ring-2 focus-visible:ring-ring ${error ? "outline outline-1 outline-destructive" : ""}`}
        disabled={disabled}
        id={id}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <FormDescription id={`${id}-description`}>{description}</FormDescription>
        ) : null}
        <FormError id={`${id}-error`}>{error}</FormError>
      </div>
    </div>
  );
}

export function SwitchField({
  label,
  checked,
  onChange,
  description,
  disabled,
  error,
  id: providedId,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: ReactNode;
  disabled?: boolean;
  error?: ReactNode;
  id?: string;
}) {
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const describedById = describedBy(id, description, error);
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-1">
        <label className="text-sm font-medium" htmlFor={id}>
          {label}
        </label>
        {description ? (
          <FormDescription id={`${id}-description`}>{description}</FormDescription>
        ) : null}
        <FormError id={`${id}-error`}>{error}</FormError>
      </div>
      <button
        aria-checked={checked}
        aria-describedby={describedById}
        aria-invalid={error ? true : undefined}
        aria-label={label}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border p-0.5 transition-colors focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "border-primary bg-primary" : "border-input bg-muted"} ${error ? "border-destructive" : ""}`}
        data-state={checked ? "checked" : "unchecked"}
        disabled={disabled}
        id={id}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={`pointer-events-none absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow-sm transition-transform duration-150 motion-reduce:transition-none ${checked ? "translate-x-5" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <fieldset className="space-y-5 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="space-y-1">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? <FormDescription>{description}</FormDescription> : null}
      </div>
      {children}
    </fieldset>
  );
}

export function ActionButton({
  children,
  loading,
  variant = "default",
  ...props
}: ComponentProps<typeof Button> & { loading?: boolean }) {
  return (
    <Button {...props} disabled={loading || props.disabled} variant={variant}>
      {loading ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

const acceptedTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const maxBytes = 10 * 1024 * 1024;
type UploadAsset = Omit<CmsImage, "alt"> & { format?: string; bytes?: number };
type MediaLibraryPage = { items: UploadAsset[]; nextCursor: string | null };

export function ImageUploadField({
  label,
  value,
  onChange,
  onError,
  description,
  required,
  allowLibrary = false,
  error: fieldError,
  id: providedId,
}: {
  label: string;
  value?: CmsImage;
  onChange: (image?: CmsImage) => void;
  onError?: (message?: string) => void;
  description?: ReactNode;
  required?: boolean;
  allowLibrary?: boolean;
  error?: ReactNode;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const inputId = `${id}-file`;
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string>();
  const [libraryItems, setLibraryItems] = useState<UploadAsset[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const fieldDescription = description ?? "JPEG, PNG, WebP, or AVIF · Maximum 10 MB";
  const displayedError = error ?? fieldError;
  const describedById = describedBy(id, fieldDescription, displayedError);
  function validate(file: File) {
    if (!acceptedTypes.includes(file.type)) return "Use a JPEG, PNG, WebP, or AVIF image.";
    if (file.size > maxBytes) return "Images must be 10 MB or smaller.";
    return undefined;
  }
  async function select(file?: File) {
    if (!file) return;
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }
    setError(undefined);
    onError?.();
    setUploading(true);
    setProgress(0);
    try {
      const asset = await apiClient.upload<UploadAsset>("media/admin/upload", file, setProgress);
      onChange({
        publicId: asset.publicId,
        url: asset.url,
        width: asset.width,
        height: asset.height,
        alt: value?.alt ?? "",
      });
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Upload failed. Try again.";
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }
  async function openLibrary() {
    setLibraryOpen(true);
    setLibraryError(undefined);
    setLibraryItems([]);
    setNextCursor(null);
    await loadLibrary();
  }
  async function loadLibrary(cursor?: string) {
    setLibraryLoading(true);
    setLibraryError(undefined);
    try {
      const query = cursor ? `?next_cursor=${encodeURIComponent(cursor)}` : "";
      const result = await apiClient.get<MediaLibraryPage>(`media/admin/library${query}`);
      setLibraryItems((items) => (cursor ? [...items, ...result.items] : result.items));
      setNextCursor(result.nextCursor);
    } catch (cause) {
      setLibraryError(
        cause instanceof ApiError ? cause.message : "Unable to load the media library.",
      );
    } finally {
      setLibraryLoading(false);
    }
  }
  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void select(event.dataTransfer.files[0]);
  }
  return (
    <FormFieldWrapper
      description={fieldDescription}
      error={displayedError}
      htmlForId={inputId}
      id={id}
      label={label}
      required={required}
    >
      <div
        aria-describedby={describedById}
        aria-labelledby={`${id}-label`}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed p-4 transition-colors focus:outline-none focus:ring-3 focus:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : displayedError ? "border-destructive bg-destructive/5" : "border-border bg-muted/40"} ${uploading ? "pointer-events-none opacity-80" : ""}`}
        id={id}
        role="group"
        tabIndex={-1}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        {value?.url ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-secondary sm:w-40">
              <Image
                alt={value.alt || `${label} preview`}
                className="object-cover"
                fill
                sizes="160px"
                src={value.url}
              />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">Image selected</p>
              <p className="truncate text-xs text-muted-foreground">
                {value.width} × {value.height}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  onClick={() => inputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <ImagePlus aria-hidden="true" />
                  Upload replacement
                </Button>
                {allowLibrary ? (
                  <Button
                    onClick={() => void openLibrary()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Images aria-hidden="true" />
                    Select from library
                  </Button>
                ) : null}
                <Button onClick={() => onChange(undefined)} size="sm" type="button" variant="ghost">
                  <X aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center gap-3 text-center">
            <UploadCloud aria-hidden="true" className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drag and drop an image here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or choose a file from your device
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                onClick={() => inputRef.current?.click()}
                size="sm"
                type="button"
                variant="outline"
              >
                Browse files
              </Button>
              {allowLibrary ? (
                <Button
                  onClick={() => void openLibrary()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Images aria-hidden="true" />
                  Select from library
                </Button>
              ) : null}
            </div>
          </div>
        )}
        {uploading ? (
          <div className="absolute inset-x-4 bottom-3 space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <input
        accept={acceptedTypes.join(",")}
        aria-describedby={describedById}
        aria-invalid={displayedError ? true : undefined}
        className="sr-only"
        id={inputId}
        onChange={(event) => {
          void select(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      {libraryOpen ? (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-foreground/40 p-4"
          onClick={() => setLibraryOpen(false)}
        >
          <section
            aria-labelledby={`${id}-library-title`}
            aria-modal="true"
            className="flex max-h-[min(85vh,48rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setLibraryOpen(false);
            }}
            role="dialog"
          >
            <header className="flex items-center justify-between border-b border-border p-5">
              <div>
                <h2 className="font-display text-xl" id={`${id}-library-title`}>
                  Select from media library
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose an existing image stored in Cloudinary.
                </p>
              </div>
              <Button
                aria-label="Close media library"
                onClick={() => setLibraryOpen(false)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <FormError>{libraryError}</FormError>
              {libraryLoading && libraryItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Loading media library…
                </p>
              ) : null}
              {!libraryLoading && !libraryError && libraryItems.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No uploaded images found yet.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {libraryItems.map((asset) => (
                  <button
                    aria-label={`Select image ${asset.publicId}`}
                    className="group overflow-hidden rounded-xl border border-border text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-ring"
                    key={asset.publicId}
                    onClick={() => {
                      onChange({ ...asset, alt: value?.alt ?? "" });
                      setLibraryOpen(false);
                    }}
                    type="button"
                  >
                    <span className="relative block aspect-[4/3] bg-muted">
                      <Image
                        alt=""
                        className="object-cover"
                        fill
                        sizes="(min-width: 1024px) 20vw, 45vw"
                        src={asset.url}
                      />
                    </span>
                    <span className="block truncate p-2 text-xs text-muted-foreground">
                      {asset.publicId}
                    </span>
                  </button>
                ))}
              </div>
              {nextCursor ? (
                <div className="pt-4 text-center">
                  <Button
                    disabled={libraryLoading}
                    onClick={() => void loadLibrary(nextCursor)}
                    type="button"
                    variant="outline"
                  >
                    {libraryLoading ? "Loading…" : "Load more images"}
                  </Button>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
    </FormFieldWrapper>
  );
}

export function VideoUploadField({
  label,
  value,
  onChange,
  onError,
  description,
  required,
  error: fieldError,
  id: providedId,
}: {
  label: string;
  value?: CmsVideo;
  onChange: (video?: CmsVideo) => void;
  onError?: (message?: string) => void;
  description?: ReactNode;
  required?: boolean;
  error?: ReactNode;
  id?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const id = providedId ?? generatedId;
  const inputId = `${id}-file`;
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const fieldDescription = description ?? "MP4 video · Maximum 10 MB";
  const displayedError = error ?? fieldError;
  const describedById = describedBy(id, fieldDescription, displayedError);

  function validate(file: File) {
    const isMp4 =
      file.type === "video/mp4" || (!file.type && file.name.toLowerCase().endsWith(".mp4"));
    if (!isMp4) return "Choose an MP4 video file.";
    if (file.size === 0) return "The video file is empty.";
    if (file.size > CMS_VIDEO_MAX_BYTES) return "Videos must be 10 MB or smaller.";
    return undefined;
  }

  async function select(file?: File) {
    if (!file) return;
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      onError?.(validationError);
      return;
    }
    setError(undefined);
    onError?.();
    setUploading(true);
    setProgress(0);
    try {
      const video = await apiClient.upload<CmsVideo>("media/admin/upload-video", file, setProgress);
      onChange(video);
    } catch (cause) {
      const message = cause instanceof ApiError ? cause.message : "Upload failed. Try again.";
      setError(message);
      onError?.(message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    void select(event.dataTransfer.files[0]);
  }

  return (
    <FormFieldWrapper
      description={fieldDescription}
      error={displayedError}
      htmlForId={inputId}
      id={id}
      label={label}
      required={required}
    >
      <div
        aria-describedby={describedById}
        aria-labelledby={`${id}-label`}
        className={`relative overflow-hidden rounded-xl border-2 border-dashed p-4 transition-colors focus:outline-none focus:ring-3 focus:ring-ring/50 ${dragging ? "border-primary bg-primary/5" : displayedError ? "border-destructive bg-destructive/5" : "border-border bg-muted/40"} ${uploading ? "pointer-events-none opacity-80" : ""}`}
        id={id}
        role="group"
        tabIndex={-1}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={onDrop}
      >
        {value?.url ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <video
              aria-label={`${label} preview`}
              className="aspect-video w-full rounded-lg bg-muted object-contain sm:w-56"
              controls
              height={126}
              playsInline
              preload="metadata"
              src={value.url}
              width={224}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">MP4 video selected</p>
              <p className="truncate text-xs text-muted-foreground">
                {value.width} × {value.height} · {(value.bytes / 1_048_576).toFixed(1)} MB
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  disabled={uploading}
                  onClick={() => inputRef.current?.click()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Film aria-hidden="true" />
                  Upload replacement
                </Button>
                <Button
                  disabled={uploading}
                  onClick={() => onChange(undefined)}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid min-h-36 place-items-center gap-3 text-center">
            <Film aria-hidden="true" className="size-8 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Drag and drop an MP4 video here</p>
              <p className="mt-1 text-xs text-muted-foreground">
                or choose a file from your device
              </p>
            </div>
            <Button
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              Browse videos
            </Button>
          </div>
        )}
        {uploading ? (
          <div aria-live="polite" className="absolute inset-x-4 bottom-3 space-y-1" role="status">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Uploading video…</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
      <input
        accept="video/mp4,.mp4"
        aria-describedby={describedById}
        aria-invalid={displayedError ? true : undefined}
        className="sr-only"
        id={inputId}
        onChange={(event) => {
          void select(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
        ref={inputRef}
        type="file"
      />
    </FormFieldWrapper>
  );
}
