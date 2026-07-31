import { ArrowRight } from 'lucide-react';
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
    <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
      <div className="max-w-2xl border-l-4 border-blue-700 pl-5">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-700">
            {eyebrow}
          </p>
        )}
        <h2 className="mt-2 text-2xl font-extrabold leading-tight text-slate-950 md:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
            {description}
          </p>
        )}
      </div>
      {actionLabel && actionTo && (
        <Link
          to={actionTo}
          className="inline-flex w-fit items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-900"
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </div>
  );
}
