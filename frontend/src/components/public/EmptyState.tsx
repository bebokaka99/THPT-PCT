type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ description, title }: EmptyStateProps) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="font-semibold text-slate-900">{title}</p>
      {description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}
    </div>
  );
}
