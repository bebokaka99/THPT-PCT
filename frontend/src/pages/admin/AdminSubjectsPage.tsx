import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpenCheck,
  FileUp,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAcademicPeriods } from '../../services/academicPeriod.service';
import * as subjectApi from '../../services/subject.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type {
  CurriculumSubject,
  Subject,
  SubjectGroup,
  SubjectInput,
} from '../../types/subject';

const groups: Array<{ value: SubjectGroup; label: string }> = [
  { value: 'natural_sciences', label: 'Khoa học tự nhiên' },
  { value: 'social_sciences', label: 'Khoa học xã hội' },
  { value: 'languages', label: 'Ngôn ngữ' },
  { value: 'technology_arts', label: 'Công nghệ & nghệ thuật' },
  { value: 'physical_education', label: 'Thể chất & quốc phòng' },
  { value: 'other', label: 'Khác' },
];

const emptySubject: SubjectInput = {
  code: '',
  name: '',
  subject_group: 'other',
  description: null,
  is_active: true,
};

function groupLabel(group: SubjectGroup) {
  return groups.find((item) => item.value === group)?.label ?? group;
}

export function AdminSubjectsPage() {
  const { accessToken } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'catalog' | 'curriculum'>('catalog');
  const [search, setSearch] = useState('');
  const [subjectForm, setSubjectForm] = useState(emptySubject);
  const [editingSubjectId, setEditingSubjectId] = useState<number | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [academicYearId, setAcademicYearId] = useState('');
  const [gradeLevel, setGradeLevel] = useState('10');
  const [curriculumForm, setCurriculumForm] = useState({
    subject_id: '',
    periods_per_week: '2',
    is_required: true,
    is_active: true,
  });
  const [editingCurriculumId, setEditingCurriculumId] = useState<number | null>(
    null,
  );

  const periods = useQuery({
    queryKey: ['academic-periods'],
    queryFn: () => getAcademicPeriods(accessToken!),
    enabled: Boolean(accessToken),
  });
  const subjects = useQuery({
    queryKey: ['admin', 'subjects', search],
    queryFn: () =>
      subjectApi.getSubjects(accessToken!, {
        q: search || undefined,
        limit: 100,
      }),
    enabled: Boolean(accessToken),
  });

  const selectedYearId = Number(
    academicYearId ||
      periods.data?.find((year) => year.status === 'active')?.id ||
      periods.data?.[0]?.id ||
      0,
  );
  const selectedGrade = Number(gradeLevel);
  const curriculum = useQuery({
    queryKey: [
      'curriculum',
      selectedYearId,
      selectedGrade,
    ],
    queryFn: () =>
      subjectApi.getCurriculum(accessToken!, {
        academic_year_id: selectedYearId,
        grade_level: selectedGrade,
      }),
    enabled: Boolean(accessToken && selectedYearId),
  });

  const mutation = useMutation({
    mutationFn: (action: () => Promise<unknown>) => action(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'subjects'] }),
        queryClient.invalidateQueries({ queryKey: ['curriculum'] }),
      ]);
    },
  });

  const availableSubjects = useMemo(() => {
    const assigned = new Set(
      curriculum.data
        ?.filter((item) => item.id !== editingCurriculumId)
        .map((item) => item.subject_id),
    );
    return (
      subjects.data?.data.filter(
        (subject) => subject.is_active && !assigned.has(subject.id),
      ) ?? []
    );
  }, [curriculum.data, editingCurriculumId, subjects.data?.data]);

  async function run(action: () => Promise<unknown>, message: string) {
    await mutation.mutateAsync(action);
    toast.success(message);
  }

  async function submitSubject(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    await run(
      () =>
        editingSubjectId
          ? subjectApi.updateSubject(accessToken, editingSubjectId, {
              name: subjectForm.name,
              subject_group: subjectForm.subject_group,
              description: subjectForm.description,
              is_active: subjectForm.is_active,
            })
          : subjectApi.createSubject(accessToken, subjectForm),
      editingSubjectId ? 'Đã cập nhật môn học.' : 'Đã tạo môn học.',
    );
    setEditingSubjectId(null);
    setSubjectForm(emptySubject);
  }

  function editSubject(subject: Subject) {
    setEditingSubjectId(subject.id);
    setSubjectForm({
      code: subject.code,
      name: subject.name,
      subject_group: subject.subject_group,
      description: subject.description,
      is_active: subject.is_active,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function submitImport(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) return;
    const parsed = importText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [code, name, rawGroup] = line.split('|').map((item) => item.trim());
        const group = groups.some((item) => item.value === rawGroup)
          ? (rawGroup as SubjectGroup)
          : 'other';
        return {
          code: code.toUpperCase(),
          name,
          subject_group: group,
          description: null,
          is_active: true,
        } satisfies SubjectInput;
      });
    if (parsed.some((item) => !item.code || !item.name)) {
      toast.error('Mỗi dòng import phải có dạng MÃ | Tên môn | nhóm.');
      return;
    }
    await run(
      () => subjectApi.importSubjects(accessToken, parsed),
      `Đã import ${parsed.length} môn học.`,
    );
    setImportText('');
    setShowImport(false);
  }

  async function submitCurriculum(event: FormEvent) {
    event.preventDefault();
    if (!accessToken || !selectedYearId || !curriculumForm.subject_id) return;
    const payload = {
      subject_id: Number(curriculumForm.subject_id),
      periods_per_week: Number(curriculumForm.periods_per_week),
      is_required: curriculumForm.is_required,
      is_active: curriculumForm.is_active,
    };
    await run(
      () =>
        editingCurriculumId
          ? subjectApi.updateCurriculumSubject(
              accessToken,
              editingCurriculumId,
              payload,
            )
          : subjectApi.createCurriculumSubject(accessToken, {
              academic_year_id: selectedYearId,
              grade_level: selectedGrade,
              ...payload,
            }),
      editingCurriculumId
        ? 'Đã cập nhật chương trình.'
        : 'Đã thêm môn vào chương trình.',
    );
    setEditingCurriculumId(null);
    setCurriculumForm({
      subject_id: '',
      periods_per_week: '2',
      is_required: true,
      is_active: true,
    });
  }

  function editCurriculum(item: CurriculumSubject) {
    setEditingCurriculumId(item.id);
    setCurriculumForm({
      subject_id: String(item.subject_id),
      periods_per_week: String(item.periods_per_week),
      is_required: item.is_required,
      is_active: item.is_active,
    });
  }

  return (
    <AdminLayout>
      <section className="grid gap-6">
        <header className="border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-indigo-50 text-indigo-700">
              <BookOpenCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-indigo-700">Cấu hình học vụ</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                Môn học & chương trình
              </h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Quản lý mã môn ổn định và số tiết dự kiến theo từng năm học,
                khối lớp.
              </p>
            </div>
          </div>
          <div className="mt-5 inline-flex rounded-md border border-slate-200 bg-slate-50 p-1">
            {[
              ['catalog', 'Danh mục môn học'],
              ['curriculum', 'Chương trình theo khối'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value as typeof tab)}
                className={`rounded px-4 py-2 text-sm font-semibold ${
                  tab === value
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {mutation.isError && (
          <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Không thể cập nhật dữ liệu. Mã môn có thể bị trùng, period đã khóa
            hoặc môn đang được tham chiếu.
          </p>
        )}

        {tab === 'catalog' ? (
          <>
            <form
              onSubmit={(event) => void submitSubject(event)}
              className="border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold text-slate-950">
                  {editingSubjectId ? 'Chỉnh sửa môn học' : 'Tạo môn học'}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowImport((value) => !value)}
                  className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                >
                  <FileUp className="h-4 w-4" /> Import nhanh
                </button>
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[.65fr_1.2fr_1fr_1.4fr_auto]">
                <input
                  required
                  disabled={Boolean(editingSubjectId)}
                  value={subjectForm.code}
                  onChange={(event) =>
                    setSubjectForm({
                      ...subjectForm,
                      code: event.target.value.toUpperCase(),
                    })
                  }
                  placeholder="MÃ_MÔN"
                  className="rounded-md border border-slate-300 px-3 py-2.5 disabled:bg-slate-100"
                />
                <input
                  required
                  value={subjectForm.name}
                  onChange={(event) =>
                    setSubjectForm({ ...subjectForm, name: event.target.value })
                  }
                  placeholder="Tên môn học"
                  className="rounded-md border border-slate-300 px-3 py-2.5"
                />
                <select
                  value={subjectForm.subject_group}
                  onChange={(event) =>
                    setSubjectForm({
                      ...subjectForm,
                      subject_group: event.target.value as SubjectGroup,
                    })
                  }
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5"
                >
                  {groups.map((group) => (
                    <option key={group.value} value={group.value}>
                      {group.label}
                    </option>
                  ))}
                </select>
                <input
                  value={subjectForm.description ?? ''}
                  onChange={(event) =>
                    setSubjectForm({
                      ...subjectForm,
                      description: event.target.value || null,
                    })
                  }
                  placeholder="Mô tả ngắn"
                  className="rounded-md border border-slate-300 px-3 py-2.5"
                />
                <button className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white">
                  {editingSubjectId ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingSubjectId ? 'Lưu' : 'Tạo'}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={subjectForm.is_active}
                    onChange={(event) =>
                      setSubjectForm({
                        ...subjectForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Cho phép sử dụng
                </label>
                {editingSubjectId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSubjectId(null);
                      setSubjectForm(emptySubject);
                    }}
                    className="text-sm font-semibold text-slate-500"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>
            </form>

            {showImport && (
              <form
                onSubmit={(event) => void submitImport(event)}
                className="border border-blue-200 bg-blue-50 p-5"
              >
                <h2 className="font-bold text-blue-950">Import danh mục nhanh</h2>
                <p className="mt-1 text-sm text-blue-800">
                  Mỗi dòng: <code>MÃ | Tên môn | nhóm</code>. Mã trùng sẽ cập
                  nhật metadata, không tạo duplicate.
                </p>
                <textarea
                  required
                  value={importText}
                  onChange={(event) => setImportText(event.target.value)}
                  placeholder={'TIENG_PHAP | Tiếng Pháp | languages\nROBOTICS | Robotics | technology_arts'}
                  className="mt-3 min-h-32 w-full rounded-md border border-blue-200 bg-white p-3 font-mono text-sm"
                />
                <button className="mt-3 rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
                  Import danh mục
                </button>
              </form>
            )}

            <div className="border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="font-bold text-slate-950">
                  Danh mục môn ({subjects.data?.meta.total ?? 0})
                </h2>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm mã hoặc tên môn"
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              {subjects.isLoading ? (
                <div className="h-40 animate-pulse bg-slate-50" />
              ) : subjects.data?.data.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Mã / Tên môn</th>
                        <th className="px-4 py-3">Nhóm</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Tham chiếu</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.data.data.map((subject) => (
                        <tr key={subject.id}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-950">
                              {subject.name}
                            </p>
                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {subject.code}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {groupLabel(subject.subject_group)}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={
                                subject.is_active
                                  ? 'text-emerald-700'
                                  : 'text-slate-500'
                              }
                            >
                              {subject.is_active ? 'Đang dùng' : 'Ngừng dùng'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {subject.usage_count}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => editSubject(subject)}
                                className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700"
                              >
                                Sửa
                              </button>
                              {subject.usage_count === 0 && (
                                <button
                                  type="button"
                                  title={`Xóa ${subject.name}`}
                                  aria-label={`Xóa ${subject.name}`}
                                  onClick={() => {
                                    if (
                                      window.confirm(`Xóa môn ${subject.name}?`)
                                    ) {
                                      void run(
                                        () =>
                                          subjectApi.deleteSubject(
                                            accessToken!,
                                            subject.id,
                                          ),
                                        'Đã xóa môn học.',
                                      );
                                    }
                                  }}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-10 text-center text-slate-500">
                  Không có môn học phù hợp.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="grid gap-4 border border-slate-200 bg-white p-5 shadow-sm lg:grid-cols-[1fr_.6fr]">
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Năm học
                <select
                  value={String(selectedYearId || '')}
                  onChange={(event) => {
                    setAcademicYearId(event.target.value);
                    setEditingCurriculumId(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                >
                  {periods.data?.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.status === 'active' ? ' (đang áp dụng)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                Khối
                <select
                  value={gradeLevel}
                  onChange={(event) => {
                    setGradeLevel(event.target.value);
                    setEditingCurriculumId(null);
                  }}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                >
                  <option value="10">Khối 10</option>
                  <option value="11">Khối 11</option>
                  <option value="12">Khối 12</option>
                </select>
              </label>
            </div>

            <form
              onSubmit={(event) => void submitCurriculum(event)}
              className="border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-slate-950">
                  {editingCurriculumId
                    ? 'Chỉnh sửa môn trong chương trình'
                    : `Thêm môn cho khối ${selectedGrade}`}
                </h2>
                {editingCurriculumId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCurriculumId(null);
                      setCurriculumForm({
                        subject_id: '',
                        periods_per_week: '2',
                        is_required: true,
                        is_active: true,
                      });
                    }}
                    className="text-sm font-semibold text-slate-500"
                  >
                    Hủy sửa
                  </button>
                )}
              </div>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_.6fr_auto_auto_auto] lg:items-end">
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Môn học
                  <select
                    required
                    value={curriculumForm.subject_id}
                    onChange={(event) =>
                      setCurriculumForm({
                        ...curriculumForm,
                        subject_id: event.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 bg-white px-3 py-2.5 font-normal"
                  >
                    <option value="">Chọn môn học active</option>
                    {availableSubjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name} ({subject.code})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
                  Tiết / tuần
                  <input
                    required
                    type="number"
                    min="0.1"
                    max="30"
                    step="0.1"
                    value={curriculumForm.periods_per_week}
                    onChange={(event) =>
                      setCurriculumForm({
                        ...curriculumForm,
                        periods_per_week: event.target.value,
                      })
                    }
                    className="rounded-md border border-slate-300 px-3 py-2.5 font-normal"
                  />
                </label>
                <label className="flex h-11 items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={curriculumForm.is_required}
                    onChange={(event) =>
                      setCurriculumForm({
                        ...curriculumForm,
                        is_required: event.target.checked,
                      })
                    }
                  />
                  Bắt buộc
                </label>
                <label className="flex h-11 items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={curriculumForm.is_active}
                    onChange={(event) =>
                      setCurriculumForm({
                        ...curriculumForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Active
                </label>
                <button className="h-11 rounded-md bg-blue-700 px-4 text-sm font-semibold text-white">
                  {editingCurriculumId ? 'Lưu' : 'Thêm môn'}
                </button>
              </div>
            </form>

            <div className="border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 p-4">
                <h2 className="font-bold text-slate-950">
                  Chương trình khối {selectedGrade}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {curriculum.data?.length ?? 0} môn được cấu hình
                </p>
              </div>
              {curriculum.isLoading ? (
                <div className="h-40 animate-pulse bg-slate-50" />
              ) : curriculum.data?.length ? (
                <div className="divide-y divide-slate-100">
                  {curriculum.data.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">
                            {item.subject_name}
                          </p>
                          <span className="font-mono text-xs text-slate-400">
                            {item.subject_code}
                          </span>
                          {!item.is_active && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                              Ngừng áp dụng
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {item.periods_per_week} tiết/tuần ·{' '}
                          {item.is_required ? 'Bắt buộc' : 'Tự chọn'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => editCurriculum(item)}
                          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700"
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          aria-label={`Xóa ${item.subject_name} khỏi chương trình`}
                          title={`Xóa ${item.subject_name} khỏi chương trình`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Xóa ${item.subject_name} khỏi chương trình?`,
                              )
                            ) {
                              void run(
                                () =>
                                  subjectApi.deleteCurriculumSubject(
                                    accessToken!,
                                    item.id,
                                  ),
                                'Đã xóa môn khỏi chương trình.',
                              );
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-10 text-center text-slate-500">
                  Chưa cấu hình môn học cho năm và khối này.
                </p>
              )}
            </div>
          </>
        )}
      </section>
    </AdminLayout>
  );
}
