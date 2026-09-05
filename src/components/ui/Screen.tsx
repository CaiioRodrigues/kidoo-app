import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { type Edge, SafeAreaView } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

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
  background,
  edges = ['top', 'bottom'],
  padded = true,
  style,
  contentContainerStyle,
}: Props) {
  const { colors } = useTheme();
  // O padrão depende do tema, então resolve aqui e não na assinatura.
  const surface = background ?? colors.background;
  const padding = padded ? styles.padded : undefined;

  return (
    <SafeAreaView edges={edges} style={[styles.flex, { backgroundColor: surface }, style]}>
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
