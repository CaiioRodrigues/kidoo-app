import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

export function Divider({ label }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  if (!label) return <View style={styles.line} />;

  return (
    <View style={styles.row}>
      <View style={styles.flexLine} />
      <Text variant="caption" color={colors.textFaint}>
        {label}
      </Text>
      <View style={styles.flexLine} />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    line: { height: 1, backgroundColor: colors.border, alignSelf: 'stretch' },
    flexLine: { flex: 1, height: 1, backgroundColor: colors.border },
    row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  });
