"use client";

import { CheckCircle2, KeyRound, MailCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import {
  formFieldId,
  validateFormFields,
  type FormFieldRule,
} from "../../features/cms/form-validation";
import { apiClient } from "../../lib/api/client";
import {
  ActionButton,
  CheckboxField,
  FormErrorSummary,
  FormSection,
  SwitchField,
  TextField,
  useFormFieldErrors,
} from "./form-controls";

const FORM_ID = "contact-delivery";
const deliveryFieldId = (field: string) => formFieldId(FORM_ID, field);
const smtpHostnamePattern =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ContactDeliverySettingsResponse = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  fromEmail: string;
  fromName: string;
  recipientEmail: string;
  hasSmtpPassword: boolean;
  encryptionKeyConfigured: boolean;
  ready: boolean;
};

type UpdateContactSettingsBody = {
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword?: string;
  clearSmtpPassword: boolean;
  fromEmail: string;
  fromName: string;
  recipientEmail: string;
};

type ContactDeliveryForm = Omit<UpdateContactSettingsBody, "smtpPassword" | "smtpPort"> & {
  smtpPort: string;
  smtpPassword: string;
};

const emptyForm: ContactDeliveryForm = {
  smtpHost: "",
  smtpPort: "",
  smtpSecure: false,
  smtpUsername: "",
  smtpPassword: "",
  clearSmtpPassword: false,
  fromEmail: "",
  fromName: "",
  recipientEmail: "",
};

function formFromSettings(settings: ContactDeliverySettingsResponse): ContactDeliveryForm {
  return {
    smtpHost: settings.smtpHost,
    smtpPort: String(settings.smtpPort),
    smtpSecure: settings.smtpSecure,
    smtpUsername: settings.smtpUsername,
    smtpPassword: "",
    clearSmtpPassword: false,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    recipientEmail: settings.recipientEmail,
  };
}

function deliveryRules(form: ContactDeliveryForm): FormFieldRule[] {
  const port = form.smtpPort.trim() === "" ? Number.NaN : Number(form.smtpPort);
  return [
    {
      id: deliveryFieldId("smtpHost"),
      label: "SMTP host",
      value: form.smtpHost,
      required: true,
      maxLength: 253,
      validate: (value) => typeof value === "string" && smtpHostnamePattern.test(value),
      requiredMessage: "Enter an SMTP hostname.",
      invalidMessage: "Enter a public SMTP hostname, not a URL or IP address.",
    },
    {
      id: deliveryFieldId("smtpPort"),
      label: "SMTP port",
      value: port,
      required: true,
      validate: (value) =>
        typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 65535,
      requiredMessage: "Enter an SMTP port from 1 to 65535.",
      invalidMessage: "Enter an integer from 1 to 65535.",
    },
    {
      id: deliveryFieldId("smtpUsername"),
      label: "SMTP username",
      value: form.smtpUsername,
      maxLength: 253,
    },
    {
      id: deliveryFieldId("smtpPassword"),
      label: "SMTP password",
      value: form.clearSmtpPassword ? "" : form.smtpPassword,
      maxLength: 512,
    },
    {
      id: deliveryFieldId("fromName"),
      label: "From name",
      value: form.fromName,
      maxLength: 100,
    },
    {
      id: deliveryFieldId("fromEmail"),
      label: "From email",
      value: form.fromEmail,
      required: true,
      maxLength: 254,
      validate: (value) => typeof value === "string" && emailPattern.test(value),
      requiredMessage: "Enter a from email address.",
      invalidMessage: "Enter a valid from email address.",
    },
    {
      id: deliveryFieldId("recipientEmail"),
      label: "Recipient email",
      value: form.recipientEmail,
      required: true,
      maxLength: 254,
      validate: (value) => typeof value === "string" && emailPattern.test(value),
      requiredMessage: "Enter a recipient email address.",
      invalidMessage: "Enter a valid recipient email address.",
    },
  ];
}

function hasFormChanges(
  form: ContactDeliveryForm,
  saved: ContactDeliverySettingsResponse,
): boolean {
  return (
    form.smtpHost !== saved.smtpHost ||
    form.smtpPort !== String(saved.smtpPort) ||
    form.smtpSecure !== saved.smtpSecure ||
    form.smtpUsername !== saved.smtpUsername ||
    form.fromEmail !== saved.fromEmail ||
    form.fromName !== saved.fromName ||
    form.recipientEmail !== saved.recipientEmail ||
    form.smtpPassword.length > 0 ||
    form.clearSmtpPassword
  );
}

export function ContactDeliveryEditor() {
  const [settings, setSettings] = useState<ContactDeliverySettingsResponse | null>(null);
  const [form, setForm] = useState<ContactDeliveryForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const validation = useFormFieldErrors();

  useEffect(() => {
    let active = true;
    apiClient
      .get<ContactDeliverySettingsResponse>("contact/admin/settings")
      .then((response) => {
        if (!active) return;
        setSettings(response);
        setForm(formFromSettings(response));
      })
      .catch(() => {
        if (active)
          setError("Unable to load contact delivery settings. Secret values are never shown.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof ContactDeliveryForm>(key: K, value: ContactDeliveryForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError("");
    setMessage("");
    validation.clear(deliveryFieldId(String(key)));
  }

  function updateClearPassword(clear: boolean) {
    setForm((current) => ({
      ...current,
      clearSmtpPassword: clear,
      smtpPassword: clear ? "" : current.smtpPassword,
    }));
    setError("");
    setMessage("");
    validation.clear(deliveryFieldId("smtpPassword"));
  }

  async function save() {
    setError("");
    setMessage("");
    const issues = validateFormFields(deliveryRules(form));
    validation.report(issues);
    if (issues.length) return;

    const body: UpdateContactSettingsBody = {
      smtpHost: form.smtpHost,
      smtpPort: Number(form.smtpPort),
      smtpSecure: form.smtpSecure,
      smtpUsername: form.smtpUsername,
      clearSmtpPassword: form.clearSmtpPassword,
      fromEmail: form.fromEmail,
      fromName: form.fromName,
      recipientEmail: form.recipientEmail,
    };
    if (!form.clearSmtpPassword && form.smtpPassword.length > 0) {
      body.smtpPassword = form.smtpPassword;
    }

    validation.clear();
    setSaving(true);
    try {
      const updated = await apiClient.put<
        ContactDeliverySettingsResponse,
        UpdateContactSettingsBody
      >("contact/admin/settings", body);
      setSettings(updated);
      setForm(formFromSettings(updated));
      setMessage("Contact delivery settings saved. The password remains write-only.");
    } catch {
      setError(
        "Unable to save contact delivery settings. Review the fields and encryption-key status, then try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function verify() {
    if (!settings || hasFormChanges(form, settings)) return;
    setError("");
    setMessage("");
    setVerifying(true);
    try {
      await apiClient.post<unknown>("contact/admin/settings/verify", {});
      setMessage("SMTP connection verified. No email was sent.");
    } catch {
      setError(
        "Unable to verify the SMTP connection. Review the saved settings and server status, then try again. No email was sent.",
      );
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <section aria-busy="true" className="space-y-4">
        <h1 className="text-3xl font-semibold">Contact delivery settings</h1>
        <p className="text-muted-foreground">Loading SMTP settings…</p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Contact / Delivery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Contact delivery settings
          </h1>
        </header>
        <p aria-live="polite" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error || "Contact delivery settings are unavailable."}
        </p>
      </section>
    );
  }

  const unsavedChanges = hasFormChanges(form, settings);
  const busy = saving || verifying;

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Contact / Delivery
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Contact delivery settings
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Configure SMTP delivery separately from the public Contact page copy. SMTP credentials are
          write-only in this editor and are never displayed after saving.
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
            title="SMTP connection"
            description="Enter a public SMTP hostname and port. The host field accepts a hostname, not a URL or IP address."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={deliveryFieldId("smtpHost")}
                label="SMTP host"
                maxLength={253}
                required
                error={
                  validation.errors.find((issue) => issue.id === deliveryFieldId("smtpHost"))
                    ?.message
                }
                value={form.smtpHost}
                disabled={busy}
                onChange={(event) => update("smtpHost", event.target.value)}
              />
              <TextField
                id={deliveryFieldId("smtpPort")}
                label="SMTP port"
                type="number"
                min={1}
                max={65535}
                step={1}
                required
                error={
                  validation.errors.find((issue) => issue.id === deliveryFieldId("smtpPort"))
                    ?.message
                }
                value={form.smtpPort}
                disabled={busy}
                onChange={(event) => update("smtpPort", event.target.value)}
              />
            </div>
            <SwitchField
              checked={form.smtpSecure}
              disabled={busy}
              label="Secure SMTP connection"
              description="Controls the secure-connection setting sent to the backend."
              onChange={(secure) => update("smtpSecure", secure)}
            />
          </FormSection>

          <FormSection
            title="SMTP authentication"
            description="The saved password is never returned by the settings API. Leave the password field blank to keep the current saved password."
          >
            <TextField
              id={deliveryFieldId("smtpUsername")}
              label="SMTP username"
              maxLength={253}
              autoComplete="username"
              value={form.smtpUsername}
              disabled={busy}
              onChange={(event) => update("smtpUsername", event.target.value)}
            />
            <TextField
              id={deliveryFieldId("smtpPassword")}
              label="SMTP password"
              type="password"
              autoComplete="new-password"
              maxLength={512}
              description={
                settings.hasSmtpPassword
                  ? "A password is saved. Leave blank to keep it, or use the separate clear option below."
                  : "No password is currently saved. Enter one only if this SMTP server requires it."
              }
              value={form.smtpPassword}
              disabled={busy || form.clearSmtpPassword}
              error={
                validation.errors.find((issue) => issue.id === deliveryFieldId("smtpPassword"))
                  ?.message
              }
              onChange={(event) => update("smtpPassword", event.target.value)}
            />
            <CheckboxField
              id={deliveryFieldId("clearSmtpPassword")}
              checked={form.clearSmtpPassword}
              disabled={busy}
              label="Clear the saved SMTP password"
              description="This removes the stored password. The SMTP username remains as entered."
              onChange={updateClearPassword}
            />
          </FormSection>

          <FormSection
            title="Message sender and recipient"
            description="These addresses configure message delivery and are separate from the public email address shown on the site."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id={deliveryFieldId("fromName")}
                label="From name"
                maxLength={100}
                value={form.fromName}
                disabled={busy}
                onChange={(event) => update("fromName", event.target.value)}
              />
              <TextField
                id={deliveryFieldId("fromEmail")}
                label="From email"
                type="email"
                maxLength={254}
                required
                error={
                  validation.errors.find((issue) => issue.id === deliveryFieldId("fromEmail"))
                    ?.message
                }
                value={form.fromEmail}
                disabled={busy}
                onChange={(event) => update("fromEmail", event.target.value)}
              />
              <TextField
                id={deliveryFieldId("recipientEmail")}
                label="Recipient email"
                type="email"
                maxLength={254}
                required
                error={
                  validation.errors.find((issue) => issue.id === deliveryFieldId("recipientEmail"))
                    ?.message
                }
                value={form.recipientEmail}
                disabled={busy}
                onChange={(event) => update("recipientEmail", event.target.value)}
              />
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-3">
            <ActionButton
              disabled={busy}
              loading={saving}
              onClick={() => void save()}
              type="button"
              variant="outline"
            >
              Save SMTP settings
            </ActionButton>
            <ActionButton
              disabled={busy || unsavedChanges}
              loading={verifying}
              onClick={() => void verify()}
              type="button"
              variant="default"
            >
              <MailCheck aria-hidden="true" />
              Verify SMTP connection
            </ActionButton>
          </div>
          <p className="text-sm text-muted-foreground">
            Verification is separate from saving, checks the server-configured connection, and does
            not send an email. Save form changes before verifying.
          </p>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Delivery status</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p
                aria-live="polite"
                className={`flex items-start gap-2 rounded-lg border p-3 ${settings.ready ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-foreground"}`}
              >
                {settings.ready ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                ) : (
                  <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                )}
                <span>
                  {settings.ready
                    ? "Backend reports delivery settings are ready."
                    : "Backend reports delivery settings are not ready."}
                </span>
              </p>
              <p
                className={`flex items-start gap-2 rounded-lg border p-3 ${settings.encryptionKeyConfigured ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-foreground"}`}
              >
                <KeyRound aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>
                  {settings.encryptionKeyConfigured
                    ? "The backend reports that its encryption key is configured."
                    : "The backend reports that its encryption key is not configured. An encryption key is required to store SMTP credentials securely."}
                </span>
              </p>
              <p className="rounded-lg border border-border bg-muted/50 p-3 text-muted-foreground">
                Password status:{" "}
                {settings.hasSmtpPassword
                  ? "a password is saved (value hidden)"
                  : "no password is saved"}
                .
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
