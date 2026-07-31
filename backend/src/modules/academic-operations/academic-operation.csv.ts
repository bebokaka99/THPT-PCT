import { parse } from 'csv-parse/sync';
import { HttpError } from '../../utils/http-error.js';
import type {
  AcademicImportType,
  CsvRow,
} from './academic-operation.types.js';

const FORMULA_PREFIX = /^[=+\-@]/;

function cleanCell(value: unknown) {
  const normalized = String(value ?? '').trim();
  if (FORMULA_PREFIX.test(normalized)) {
    throw new HttpError(
      400,
      'CSV contains a formula-like cell. Formulas and macros are not accepted.',
    );
  }
  return normalized;
}

export function parseAcademicCsv(buffer: Buffer): CsvRow[] {
  let records: Record<string, unknown>[];
  try {
    records = parse(buffer, {
      bom: true,
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: false,
    }) as Record<string, unknown>[];
  } catch {
    throw new HttpError(400, 'CSV file is malformed or has inconsistent columns');
  }
  if (records.length === 0) {
    throw new HttpError(400, 'CSV file must contain at least one data row');
  }
  if (records.length > 2000) {
    throw new HttpError(400, 'CSV file cannot exceed 2000 data rows');
  }
  return records.map((record) =>
    Object.fromEntries(
      Object.entries(record).map(([key, value]) => [
        cleanCell(key).toLowerCase(),
        cleanCell(value),
      ]),
    ),
  );
}

function safeCsvCell(value: unknown) {
  let text = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(
  headers: string[],
  rows: Array<Record<string, unknown>>,
) {
  const lines = [
    headers.map(safeCsvCell).join(','),
    ...rows.map((row) => headers.map((header) => safeCsvCell(row[header])).join(',')),
  ];
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export const importTemplates: Record<AcademicImportType, {
  headers: string[];
  example: Record<string, unknown>;
}> = {
  enrollments: {
    headers: ['student_code', 'classroom_id', 'enrolled_at', 'note'],
    example: {
      student_code: '12PCT01010001',
      classroom_id: 1,
      enrolled_at: '2026-08-15',
      note: '',
    },
  },
  assignments: {
    headers: [
      'teaching_assignment_id',
      'title',
      'description',
      'due_at',
      'allow_late',
    ],
    example: {
      teaching_assignment_id: 1,
      title: 'Bai tap tuan 1',
      description: '',
      due_at: '2026-09-01T16:00:00+07:00',
      allow_late: 'false',
    },
  },
  attendance: {
    headers: [
      'session_id',
      'student_code',
      'status',
      'note',
      'correction_reason',
    ],
    example: {
      session_id: 1,
      student_code: '12PCT01010001',
      status: 'present',
      note: '',
      correction_reason: '',
    },
  },
  grades: {
    headers: [
      'gradebook_id',
      'student_code',
      'column_label',
      'state',
      'score',
      'expected_version',
      'reason',
    ],
    example: {
      gradebook_id: 1,
      student_code: '12PCT01010001',
      column_label: 'Kiem tra thuong xuyen 1',
      state: 'scored',
      score: '8.5',
      expected_version: 0,
      reason: 'Nhap diem tu file CSV',
    },
  },
};
