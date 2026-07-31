import type { AuthUser } from '../auth/auth.types.js';
import { HttpError } from '../../utils/http-error.js';
import { assertSemesterWritable } from '../academic-periods/academic-period.service.js';
import { findActiveCurriculumSubject } from '../subjects/subject.repository.js';
import {
  activateAssessmentConfigurationRecord,
  deleteAssessmentConfigurationRecord,
  findAssessmentConfigurationById,
  findAssessmentConfigurations,
  insertAssessmentConfiguration,
  insertAssessmentConfigurationVersion,
  teacherCanViewAssessmentConfiguration,
  updateAssessmentConfigurationRecord,
} from './assessment-configuration.repository.js';
import type {
  AssessmentCalculationInput,
  AssessmentCalculationResult,
  AssessmentConfiguration,
  AssessmentConfigurationInput,
  AssessmentConfigurationUpdateInput,
  AssessmentRoundingMode,
  ListAssessmentConfigurationsQuery,
} from './assessment-configuration.types.js';

function isAdmin(user: AuthUser) {
  return (
    user.roles.includes('admin') ||
    user.permissions.includes('assessment_configurations.manage')
  );
}

function ensureAdmin(user: AuthUser) {
  if (!isAdmin(user)) throw new HttpError(403, 'Permission denied');
}

function isDatabaseConflict(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

async function getConfigurationOrThrow(id: number) {
  const configuration = await findAssessmentConfigurationById(id);
  if (!configuration) {
    throw new HttpError(404, 'Assessment configuration not found');
  }
  return configuration;
}

async function validateScope(input: {
  subject_id: number;
  semester_id: number;
  grade_level: number;
}) {
  const semester = await assertSemesterWritable(input.semester_id);
  const curriculum = await findActiveCurriculumSubject(
    semester.academic_year_id,
    input.grade_level,
    input.subject_id,
  );
  if (!curriculum) {
    throw new HttpError(
      409,
      'Subject is not active in the curriculum for this year and grade',
    );
  }
  return semester;
}

export async function listAssessmentConfigurationsForAdmin(
  user: AuthUser,
  query: ListAssessmentConfigurationsQuery,
) {
  ensureAdmin(user);
  const result = await findAssessmentConfigurations(query);
  return {
    data: result.data,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
}

export async function listMyAssessmentConfigurations(
  user: AuthUser,
  query: ListAssessmentConfigurationsQuery,
) {
  if (!user.roles.includes('teacher') && !isAdmin(user)) {
    throw new HttpError(403, 'Teacher role required');
  }
  const effectiveQuery = {
    ...query,
    status: 'active' as const,
  };
  const result = await findAssessmentConfigurations(
    effectiveQuery,
    isAdmin(user) ? undefined : user.id,
  );
  return {
    data: result.data,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
    },
  };
}

export async function getAssessmentConfigurationForUser(
  user: AuthUser,
  id: number,
) {
  const configuration = await getConfigurationOrThrow(id);
  if (isAdmin(user)) return configuration;
  if (
    !user.roles.includes('teacher') ||
    !(await teacherCanViewAssessmentConfiguration(user.id, id))
  ) {
    throw new HttpError(403, 'Assessment configuration access denied');
  }
  return configuration;
}

export async function createAssessmentConfiguration(
  user: AuthUser,
  input: AssessmentConfigurationInput,
) {
  ensureAdmin(user);
  await validateScope(input);
  try {
    const configuration = await insertAssessmentConfiguration(input, user.id);
    if (!configuration) {
      throw new HttpError(500, 'Failed to create assessment configuration');
    }
    return configuration;
  } catch (error) {
    if (isDatabaseConflict(error)) {
      throw new HttpError(
        409,
        'A draft assessment configuration already exists for this scope',
      );
    }
    throw error;
  }
}

export async function updateAssessmentConfiguration(
  user: AuthUser,
  id: number,
  input: AssessmentConfigurationUpdateInput,
) {
  ensureAdmin(user);
  const current = await getConfigurationOrThrow(id);
  if (current.status !== 'draft') {
    throw new HttpError(
      409,
      'Only draft configurations can be edited; create a new version',
    );
  }
  await validateScope(current);
  return updateAssessmentConfigurationRecord(id, {
    title: input.title ?? current.title,
    score_scale: input.score_scale ?? current.score_scale,
    decimal_places: input.decimal_places ?? current.decimal_places,
    rounding_mode: input.rounding_mode ?? current.rounding_mode,
    categories: input.categories,
  });
}

export async function createAssessmentConfigurationVersion(
  user: AuthUser,
  id: number,
) {
  ensureAdmin(user);
  const current = await getConfigurationOrThrow(id);
  await validateScope(current);
  try {
    const configuration = await insertAssessmentConfigurationVersion(
      current,
      user.id,
    );
    if (!configuration) {
      throw new HttpError(
        500,
        'Failed to create assessment configuration version',
      );
    }
    return configuration;
  } catch (error) {
    if (isDatabaseConflict(error)) {
      throw new HttpError(
        409,
        'A draft assessment configuration already exists for this scope',
      );
    }
    throw error;
  }
}

export async function activateAssessmentConfiguration(
  user: AuthUser,
  id: number,
) {
  ensureAdmin(user);
  const current = await getConfigurationOrThrow(id);
  if (current.status !== 'draft') {
    throw new HttpError(409, 'Only a draft configuration can be activated');
  }
  await validateScope(current);
  if (current.categories.length === 0) {
    throw new HttpError(409, 'Configuration must contain assessment categories');
  }
  const configuration =
    await activateAssessmentConfigurationRecord(current);
  if (!configuration) {
    throw new HttpError(500, 'Failed to activate assessment configuration');
  }
  return configuration;
}

export async function deleteAssessmentConfiguration(
  user: AuthUser,
  id: number,
) {
  ensureAdmin(user);
  const current = await getConfigurationOrThrow(id);
  if (current.status !== 'draft') {
    throw new HttpError(409, 'Only draft configurations can be deleted');
  }
  await validateScope(current);
  if (!(await deleteAssessmentConfigurationRecord(id))) {
    throw new HttpError(404, 'Assessment configuration not found');
  }
}

function roundScore(
  value: number,
  decimalPlaces: number,
  mode: AssessmentRoundingMode,
) {
  const factor = 10 ** decimalPlaces;
  const scaled = value * factor;
  let rounded: number;
  if (mode === 'truncate') {
    rounded = Math.trunc(scaled + Number.EPSILON);
  } else if (mode === 'half_even') {
    const lower = Math.floor(scaled);
    const fraction = scaled - lower;
    if (Math.abs(fraction - 0.5) < 1e-9) {
      rounded = lower % 2 === 0 ? lower : lower + 1;
    } else {
      rounded = Math.round(scaled);
    }
  } else {
    rounded = Math.floor(scaled + 0.5 + Number.EPSILON);
  }
  return Number((rounded / factor).toFixed(decimalPlaces));
}

function stableNumber(value: number, decimalPlaces = 6) {
  return Number(value.toFixed(decimalPlaces));
}

export function calculateAssessmentResult(
  configuration: AssessmentConfiguration,
  input: AssessmentCalculationInput,
): AssessmentCalculationResult {
  const scoreMap = new Map<string, number[]>();
  for (const group of input.scores) {
    if (scoreMap.has(group.category_code)) {
      throw new HttpError(400, 'Score category codes must be unique');
    }
    scoreMap.set(group.category_code, group.values);
  }
  if (scoreMap.size !== configuration.categories.length) {
    throw new HttpError(
      400,
      'Scores must include every configured assessment category',
    );
  }

  let rawScore = 0;
  const categories = configuration.categories.map((category) => {
    const values = scoreMap.get(category.code);
    if (!values) {
      throw new HttpError(
        400,
        `Scores are required for category ${category.code}`,
      );
    }
    if (values.length > category.max_entries) {
      throw new HttpError(
        400,
        `${category.code} allows at most ${category.max_entries} scores`,
      );
    }
    for (const value of values) {
      if (value < 0 || value > category.score_scale) {
        throw new HttpError(
          400,
          `${category.code} scores must be between 0 and ${category.score_scale}`,
        );
      }
    }
    const average =
      values.reduce((total, value) => total + value, 0) / values.length;
    const normalizedScore =
      (average / category.score_scale) * configuration.score_scale;
    const weightedScore =
      normalizedScore * (category.weight_percent / 100);
    rawScore += weightedScore;
    return {
      category_code: category.code,
      category_name: category.name,
      values,
      average: stableNumber(average),
      normalized_score: stableNumber(normalizedScore),
      weight_percent: category.weight_percent,
      weighted_score: stableNumber(weightedScore),
    };
  });

  return {
    configuration_id: configuration.id,
    score_scale: configuration.score_scale,
    decimal_places: configuration.decimal_places,
    rounding_mode: configuration.rounding_mode,
    raw_score: stableNumber(rawScore),
    final_score: roundScore(
      rawScore,
      configuration.decimal_places,
      configuration.rounding_mode,
    ),
    categories,
  };
}

export async function calculateAssessmentPreview(
  user: AuthUser,
  id: number,
  input: AssessmentCalculationInput,
) {
  const configuration = await getAssessmentConfigurationForUser(user, id);
  return calculateAssessmentResult(configuration, input);
}
