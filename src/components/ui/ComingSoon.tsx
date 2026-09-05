import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

/** Placeholder das telas ainda não implementadas desta fase. */
export function ComingSoon({
  icon,
  title,
  description,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.container}>
      <View style={styles.iconWrapper}>
        <Ionicons name={icon} size={34} color={colors.primary} />
      </View>
      <Text variant="heading" center>
        {title}
      </Text>
      <Text variant="body" color={colors.textMuted} center>
        {description}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
    },
    iconWrapper: {
      width: 82,
      height: 82,
      borderRadius: radius.xxl,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryTint,
      marginBottom: spacing.xs,
    },
  });
