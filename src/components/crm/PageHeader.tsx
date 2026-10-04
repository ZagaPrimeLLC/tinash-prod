export default function PageHeader({
  title, lead, actions,
}: { title: string; lead?: string; actions?: React.ReactNode }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 py-6 sm:px-8">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-plum-950">{title}</h1>
          {lead && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">{lead}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </header>
  );
}
