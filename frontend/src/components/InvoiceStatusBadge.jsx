const STATUS_STYLES = {
  Draft: 'bg-slate-100 text-slate-700 border-slate-200',
  Sent: 'bg-sky-50 text-sky-700 border-sky-200',
  'Partially Paid': 'bg-amber-50 text-amber-700 border-amber-200',
  Paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Overdue: 'bg-red-50 text-red-700 border-red-200',
  Cancelled: 'bg-zinc-100 text-zinc-500 border-zinc-200',
};

export default function InvoiceStatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.Draft;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${style}`}
    >
      {status}
    </span>
  );
}

