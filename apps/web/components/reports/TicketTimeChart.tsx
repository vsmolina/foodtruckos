'use client';

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TicketTimeDay } from '@/lib/db/queries/reports';
import { duration } from '@/lib/format';
import { chart, DOT_R, DURATION_STEPS, LINE_WIDTH, niceTicks } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

const dayLabel = (day: string): string =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

// Single series: no legend (the title names it). Days with no finished tickets
// are gaps, not zeros; each day with data gets a dot so isolated days still show.
export function TicketTimeChart({ data }: { data: TicketTimeDay[] }): React.JSX.Element {
  const yTicks = niceTicks(Math.max(...data.map((d) => d.avgSeconds ?? 0)), DURATION_STEPS);
  return (
    <ResponsiveContainer width="100%" height={chart.height}>
      <LineChart data={data} margin={{ top: 16, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={chart.grid} strokeWidth={1} />
        <XAxis
          dataKey="day"
          tickFormatter={dayLabel}
          tick={chart.tick}
          tickLine={false}
          axisLine={{ stroke: chart.grid }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tickFormatter={(s: number) => duration(s)}
          ticks={yTicks}
          domain={[0, yTicks[yTicks.length - 1]!]}
          tick={chart.tick}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={{ stroke: chart.grid, strokeWidth: 1 }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as TicketTimeDay | undefined;
            if (!active || !d) return null;
            return (
              <ChartTooltip
                title={dayLabel(d.day)}
                rows={[
                  {
                    key: 's',
                    label: d.avgSeconds == null ? 'no finished tickets' : 'avg ticket time',
                    value: duration(d.avgSeconds),
                    color: chart.mark,
                  },
                ]}
              />
            );
          }}
        />
        <Line
          dataKey="avgSeconds"
          stroke={chart.mark}
          strokeWidth={LINE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={{ r: DOT_R, fill: chart.mark, stroke: chart.surface, strokeWidth: 2 }}
          activeDot={{ r: DOT_R + 1, fill: chart.mark, stroke: chart.surface, strokeWidth: 2 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
