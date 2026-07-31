import { Inbox } from 'lucide-react';

type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-700">
        <Inbox className="h-5 w-5" />
      </span>
      <p className="mt-4 font-bold text-slate-900">{title}</p>
      {description && (
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
    </div>
  );
}
