export default function UpcomingModulePage({ title, phase, description }) {
  return (
    <div className="max-w-2xl bg-white rounded-xl border border-slate-200 p-6">
      <span className="inline-block text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
        Scheduled for {phase}
      </span>
      <h1 className="text-xl font-bold text-slate-900 mt-3">{title}</h1>
      <p className="text-sm text-slate-600 mt-2">{description}</p>
    </div>
  );
}

