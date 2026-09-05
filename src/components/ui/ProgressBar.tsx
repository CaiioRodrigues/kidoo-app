import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';

export function ProgressBar({
  value,
  max = 100,
  color,
  track,
  height = 10,
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  track?: string;
  height?: number;
  label?: string;
}) {
  const { colors } = useTheme();
  const fill = color ?? colors.primary;
  const trackColor = track ?? colors.border;
  const ratio = max <= 0 ? 0 : Math.min(Math.max(value / max, 0), 1);

  return (
    <View
      style={[styles.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max, now: value }}
    >
      <View
        style={[
          styles.fill,
          { backgroundColor: fill, width: `${ratio * 100}%`, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', borderRadius: radius.pill },
  fill: { height: '100%' },
});
