'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SalesHour } from '@/lib/db/queries/reports';
import { money } from '@/lib/format';
import { chart, DOT_R, hourLabel, LINE_WIDTH, MONEY_STEPS, moneyTick, niceTicks } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

type DotProps = { cx?: number; cy?: number; index?: number };

// Emphasis form: today in the accent, the 7-day average as dashed context gray.
export function SalesByHourChart({ data }: { data: SalesHour[] }): React.JSX.Element {
  const yTicks = niceTicks(Math.max(...data.map((d) => Math.max(d.todayCents ?? 0, d.avgCents))), MONEY_STEPS);
  // Index of the latest hour today that has happened — its end dot + direct label.
  const lastToday = data.reduce((last, d, i) => (d.todayCents != null ? i : last), -1);

  const endDot = ({ cx, cy, index }: DotProps): React.JSX.Element => {
    if (index !== lastToday || cx == null || cy == null) return <g key={`d${index}`} />;
    return (
      <g key={`d${index}`}>
        <circle cx={cx} cy={cy} r={DOT_R} fill={chart.emphasis} stroke={chart.surface} strokeWidth={2} />
        <text
          x={cx + 8}
          y={cy - 8}
          fontSize={12}
          fontFamily="var(--font-mono)"
          fontWeight={600}
          fill="var(--ink)"
        >
          {money(data[index]?.todayCents ?? 0)}
        </text>
      </g>
    );
  };

  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs text-ink-2" aria-hidden>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4">
            <line x1="0" y1="2" x2="16" y2="2" stroke={chart.emphasis} strokeWidth="2" />
          </svg>
          Today
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="4">
            <line x1="0" y1="2" x2="16" y2="2" stroke={chart.context} strokeWidth="2" strokeDasharray="4 3" />
          </svg>
          7-day average
        </span>
      </div>
      <ResponsiveContainer width="100%" height={chart.height}>
        <LineChart data={data} margin={{ top: 16, right: 56, bottom: 0, left: 0 }}>
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
            cursor={{ stroke: chart.grid, strokeWidth: 1 }}
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
                    { key: 'a', label: '7-day avg', value: money(d.avgCents), color: chart.context, dashed: true },
                  ]}
                />
              );
            }}
          />
          <Line
            dataKey="avgCents"
            stroke={chart.context}
            strokeWidth={LINE_WIDTH}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: DOT_R, fill: chart.context, stroke: chart.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
          <Line
            dataKey="todayCents"
            stroke={chart.emphasis}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={endDot}
            activeDot={{ r: DOT_R, fill: chart.emphasis, stroke: chart.surface, strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
