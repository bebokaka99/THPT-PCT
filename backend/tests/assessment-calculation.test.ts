import { describe, expect, it } from 'vitest';
import { calculateAssessmentResult } from '../src/modules/assessment-configurations/assessment-configuration.service.js';
import type { AssessmentConfiguration } from '../src/modules/assessment-configurations/assessment-configuration.types.js';

function configuration(
  roundingMode: AssessmentConfiguration['rounding_mode'] = 'half_up',
  decimalPlaces = 1,
): AssessmentConfiguration {
  return {
    id: 1,
    subject_id: 1,
    subject_code: 'TOAN',
    subject_name: 'Toán',
    semester_id: 1,
    semester_name: 'Học kỳ 1',
    semester_code: 'HK1',
    academic_year_id: 1,
    academic_year_name: '2025-2026',
    grade_level: 12,
    version: 1,
    title: 'Cấu hình kiểm tra',
    score_scale: 10,
    decimal_places: decimalPlaces,
    rounding_mode: roundingMode,
    status: 'active',
    created_by_user_id: 1,
    activated_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
    categories: [
      {
        id: 1,
        configuration_id: 1,
        code: 'TX',
        name: 'Thường xuyên',
        weight_percent: 40,
        coefficient: 1,
        max_entries: 4,
        score_scale: 10,
        sort_order: 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
      {
        id: 2,
        configuration_id: 1,
        code: 'CK',
        name: 'Cuối kỳ',
        weight_percent: 60,
        coefficient: 3,
        max_entries: 1,
        score_scale: 10,
        sort_order: 1,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
  };
}

describe('assessment calculation', () => {
  it('calculates weighted score and half-up rounding on the backend', () => {
    const result = calculateAssessmentResult(configuration(), {
      scores: [
        { category_code: 'TX', values: [8, 9] },
        { category_code: 'CK', values: [7.5] },
      ],
    });

    expect(result.raw_score).toBe(7.9);
    expect(result.final_score).toBe(7.9);
    expect(result.categories[0].average).toBe(8.5);
  });

  it('normalizes categories that use a different score scale', () => {
    const input = configuration();
    input.categories[0].score_scale = 20;
    const result = calculateAssessmentResult(input, {
      scores: [
        { category_code: 'TX', values: [16] },
        { category_code: 'CK', values: [8] },
      ],
    });

    expect(result.final_score).toBe(8);
  });

  it('uses documented half-even and truncate rules', () => {
    const halfEven = configuration('half_even', 0);
    halfEven.categories = [
      {
        ...halfEven.categories[0],
        weight_percent: 100,
        max_entries: 1,
      },
    ];
    expect(
      calculateAssessmentResult(halfEven, {
        scores: [{ category_code: 'TX', values: [8.5] }],
      }).final_score,
    ).toBe(8);

    const truncated = configuration('truncate', 1);
    truncated.categories = [
      {
        ...truncated.categories[0],
        weight_percent: 100,
        max_entries: 1,
      },
    ];
    expect(
      calculateAssessmentResult(truncated, {
        scores: [{ category_code: 'TX', values: [8.59] }],
      }).final_score,
    ).toBe(8.5);
  });

  it('rejects missing categories, excessive entries, and scores over scale', () => {
    expect(() =>
      calculateAssessmentResult(configuration(), {
        scores: [{ category_code: 'TX', values: [8] }],
      }),
    ).toThrow(/every configured assessment category/);

    expect(() =>
      calculateAssessmentResult(configuration(), {
        scores: [
          { category_code: 'TX', values: [8] },
          { category_code: 'CK', values: [7, 8] },
        ],
      }),
    ).toThrow(/at most 1 scores/);

    expect(() =>
      calculateAssessmentResult(configuration(), {
        scores: [
          { category_code: 'TX', values: [11] },
          { category_code: 'CK', values: [7] },
        ],
      }),
    ).toThrow(/between 0 and 10/);
  });
});
