import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

/** Traços decorativos da identidade (os "raios" acima do logo). */
export function Sparkles({ style }: { style?: object }) {
  const { palette } = useTheme();
  return (
    <View style={[styles.row, style]} pointerEvents="none">
      <View style={[styles.dash, styles.left, { backgroundColor: palette.yellow }]} />
      <View style={[styles.dash, { backgroundColor: palette.teal }]} />
      <View style={[styles.dash, styles.right, { backgroundColor: palette.purple }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 18 },
  dash: { width: 4, height: 16, borderRadius: 2 },
  left: { transform: [{ rotate: '-20deg' }] },
  right: { transform: [{ rotate: '20deg' }] },
});
