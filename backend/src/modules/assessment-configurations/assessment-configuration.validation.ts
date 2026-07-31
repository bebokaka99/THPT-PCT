import { HttpError } from '../../utils/http-error.js';
import {
  asRecord,
  firstQueryValue,
  optionalString,
  parsePositiveInteger,
  positiveIntegerValue,
  requiredString,
} from '../../validators/common.js';
import type {
  AssessmentCategoryInput,
  AssessmentCalculationInput,
  AssessmentConfigurationInput,
  AssessmentConfigurationStatus,
  AssessmentConfigurationUpdateInput,
  AssessmentRoundingMode,
  ListAssessmentConfigurationsQuery,
} from './assessment-configuration.types.js';

const statuses: AssessmentConfigurationStatus[] = [
  'draft',
  'active',
  'archived',
];
const roundingModes: AssessmentRoundingMode[] = [
  'half_up',
  'half_even',
  'truncate',
];

function numberValue(
  value: unknown,
  field: string,
  options: { min: number; max: number; integer?: boolean },
) {
  const parsed = Number(value);
  if (
    value === undefined ||
    value === null ||
    value === '' ||
    !Number.isFinite(parsed) ||
    parsed < options.min ||
    parsed > options.max ||
    (options.integer && !Number.isInteger(parsed))
  ) {
    throw new HttpError(
      400,
      `${field} must be ${options.integer ? 'an integer' : 'a number'} between ${options.min} and ${options.max}`,
    );
  }
  return parsed;
}

function optionalNumberValue(
  value: unknown,
  field: string,
  options: { min: number; max: number; integer?: boolean },
) {
  if (value === undefined) return undefined;
  return numberValue(value, field, options);
}

function enumValue<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new HttpError(400, `${field} must be one of: ${allowed.join(', ')}`);
  }
  return value as T;
}

function validateCategory(
  value: unknown,
  index: number,
): AssessmentCategoryInput {
  const body = asRecord(value);
  const code = requiredString(body.code, `categories[${index}].code`)
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (!/^[A-Z0-9_]{2,50}$/.test(code)) {
    throw new HttpError(
      400,
      `categories[${index}].code must use A-Z, 0-9, and underscore`,
    );
  }
  return {
    code,
    name: requiredString(body.name, `categories[${index}].name`),
    weight_percent: numberValue(
      body.weight_percent,
      `categories[${index}].weight_percent`,
      { min: 0.01, max: 100 },
    ),
    coefficient:
      optionalNumberValue(
        body.coefficient,
        `categories[${index}].coefficient`,
        { min: 0.01, max: 20 },
      ) ?? 1,
    max_entries:
      optionalNumberValue(
        body.max_entries,
        `categories[${index}].max_entries`,
        { min: 1, max: 20, integer: true },
      ) ?? 1,
    score_scale:
      optionalNumberValue(
        body.score_scale,
        `categories[${index}].score_scale`,
        { min: 0.01, max: 100 },
      ) ?? 10,
    sort_order:
      optionalNumberValue(
        body.sort_order,
        `categories[${index}].sort_order`,
        { min: 0, max: 10_000, integer: true },
      ) ?? index,
  };
}

function validateCategories(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    throw new HttpError(400, 'categories must contain between 1 and 20 items');
  }
  const categories = value.map(validateCategory);
  const codes = new Set(categories.map((category) => category.code));
  if (codes.size !== categories.length) {
    throw new HttpError(400, 'Category codes must be unique');
  }
  const totalWeight = categories.reduce(
    (total, category) => total + category.weight_percent,
    0,
  );
  if (Math.abs(totalWeight - 100) > 0.001) {
    throw new HttpError(400, 'Assessment category weights must total 100');
  }
  return categories;
}

export function validateAssessmentConfiguration(
  value: unknown,
): AssessmentConfigurationInput {
  const body = asRecord(value);
  return {
    subject_id: positiveIntegerValue(body.subject_id, 'subject_id', true)!,
    semester_id: positiveIntegerValue(body.semester_id, 'semester_id', true)!,
    grade_level: numberValue(body.grade_level, 'grade_level', {
      min: 10,
      max: 12,
      integer: true,
    }),
    title: requiredString(body.title, 'title'),
    score_scale:
      optionalNumberValue(body.score_scale, 'score_scale', {
        min: 0.01,
        max: 100,
      }) ?? 10,
    decimal_places:
      optionalNumberValue(body.decimal_places, 'decimal_places', {
        min: 0,
        max: 2,
        integer: true,
      }) ?? 1,
    rounding_mode:
      body.rounding_mode === undefined
        ? 'half_up'
        : enumValue(body.rounding_mode, 'rounding_mode', roundingModes),
    categories: validateCategories(body.categories),
  };
}

export function validateAssessmentConfigurationUpdate(
  value: unknown,
): AssessmentConfigurationUpdateInput {
  const body = asRecord(value);
  const input: AssessmentConfigurationUpdateInput = {
    title: optionalString(body.title, 'title'),
    score_scale: optionalNumberValue(body.score_scale, 'score_scale', {
      min: 0.01,
      max: 100,
    }),
    decimal_places: optionalNumberValue(
      body.decimal_places,
      'decimal_places',
      { min: 0, max: 2, integer: true },
    ),
    rounding_mode:
      body.rounding_mode === undefined
        ? undefined
        : enumValue(body.rounding_mode, 'rounding_mode', roundingModes),
    categories:
      body.categories === undefined
        ? undefined
        : validateCategories(body.categories),
  };
  if (
    input.title === undefined &&
    input.score_scale === undefined &&
    input.decimal_places === undefined &&
    input.rounding_mode === undefined &&
    input.categories === undefined
  ) {
    throw new HttpError(400, 'At least one configuration field is required');
  }
  return input;
}

export function validateAssessmentCalculation(
  value: unknown,
): AssessmentCalculationInput {
  const body = asRecord(value);
  if (!Array.isArray(body.scores) || body.scores.length === 0) {
    throw new HttpError(400, 'scores must be a non-empty array');
  }
  return {
    scores: body.scores.map((entry, index) => {
      const score = asRecord(entry);
      const categoryCode = requiredString(
        score.category_code,
        `scores[${index}].category_code`,
      ).toUpperCase();
      if (!Array.isArray(score.values) || score.values.length === 0) {
        throw new HttpError(
          400,
          `scores[${index}].values must be a non-empty array`,
        );
      }
      return {
        category_code: categoryCode,
        values: score.values.map((item, valueIndex) =>
          numberValue(item, `scores[${index}].values[${valueIndex}]`, {
            min: 0,
            max: 100,
          }),
        ),
      };
    }),
  };
}

export function validateAssessmentConfigurationId(value: unknown) {
  return positiveIntegerValue(value, 'id', true)!;
}

export function validateListAssessmentConfigurationsQuery(
  value: unknown,
): ListAssessmentConfigurationsQuery {
  const query = asRecord(value);
  const statusRaw = firstQueryValue(query.status);
  const gradeRaw = firstQueryValue(query.grade_level);
  const gradeLevel =
    gradeRaw === undefined || gradeRaw === ''
      ? undefined
      : numberValue(gradeRaw, 'grade_level', {
          min: 10,
          max: 12,
          integer: true,
        });
  return {
    page: parsePositiveInteger(query.page, 1, 'page'),
    limit: Math.min(parsePositiveInteger(query.limit, 20, 'limit'), 100),
    q: optionalString(firstQueryValue(query.q), 'q'),
    subject_id: positiveIntegerValue(
      firstQueryValue(query.subject_id),
      'subject_id',
    ),
    semester_id: positiveIntegerValue(
      firstQueryValue(query.semester_id),
      'semester_id',
    ),
    grade_level: gradeLevel,
    status:
      statusRaw === undefined || statusRaw === ''
        ? undefined
        : enumValue(statusRaw, 'status', statuses),
  };
}
