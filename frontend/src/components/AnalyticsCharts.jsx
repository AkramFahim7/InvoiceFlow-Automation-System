import { useState } from 'react';

export function formatMoney(currency, value) {
  const num = Number(value || 0);
  return `${currency} ${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatShortDate(value) {
  if (!value) return '—';
  const str = String(value);
  return str.length >= 10 ? str.slice(0, 10) : str;
}

/**
 * Dual-bar SVG chart comparing Monthly Invoiced vs Collected amounts.
 */
export function MonthlyRevenueChart({ data = [], currency = 'Rs.' }) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-slate-400">
        No monthly billing activity yet.
      </div>
    );
  }

  const maxVal = Math.max(
    100,
    ...data.map((d) => Math.max(Number(d.invoicedAmount), Number(d.collectedAmount)))
  );

  // Nice round ceiling for Y-axis
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
  const niceMax = Math.ceil((maxVal * 1.1) / magnitude) * magnitude;

  const width = 680;
  const height = 250;
  const padLeft = 64;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const slotW = plotW / data.length;
  const barW = Math.min(20, Math.max(8, slotW * 0.28));

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  const activePoint = hoveredIdx !== null ? data[hoveredIdx] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-slate-800 inline-block" />
            Invoiced
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-600">
            <span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" />
            Collected
          </span>
        </div>

        <div className="min-h-[20px] text-slate-600 font-medium">
          {activePoint ? (
            <span>
              {activePoint.label}: Invoiced{' '}
              <strong className="text-slate-900">
                {formatMoney(currency, activePoint.invoicedAmount)}
              </strong>{' '}
              · Collected{' '}
              <strong className="text-teal-700">
                {formatMoney(currency, activePoint.collectedAmount)}
              </strong>
            </span>
          ) : (
            <span className="text-slate-400">Hover any month bar for exact figures</span>
          )}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-64 min-w-[460px]"
          role="img"
          aria-label="Monthly invoiced vs collected chart"
        >
          {/* Horizontal gridlines and Y labels */}
          {ticks.map((t) => {
            const y = padTop + plotH * (1 - t);
            const labelVal = Math.round(niceMax * t);
            return (
              <g key={t}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray={t === 0 ? undefined : '3 3'}
                />
                <text
                  x={padLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px]"
                >
                  {labelVal >= 1000
                    ? `${(labelVal / 1000).toFixed(labelVal % 1000 === 0 ? 0 : 1)}k`
                    : labelVal}
                </text>
              </g>
            );
          })}

          {/* Month bars */}
          {data.map((item, idx) => {
            const centerX = padLeft + slotW * idx + slotW / 2;
            const invVal = Number(item.invoicedAmount || 0);
            const colVal = Number(item.collectedAmount || 0);
            const invH = Math.max(0, (invVal / niceMax) * plotH);
            const colH = Math.max(0, (colVal / niceMax) * plotH);
            const isHovered = hoveredIdx === idx;

            return (
              <g
                key={item.monthKey}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className="cursor-pointer"
              >
                {isHovered && (
                  <rect
                    x={padLeft + slotW * idx + 4}
                    y={padTop}
                    width={Math.max(0, slotW - 8)}
                    height={plotH}
                    rx={6}
                    fill="#f1f5f9"
                  />
                )}

                {/* Invoiced bar */}
                <rect
                  x={centerX - barW - 2}
                  y={padTop + plotH - invH}
                  width={barW}
                  height={invH}
                  rx={3}
                  fill="#1e293b"
                />

                {/* Collected bar */}
                <rect
                  x={centerX + 2}
                  y={padTop + plotH - colH}
                  width={barW}
                  height={colH}
                  rx={3}
                  fill="#0d9488"
                />

                {/* X-axis label */}
                <text
                  x={centerX}
                  y={height - 12}
                  textAnchor="middle"
                  className={`text-[10px] ${
                    isHovered ? 'fill-slate-900 font-semibold' : 'fill-slate-500'
                  }`}
                >
                  {data.length > 6 ? item.label.split(' ')[0] : item.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  Paid: '#059669',
  'Partially Paid': '#0d9488',
  Sent: '#2563eb',
  Overdue: '#e11d48',
  Draft: '#94a3b8',
  Cancelled: '#cbd5e1',
};

/**
 * Clean SVG Donut Chart showing invoice lifecycle status counts.
 */
export function StatusDonutChart({ breakdown = [] }) {
  const total = breakdown.reduce((acc, item) => acc + item.count, 0);
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-40 h-40 shrink-0 flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            breakdown
              .filter((item) => item.count > 0)
              .map((item) => {
                const segmentLen = (item.count / total) * circumference;
                const dashArray = `${segmentLen} ${circumference - segmentLen}`;
                const dashOffset = -cumulativeOffset;
                cumulativeOffset += segmentLen;
                return (
                  <circle
                    key={item.status}
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={STATUS_COLORS[item.status] || '#64748b'}
                    strokeWidth={strokeWidth}
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                  />
                );
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold text-slate-900">{total}</span>
          <span className="text-[11px] uppercase tracking-wider text-slate-400">
            Invoices
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {breakdown.map((item) => {
          const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
          return (
            <div
              key={item.status}
              className="flex items-center justify-between text-xs"
            >
              <span className="inline-flex items-center gap-2 text-slate-700">
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{
                    backgroundColor: STATUS_COLORS[item.status] || '#64748b',
                  }}
                />
                {item.status}
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {item.count}{' '}
                <span className="text-slate-400 font-normal">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

