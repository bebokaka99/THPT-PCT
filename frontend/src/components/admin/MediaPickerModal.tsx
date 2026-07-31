import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { resolveMediaDisplayUrl, resolvePublicMediaUrl } from '../../lib/media-url';
import { getAdminMedia, uploadMedia } from '../../services/adminMedia.service';
import type { MediaFile } from '../../types/media';

type MediaPickerModalProps = {
  isOpen: boolean;
  token: string;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export function MediaPickerModal({ isOpen, onClose, onSelect, token }: MediaPickerModalProps) {
  const [images, setImages] = useState<MediaFile[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadImages() {
    try {
      setIsLoading(true);
      const response = await getAdminMedia(token, {
        type: 'image',
        page: 1,
        limit: 20,
      });
      setImages(response.data);
      setError(null);
    } catch {
      setError('Không thể tải danh sách ảnh.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      void loadImages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, token]);

  const filteredImages = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return images;
    }

    return images.filter((image) => image.original_name.toLowerCase().includes(keyword));
  }, [images, query]);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      setIsUploading(true);
      await uploadMedia(token, file);
      event.target.value = '';
      await loadImages();
      setError(null);
    } catch {
      setError('Upload ảnh thất bại. Chỉ hỗ trợ jpg, jpeg, png, webp và tối đa 10MB.');
    } finally {
      setIsUploading(false);
    }
  }

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 px-4 py-6">
      <div className="flex max-h-[88vh] w-full max-w-5xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-blue-700">Media</p>
            <h2 className="text-xl font-bold text-slate-950">Chọn ảnh cover</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-red-500 hover:text-red-600"
          >
            Đóng
          </button>
        </div>

        <div className="grid gap-4 border-b border-slate-200 p-5 md:grid-cols-[1fr_260px]">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Tìm theo tên file
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2 font-normal text-slate-900"
              placeholder="Nhập tên ảnh..."
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Upload ảnh mới
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              onChange={(event) => void handleUpload(event)}
              disabled={isUploading}
              className="rounded border border-slate-300 px-3 py-2 font-normal"
            />
          </label>
        </div>

        {isUploading && <p className="mx-5 mt-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">Đang upload ảnh...</p>}
        {error && <p className="mx-5 mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <p className="rounded border border-slate-200 p-5 text-slate-600">Đang tải ảnh...</p>
          ) : filteredImages.length === 0 ? (
            <p className="rounded border border-slate-200 p-5 text-slate-600">Chưa có ảnh phù hợp.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {filteredImages.map((image) => {
                const publicUrl = resolveMediaDisplayUrl(image, 'thumbnail');
                const selectedUrl = image.variants?.medium?.url ?? image.url;

                return (
                  <button
                    key={image.id}
                    type="button"
                    onClick={() => onSelect(selectedUrl)}
                    className="overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-blue-500 hover:shadow-sm"
                  >
                    <img
                      src={publicUrl}
                      alt={image.original_name}
                      className="aspect-video w-full object-cover"
                    />
                    <div className="p-3">
                      <p className="truncate text-sm font-semibold text-slate-900">{image.original_name}</p>
                      <p className="mt-1 text-xs text-slate-500">{image.mime_type}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
