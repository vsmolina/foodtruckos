'use client';

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TopItem } from '@/lib/db/queries/reports';
import { BAR_SIZE, chart } from './chart-theme';
import { ChartTooltip } from './ChartTooltip';

// Horizontal bars (long item names), sorted high → low, value at each bar's tip.
export function TopItemsChart({ data }: { data: TopItem[] }): React.JSX.Element {
  const height = Math.max(120, data.length * (BAR_SIZE + 14) + 16);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 0 }}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={160}
          tick={{ ...chart.tick, fontFamily: 'var(--font-sans)', fontSize: 12, fill: 'var(--ink-2)' }}
          tickLine={false}
          axisLine={{ stroke: chart.grid }}
        />
        <Tooltip
          isAnimationActive={false}
          cursor={{ fill: chart.hover }}
          content={({ active, payload }) => {
            const d = payload?.[0]?.payload as TopItem | undefined;
            if (!active || !d) return null;
            return (
              <ChartTooltip title={d.name} rows={[{ key: 'q', label: 'sold', value: String(d.qty), color: chart.mark }]} />
            );
          }}
        />
        <Bar dataKey="qty" fill={chart.mark} barSize={BAR_SIZE} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList
            dataKey="qty"
            position="right"
            offset={6}
            style={{ fill: 'var(--ink)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
