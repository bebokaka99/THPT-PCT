import { Link } from 'react-router-dom';

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionTo?: string;
};

export function SectionHeading({
  actionLabel,
  actionTo,
  description,
  eyebrow,
  title,
}: SectionHeadingProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">{eyebrow}</p>}
        <h2 className="mt-2 text-2xl font-bold text-slate-950 md:text-3xl">{title}</h2>
        {description && <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>}
      </div>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="inline-flex w-fit items-center rounded border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 transition hover:border-blue-700 hover:bg-blue-50"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
