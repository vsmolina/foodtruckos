'use client';

import { Bar, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesHour } from '@/lib/db/queries/reports';
import { money } from '@/lib/format';
import { BAR_SIZE, chart, hourLabel, MONEY_STEPS, moneyTick, niceTicks } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

type DotProps = { cx?: number; cy?: number; index?: number; value?: number };

// Each hour is its own total, so columns (not a line, which implies a smooth
// change between hours). Emphasis form: today in the accent; the 7-day average
// for that hour is a short gray marker across the column — "what a normal day
// had by now" — so the comparison reads without a second series of bars.
export function SalesByHourChart({
  data,
  height = chart.height,
}: {
  data: SalesHour[];
  height?: number;
}): React.JSX.Element {
  const yTicks = niceTicks(Math.max(...data.map((d) => Math.max(d.todayCents ?? 0, d.avgCents))), MONEY_STEPS);
  const lastToday = data.reduce((last, d, i) => (d.todayCents != null ? i : last), -1);

  // The average as a short horizontal marker centred on the hour's column
  // (drawn as the dots of an invisible line). None where the average is $0 —
  // a mark on the baseline would read as data.
  const avgMarker = ({ cx, cy, index, value }: DotProps): React.JSX.Element =>
    cx != null && cy != null && value ? (
      <line
        key={`a${index}`}
        x1={cx - (BAR_SIZE + 8) / 2 - 5}
        x2={cx + (BAR_SIZE + 8) / 2 + 5}
        y1={cy}
        y2={cy}
        stroke={chart.context}
        strokeWidth={3}
        strokeLinecap="round"
      />
    ) : (
      <g key={`a${index}`} />
    );

  return (
    <div>
      <div className="mb-2 flex gap-5 text-sm text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12">
            <rect width="12" height="12" rx="2" fill={chart.emphasis} />
          </svg>
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="12">
            <line x1="1" y1="6" x2="15" y2="6" stroke={chart.context} strokeWidth="3" strokeLinecap="round" />
          </svg>
          7-day average for that hour
        </span>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
          <XAxis
            dataKey="hour"
            tickFormatter={hourLabel}
            tick={chart.tick}
            tickLine={false}
            axisLine={{ stroke: chart.grid }}
          />
          <YAxis
            tickFormatter={moneyTick}
            ticks={yTicks}
            domain={[0, yTicks[yTicks.length - 1]!]}
            tick={chart.tick}
            tickLine={false}
            axisLine={false}
            width={52}
            allowDecimals={false}
          />
          <Tooltip
            isAnimationActive={false}
            cursor={{ fill: chart.hover }}
            content={({ active, label }) => {
              const d = data.find((x) => x.hour === label);
              if (!active || !d) return null;
              return (
                <ChartTooltip
                  title={hourLabel(d.hour)}
                  rows={[
                    ...(d.todayCents != null
                      ? [{ key: 't', label: 'today', value: money(d.todayCents), color: chart.emphasis }]
                      : []),
                    { key: 'a', label: '7-day avg', value: money(d.avgCents), color: chart.context },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="todayCents"
            fill={chart.emphasis}
            barSize={BAR_SIZE + 8}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          >
            {/* Label only the current hour — the one you're living in. */}
            <LabelList
              dataKey="todayCents"
              content={({ x, y, width, index, value }) =>
                index === lastToday && typeof value === 'number' ? (
                  <text
                    x={Number(x) + Number(width) / 2}
                    y={Number(y) - 8}
                    textAnchor="middle"
                    fontSize={13}
                    fontWeight={600}
                    fill="var(--ink)"
                  >
                    {money(value)}
                  </text>
                ) : null
              }
            />
          </Bar>
          <Line
            dataKey="avgCents"
            stroke="none"
            dot={avgMarker}
            activeDot={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
