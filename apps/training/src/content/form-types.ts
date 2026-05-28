import formsCommonJson from '@/content/forms-common.json';
import workshopFeedbackJson from '@/content/forms/workshop-feedback.json';

export interface FormQuestionBase {
  id: string;
  screen: string;
  question: string;
}

export interface FormSelectQuestion extends FormQuestionBase {
  type: 'select';
  options: string[];
}

export interface FormTextQuestion extends FormQuestionBase {
  type: 'text';
}

export interface FormEmailQuestion extends FormQuestionBase {
  type: 'email';
}

export type FormQuestion = FormSelectQuestion | FormTextQuestion | FormEmailQuestion;

export interface FormContent {
  title: string;
  slug: string;
  questions: FormQuestion[];
}

export interface FormsCommonContent {
  navigation: {
    back: string;
    next: string;
    finish: string;
  };
  completion: {
    title: string;
    description: string;
  };
  errors: {
    required: string;
    invalidEmail: string;
    persistFailed: string;
    missingApiConfig: string;
  };
  a11y: {
    progressTemplate: string;
  };
}

export const FORMS_COMMON = formsCommonJson as FormsCommonContent;

const workshopFeedback = workshopFeedbackJson as FormContent;

const FORMS = {
  'workshop-feedback': workshopFeedback,
} satisfies Record<string, FormContent>;

export type FormSlug = keyof typeof FORMS;

const FORM_SLUGS = Object.freeze(Object.keys(FORMS) as FormSlug[]);

export function getAllFormSlugs(): FormSlug[] {
  return [...FORM_SLUGS];
}

export function isValidFormSlug(slug: string): slug is FormSlug {
  return slug in FORMS;
}

export function getFormContent(slug: string): FormContent | null {
  if (!isValidFormSlug(slug)) {
    return null;
  }
  return FORMS[slug];
}

export function buildFormPath(slug: FormSlug | string): string {
  return `/forms/${slug}/`;
}
