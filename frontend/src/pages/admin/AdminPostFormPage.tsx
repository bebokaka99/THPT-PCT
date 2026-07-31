import { lazy, Suspense, useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MediaPickerModal } from '../../components/admin/MediaPickerModal';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { resolvePublicMediaUrl } from '../../lib/media-url';
import { getAllAdminCategories } from '../../services/adminCategory.service';
import {
  createAdminPost,
  getAdminPostById,
  updateAdminPost,
} from '../../services/adminPost.service';
import { uploadMedia } from '../../services/adminMedia.service';
import { useAuth } from '../../stores/auth-context';
import { useToast } from '../../stores/toast-context';
import type { Category } from '../../types/category';
import type { PostFormInput, PostImage, PostStatus } from '../../types/post';

const RichTextEditor = lazy(() =>
  import('../../components/admin/RichTextEditor').then((module) => ({
    default: module.RichTextEditor,
  })),
);

const emptyForm: PostFormInput = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_image_url: '',
  category_id: null,
  status: 'draft',
  post_images: [],
};

const validPostStatuses = new Set<PostStatus>(['draft', 'published', 'archived']);

function normalizePostStatus(status: unknown): PostStatus {
  if (typeof status === 'string' && validPostStatuses.has(status as PostStatus)) {
    return status as PostStatus;
  }

  console.warn('[AdminPostFormPage] Invalid post status. Falling back to draft.', {
    receivedStatus: status,
  });

  return 'draft';
}

export function AdminPostFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const { success } = useToast();
  const isEdit = Boolean(id);
  const [form, setForm] = useState<PostFormInput>(emptyForm);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [isMediaPickerOpen, setIsMediaPickerOpen] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<'cover' | 'gallery'>('cover');
  const [galleryUrlInput, setGalleryUrlInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!accessToken) {
        return;
      }

      try {
        setIsLoading(true);
        setIsEditorReady(false);
        const categoryResponse = await getAllAdminCategories(accessToken);
        let nextForm = emptyForm;

        if (id) {
          const post = await getAdminPostById(accessToken, Number(id));
          nextForm = {
            title: post.title,
            slug: post.slug,
            excerpt: post.excerpt ?? '',
            content: post.content,
            cover_image_url: post.cover_image_url ?? '',
            category_id: post.category_id,
            status: normalizePostStatus(post.status),
            post_images: (post.post_images ?? []).map((image, index) => ({
              id: image.id,
              image_url: image.image_url,
              alt_text: image.alt_text ?? '',
              caption: image.caption ?? '',
              sort_order: image.sort_order ?? index,
            })),
          };
        }

        if (isMounted) {
          setCategories(categoryResponse.data);
          setForm(nextForm);
          setError(null);
        }
      } catch {
        if (isMounted) {
          setError('Không thể tải dữ liệu form bài viết.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [accessToken, id]);

  function updateField<K extends keyof PostFormInput>(key: K, value: PostFormInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function normalizeGalleryImages(images: PostImage[] = []) {
    return images
      .filter((image) => image.image_url.trim())
      .map((image, index) => ({
        id: image.id,
        image_url: image.image_url.trim(),
        alt_text: image.alt_text?.trim() || null,
        caption: image.caption?.trim() || null,
        sort_order: index,
      }));
  }

  function addGalleryImages(urls: string[]) {
    const cleanUrls = urls.map((url) => url.trim()).filter(Boolean);

    if (cleanUrls.length === 0) {
      return;
    }

    setForm((current) => {
      const existingImages = current.post_images ?? [];
      const nextImages = [
        ...existingImages,
        ...cleanUrls.map((url, index) => ({
          image_url: url,
          alt_text: '',
          caption: '',
          sort_order: existingImages.length + index,
        })),
      ];

      return {
        ...current,
        cover_image_url: current.cover_image_url || cleanUrls[0],
        post_images: nextImages,
      };
    });
  }

  function updateGalleryImage(index: number, patch: Partial<PostImage>) {
    setForm((current) => ({
      ...current,
      post_images: (current.post_images ?? []).map((image, imageIndex) =>
        imageIndex === index ? { ...image, ...patch } : image,
      ),
    }));
  }

  function removeGalleryImage(index: number) {
    setForm((current) => ({
      ...current,
      post_images: (current.post_images ?? []).filter((_, imageIndex) => imageIndex !== index),
    }));
  }

  function moveGalleryImage(index: number, direction: -1 | 1) {
    setForm((current) => {
      const images = [...(current.post_images ?? [])];
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= images.length) {
        return current;
      }

      [images[index], images[nextIndex]] = [images[nextIndex], images[index]];

      return {
        ...current,
        post_images: images,
      };
    });
  }

  const handleEditorReady = useCallback(() => {
    setIsEditorReady(true);
  }, []);

  function normalizeInput(): PostFormInput {
    return {
      title: form.title.trim(),
      slug: form.slug?.trim() || undefined,
      excerpt: form.excerpt?.trim() || null,
      content: form.content.trim(),
      cover_image_url: form.cover_image_url?.trim() || null,
      category_id: form.category_id || null,
      status: normalizePostStatus(form.status),
      post_images: normalizeGalleryImages(form.post_images),
    };
  }

  async function handleCoverUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file || !accessToken) {
      return;
    }

    try {
      setIsUploadingCover(true);
      setError(null);
      const response = await uploadMedia(accessToken, file);
      updateField('cover_image_url', response.data.url);
      event.target.value = '';
    } catch {
      setError('Upload ảnh cover thất bại. Chỉ hỗ trợ jpg, jpeg, png, webp và tối đa 10MB.');
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleGalleryUpload(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (files.length === 0 || !accessToken) {
      return;
    }

    try {
      setIsUploadingGallery(true);
      setError(null);

      let uploadedCount = 0;
      let failedCount = 0;

      for (const file of files) {
        try {
          const response = await uploadMedia(accessToken, file);
          addGalleryImages([response.data.url]);
          uploadedCount += 1;
        } catch {
          failedCount += 1;
        }
      }

      event.target.value = '';

      if (uploadedCount === 0) {
        setError('Upload ảnh nội dung thất bại. Chỉ hỗ trợ jpg, jpeg, png, webp và tối đa 10MB mỗi file.');
      } else if (failedCount > 0) {
        setError(`Đã upload ${uploadedCount} ảnh. Có ${failedCount} ảnh không upload được do sai định dạng hoặc vượt giới hạn.`);
      }
    } catch {
      setError('Upload ảnh nội dung thất bại. Chỉ hỗ trợ jpg, jpeg, png, webp và tối đa 10MB mỗi file.');
    } finally {
      setIsUploadingGallery(false);
    }
  }

  function handleAddGalleryUrl() {
    const url = galleryUrlInput.trim();

    if (!url) {
      return;
    }

    addGalleryImages([url]);
    setGalleryUrlInput('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!accessToken) {
      setError('Phiên đăng nhập không hợp lệ.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);
      const input = normalizeInput();

      if (!isEditorReady) {
        setError('Trình soạn thảo chưa sẵn sàng. Vui lòng đợi editor tải xong.');
        return;
      }

      if (id) {
        await updateAdminPost(accessToken, Number(id), input);
      } else {
        await createAdminPost(accessToken, input);
      }

      success(id ? 'Đã cập nhật bài viết.' : 'Đã tạo bài viết.');
      navigate('/admin/posts');
    } catch {
      setError('Không thể lưu bài viết. Vui lòng kiểm tra dữ liệu.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout>
      <section className="mx-auto max-w-4xl">
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <Link to="/admin/posts" className="text-sm font-semibold text-blue-700">
            Quay lại danh sách
          </Link>
          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            {isEdit ? 'Sửa bài viết' : 'Tạo bài viết mới'}
          </h2>
        </div>

        {error && <p className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
        {isLoading ? (
          <p className="mt-4 rounded border border-slate-200 bg-white p-5 text-slate-600">Đang tải form...</p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 grid gap-4 rounded-lg border border-slate-200 bg-white p-5">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Tiêu đề
              <input
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                required
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Slug tùy chọn
              <input
                value={form.slug ?? ''}
                onChange={(event) => updateField('slug', event.target.value)}
                className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                placeholder="Để trống để backend tự tạo"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Mô tả ngắn
              <textarea
                value={form.excerpt ?? ''}
                onChange={(event) => updateField('excerpt', event.target.value)}
                className="min-h-24 rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              />
            </label>

            <div className="grid gap-2 text-sm font-semibold text-slate-700">
              Nội dung
              <Suspense
                fallback={
                  <div className="rounded border border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                    Đang tải editor...
                  </div>
                }
              >
                <RichTextEditor
                  value={form.content}
                  onChange={(value) => updateField('content', value)}
                  onReady={handleEditorReady}
                />
              </Suspense>
            </div>

            <div className="grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Cover image URL
                <input
                  value={form.cover_image_url ?? ''}
                  onChange={(event) => updateField('cover_image_url', event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setMediaPickerTarget('cover');
                    setIsMediaPickerOpen(true);
                  }}
                  className="rounded border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Chọn từ Media
                </button>
                <label className="grid gap-1 text-sm font-semibold text-slate-700">
                  Upload ảnh mới
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    onChange={(event) => void handleCoverUpload(event)}
                    disabled={isUploadingCover}
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-normal"
                  />
                </label>
              </div>

              {form.cover_image_url && (
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="mb-2 text-sm font-semibold text-slate-700">Preview cover</p>
                  <img
                  src={resolvePublicMediaUrl(form.cover_image_url)}
                    alt="Cover preview"
                    className="aspect-video max-h-72 w-full rounded object-cover"
                  />
                </div>
              )}
            </div>

            <section className="grid gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div>
                <h3 className="text-base font-bold text-slate-950">Ảnh nội dung / văn bản đính kèm</h3>
                <p className="mt-1 text-sm font-normal text-slate-600">
                  Có thể để trống nội dung nếu bài viết sử dụng ảnh văn bản bên dưới. Ảnh đầu tiên sẽ được tự đặt làm cover nếu cover đang trống.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                <input
                  value={galleryUrlInput}
                  onChange={(event) => setGalleryUrlInput(event.target.value)}
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                  placeholder="Nhập URL ảnh, ví dụ /uploads/images/file.png"
                />
                <button
                  type="button"
                  onClick={handleAddGalleryUrl}
                  className="rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
                >
                  Thêm URL
                </button>
              </div>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Upload nhiều ảnh
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={(event) => void handleGalleryUpload(event)}
                  disabled={isUploadingGallery}
                  className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-normal"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setMediaPickerTarget('gallery');
                  setIsMediaPickerOpen(true);
                }}
                className="w-fit rounded border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                Chọn ảnh từ Media
              </button>

              {isUploadingGallery && (
                <p className="rounded border border-blue-200 bg-blue-50 p-3 text-sm font-normal text-blue-700">
                  Đang upload ảnh nội dung...
                </p>
              )}

              {(form.post_images ?? []).length > 0 ? (
                <div className="grid gap-4">
                  {(form.post_images ?? []).map((image, index) => (
                    <div key={`${image.image_url}-${index}`} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[180px_1fr]">
                      <div className="rounded border border-slate-200 bg-white p-2">
                        <img
                        src={resolvePublicMediaUrl(image.image_url)}
                          alt={image.alt_text || image.caption || `Ảnh ${index + 1}`}
                          className="max-h-80 w-full rounded object-contain"
                        />
                      </div>

                      <div className="grid gap-3">
                        <input
                          value={image.image_url}
                          onChange={(event) => updateGalleryImage(index, { image_url: event.target.value })}
                          className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                          placeholder="URL ảnh"
                        />
                        <div className="grid gap-3 md:grid-cols-2">
                          <input
                            value={image.alt_text ?? ''}
                            onChange={(event) => updateGalleryImage(index, { alt_text: event.target.value })}
                            className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                            placeholder="Alt text"
                          />
                          <input
                            value={image.caption ?? ''}
                            onChange={(event) => updateGalleryImage(index, { caption: event.target.value })}
                            className="rounded border border-slate-300 px-3 py-2 text-sm font-normal text-slate-900"
                            placeholder="Caption"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, -1)}
                            disabled={index === 0}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Lên
                          </button>
                          <button
                            type="button"
                            onClick={() => moveGalleryImage(index, 1)}
                            disabled={index === (form.post_images ?? []).length - 1}
                            className="rounded border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Xuống
                          </button>
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded border border-dashed border-slate-300 bg-white p-4 text-sm font-normal text-slate-500">
                  Chưa có ảnh nội dung. Bạn có thể upload nhiều ảnh hoặc thêm URL ảnh từ Media.
                </p>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Danh mục
                <select
                  value={form.category_id ?? ''}
                  onChange={(event) =>
                    updateField('category_id', event.target.value ? Number(event.target.value) : null)
                  }
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                >
                  <option value="">Không chọn</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Trạng thái
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', normalizePostStatus(event.target.value))}
                  className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
                >
                  <option value="draft">Nháp</option>
                  <option value="published">Đã xuất bản</option>
                  <option value="archived">Đã lưu trữ</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Link
                to="/admin/posts"
                className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Hủy
              </Link>
              <button
                type="submit"
                disabled={isSaving || !isEditorReady}
                className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Đang lưu...' : 'Lưu bài viết'}
              </button>
            </div>
          </form>
        )}
      </section>

      {accessToken && (
        <MediaPickerModal
          isOpen={isMediaPickerOpen}
          token={accessToken}
          onClose={() => setIsMediaPickerOpen(false)}
          onSelect={(url) => {
            if (mediaPickerTarget === 'gallery') {
              addGalleryImages([url]);
            } else {
              updateField('cover_image_url', url);
            }
            setIsMediaPickerOpen(false);
          }}
        />
      )}
    </AdminLayout>
  );
}
