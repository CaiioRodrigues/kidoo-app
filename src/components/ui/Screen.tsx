import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Rola o conteúdo. Use `false` em telas com lista própria (FlatList). */
  scroll?: boolean;
  background?: string;
  edges?: readonly Edge[];
  padded?: boolean;
  style?: ViewStyle;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export function Screen({
  children,
  scroll = false,
  background = colors.background,
  edges = ['top', 'bottom'],
  padded = true,
  style,
  contentContainerStyle,
}: Props) {
  const padding = padded ? styles.padded : undefined;

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: background }, style]}>
      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[padding, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, padding]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: spacing.xl },
});
