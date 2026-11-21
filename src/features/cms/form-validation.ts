export type FormFieldIssue = { id: string; label: string; message: string };

export type FormFieldRule = {
  id: string;
  label: string;
  value: unknown;
  required?: boolean;
  maxLength?: number;
  minItems?: number;
  minItemsMessage?: string;
  validate?: (value: unknown) => boolean;
  requiredMessage?: string;
  invalidMessage?: string;
};

export function validateFormFields(rules: readonly FormFieldRule[]): FormFieldIssue[] {
  const issues: FormFieldIssue[] = [];
  for (const rule of rules) {
    const value = rule.value;
    const emptyText = typeof value === "string" && value.trim().length === 0;
    const emptyValue = value === null || value === undefined || emptyText;

    if (rule.required && emptyValue) {
      issues.push({
        id: rule.id,
        label: rule.label,
        message: rule.requiredMessage ?? `Enter ${rule.label.toLowerCase()}.`,
      });
      continue;
    }
    if (rule.minItems !== undefined && Array.isArray(value) && value.length < rule.minItems) {
      issues.push({
        id: rule.id,
        label: rule.label,
        message:
          rule.minItemsMessage ?? `Add at least ${rule.minItems} ${rule.label.toLowerCase()}.`,
      });
      continue;
    }
    if (
      rule.maxLength !== undefined &&
      typeof value === "string" &&
      value.length > rule.maxLength
    ) {
      issues.push({
        id: rule.id,
        label: rule.label,
        message: `Use ${rule.maxLength} characters or fewer.`,
      });
      continue;
    }
    if (rule.validate && !rule.validate(value)) {
      issues.push({
        id: rule.id,
        label: rule.label,
        message: rule.invalidMessage ?? `Check the ${rule.label.toLowerCase()} value.`,
      });
    }
  }
  return issues;
}

export function formFieldId(formId: string, fieldName: string): string {
  const safeFieldName = fieldName.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-|-$/g, "");
  return `${formId}-${safeFieldName}`;
}
