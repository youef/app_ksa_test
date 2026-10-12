import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
  Rect,
} from 'react-native-svg';
import { ADMIN_COLORS as C } from './adminStyles';

export interface TrendPoint {
  label: string;
  value: number;
}

/** Percentage change between the first and second half of a series. */
export function trendDelta(data: TrendPoint[]): { pct: number; up: boolean } {
  if (!data || data.length < 2) return { pct: 0, up: true };
  const half = Math.floor(data.length / 2);
  const first = data.slice(0, half).reduce((s, d) => s + d.value, 0);
  const second = data.slice(half).reduce((s, d) => s + d.value, 0);
  if (first === 0) return { pct: second > 0 ? 100 : 0, up: second >= first };
  const raw = Math.round(((second - first) / first) * 100);
  const pct = Math.min(999, Math.abs(raw));
  return { pct, up: raw >= 0 };
}

/** Buckets rows into a per-day series (oldest first) using local dates. */
export function bucketByDay(
  rows: Array<{ created_at?: string | null }> | null | undefined,
  days = 30
): TrendPoint[] {
  const out: TrendPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const counts = new Map<string, number>();
  (rows || []).forEach((r) => {
    if (!r?.created_at) return;
    const d = new Date(r.created_at);
    if (Number.isNaN(d.getTime())) return;
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, value: counts.get(key) || 0 });
  }
  return out;
}

const PAD_X = 10;
const PAD_TOP = 12;
const PAD_BOTTOM = 10;

/** Responsive SVG area + line chart with a gradient fill. */
export function TrendChart({
  data,
  color = C.accent,
  height = 130,
  showLabels = true,
}: {
  data: TrendPoint[];
  color?: string;
  height?: number;
  showLabels?: boolean;
}) {
  const [width, setWidth] = useState(0);
  const values = data.map((d) => d.value);
  const max = Math.max(1, ...values);
  const innerW = Math.max(0, width - PAD_X * 2);
  const innerH = Math.max(0, height - PAD_TOP - PAD_BOTTOM);
  const n = data.length;

  let linePath = '';
  let areaPath = '';
  let points: Array<{ x: number; y: number }> = [];

  if (width > 0 && n > 0) {
    points = data.map((d, i) => {
      const x = PAD_X + (n === 1 ? innerW / 2 : (i * innerW) / (n - 1));
      const y = PAD_TOP + innerH - (d.value / max) * innerH;
      return { x, y };
    });
    linePath = 'M ' + points.map((p) => `${p.x} ${p.y}`).join(' L ');
    areaPath = `${linePath} L ${points[n - 1].x} ${PAD_TOP + innerH} L ${points[0].x} ${PAD_TOP + innerH} Z`;
  }

  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <View>
      <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && n > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity="0.30" />
                <Stop offset="1" stopColor={color} stopOpacity="0.02" />
              </LinearGradient>
            </Defs>
            {/* horizontal grid lines */}
            {[0, 0.5, 1].map((f) => (
              <Line
                key={f}
                x1={PAD_X}
                x2={width - PAD_X}
                y1={PAD_TOP + innerH * f}
                y2={PAD_TOP + innerH * f}
                stroke={C.borderLight}
                strokeWidth={1}
              />
            ))}
            <Path d={areaPath} fill={`url(#${gradId})`} />
            <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4 : 2.4} fill={color} />
            ))}
          </Svg>
        ) : null}
      </View>
      {showLabels && n > 0 ? (
        <View style={styles.axis}>
          <Text style={styles.axisText}>{data[0]?.label}</Text>
          {n > 2 ? <Text style={styles.axisText}>{data[Math.floor(n / 2)]?.label}</Text> : null}
          <Text style={styles.axisText}>{data[n - 1]?.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Compact vertical bars for a distribution. */
export function MiniBars({ data, color = C.info }: { data: TrendPoint[]; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View style={styles.barsRow}>
      {data.map((d, i) => (
        <View key={i} style={styles.barCol}>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color }]} />
          </View>
          <Text style={styles.barValue}>{d.value}</Text>
          <Text style={styles.barLabel} numberOfLines={1}>{d.label}</Text>
        </View>
      ))}
    </View>
  );
}

/** KPI tile with a delta chip and an inline sparkline. */
export function InsightCard({
  title,
  value,
  color,
  data,
  suffix,
}: {
  title: string;
  value: number;
  color: string;
  data: TrendPoint[];
  suffix?: string;
}) {
  const delta = trendDelta(data);
  return (
    <View style={styles.insightCard}>
      <View style={styles.insightHead}>
        <View style={[styles.insightDot, { backgroundColor: color }]} />
        <Text style={styles.insightTitle}>{title}</Text>
      </View>
      <View style={styles.insightValueRow}>
        <Text style={styles.insightValue}>{value.toLocaleString('ar-EG')}{suffix ? <Text style={styles.insightSuffix}> {suffix}</Text> : null}</Text>
        <View style={[styles.deltaChip, { backgroundColor: delta.up ? C.successLight : C.dangerLight }]}>
          <Text style={[styles.deltaText, { color: delta.up ? C.accentDark : C.danger }]}>
            {delta.up ? '▲' : '▼'} {delta.pct}%
          </Text>
        </View>
      </View>
      <TrendChart data={data} color={color} height={54} showLabels={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  axisText: { fontSize: 9.5, color: C.subtle, fontWeight: '700' },

  barsRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  barCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: '100%', height: 74, borderRadius: 8, backgroundColor: C.borderLight, overflow: 'hidden', justifyContent: 'flex-end' },
  barFill: { width: '100%', borderRadius: 8 },
  barValue: { fontSize: 11, fontWeight: '900', color: C.ink },
  barLabel: { fontSize: 9, color: C.subtle, fontWeight: '700', textAlign: 'center' },

  insightCard: {
    backgroundColor: C.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 12,
    gap: 8,
    marginBottom: 10,
  },
  insightHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  insightDot: { width: 8, height: 8, borderRadius: 4 },
  insightTitle: { fontSize: 12, fontWeight: '800', color: C.inkMuted, textAlign: 'right' },
  insightValueRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  insightValue: { fontSize: 22, fontWeight: '900', color: C.ink },
  insightSuffix: { fontSize: 11, color: C.muted, fontWeight: '700' },
  deltaChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  deltaText: { fontSize: 10, fontWeight: '900' },
});
