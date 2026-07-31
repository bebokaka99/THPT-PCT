import { Camera, Trash2, Upload } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { uploadProfileAvatar } from '../../services/profile.service';
import { useToast } from '../../stores/toast-context';
import type { MyProfile } from '../../types/profile';

type ProfileAvatarEditorProps = {
  token: string;
  value: string;
  accent?: 'blue' | 'emerald';
  onChange: (value: string) => void;
  onProfileUpdated: (profile: MyProfile) => void;
};

const accentClasses = {
  blue: 'bg-blue-700 hover:bg-blue-800 focus-visible:ring-blue-600',
  emerald: 'bg-emerald-700 hover:bg-emerald-800 focus-visible:ring-emerald-600',
};

export function ProfileAvatarEditor({
  accent = 'blue',
  onChange,
  onProfileUpdated,
  token,
  value,
}: ProfileAvatarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Ảnh đại diện không được lớn hơn 5 MB.');
      return;
    }

    try {
      setIsUploading(true);
      setError(null);
      const result = await uploadProfileAvatar(token, file);
      onChange(
        result.media.variants?.medium?.url ??
          result.media.url,
      );
      onProfileUpdated(result.profile);
      toast.success('Đã cập nhật ảnh đại diện.');
    } catch {
      setError('Không thể upload ảnh đại diện. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <fieldset className="grid gap-3" disabled={isUploading}>
      <legend className="text-sm font-semibold text-slate-700">
        <span className="inline-flex items-center gap-2">
          <Camera className="h-4 w-4 text-slate-400" />
          Ảnh đại diện
        </span>
      </legend>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => void handleUpload(event)}
        className="sr-only"
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${accentClasses[accent]}`}
        >
          <Upload className="h-4 w-4" />
          {isUploading ? 'Đang upload...' : 'Upload ảnh'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:border-red-300 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
            Gỡ ảnh
          </button>
        )}
      </div>

      <label className="grid gap-2 text-sm font-semibold text-slate-700">
        Hoặc nhập URL ảnh
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={500}
          placeholder="https://... hoặc /uploads/images/..."
          className="rounded-md border border-slate-300 px-3 py-2.5 font-normal outline-none focus:border-blue-600"
        />
      </label>

      <p className="text-xs leading-5 text-slate-500">
        Hỗ trợ JPG, PNG, WebP; dung lượng tối đa 5 MB. Ảnh upload được lưu trực
        tiếp vào hồ sơ.
      </p>
      {error && <p className="text-sm font-medium text-red-700">{error}</p>}
    </fieldset>
  );
}
