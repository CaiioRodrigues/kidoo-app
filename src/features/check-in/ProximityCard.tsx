import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { formatGap, type CheckInWindow, type Proximity } from '@/lib/check-in';
import { blobRadius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';

type Props = {
  proximity: Proximity;
  window: CheckInWindow;
  partnerName: string;
  /** Verdadeiro enquanto o aparelho está sendo consultado. */
  busy: boolean;
  /** Pede a permissão. Só aparece quando ainda não temos localização. */
  onEnable: () => void;
  /** Relê a posição. Aparece quando já temos, mas a pessoa ainda está longe. */
  onRefresh: () => void;
};

const hhmm = (date: Date) =>
  date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/**
 * Onde a pessoa está em relação ao local, antes do check-in.
 *
 * O cartão nunca "acusa": quando não dá para confirmar a localização ele diz
 * isso e libera mesmo assim, porque a presença de verdade quem confirma é o
 * parceiro lendo o código. Travar aqui puniria a quadra coberta sem sinal.
 */
export function ProximityCard({
  proximity,
  window,
  partnerName,
  busy,
  onEnable,
  onRefresh,
}: Props) {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);

  const state = resolve();

  return (
    <View style={[styles.card, { backgroundColor: state.background }]}>
      <View style={styles.iconWrapper}>
        {busy ? (
          <ActivityIndicator size="small" color={state.tint} />
        ) : (
          <Ionicons name={state.icon} size={20} color={state.tint} />
        )}
      </View>

      <View style={styles.body}>
        <Text variant="label" color={colors.text}>
          {state.title}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {state.detail}
        </Text>
      </View>

      {state.action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={state.action.label}
          onPress={state.action.onPress}
          disabled={busy}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text variant="caption" color={colors.primary}>
            {state.action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );

  function resolve(): {
    icon: keyof typeof Ionicons.glyphMap;
    tint: string;
    background: string;
    title: string;
    detail: string;
    action: { label: string; onPress: () => void } | null;
  } {
    // A janela de horário vem primeiro: estar no local não adianta três horas
    // antes da aula.
    if (!window.open) {
      return {
        icon: 'time-outline',
        tint: colors.textMuted,
        background: colors.backgroundMuted,
        title: window.reason === 'early' ? 'Ainda não abriu' : 'Janela encerrada',
        detail:
          window.reason === 'early'
            ? `O check-in abre às ${hhmm(window.opensAt)}.`
            : `O check-in desta aula fechou às ${hhmm(window.closesAt)}.`,
        action: null,
      };
    }

    if (proximity.kind === 'arrived') {
      return {
        icon: 'location',
        tint: colors.success,
        background: palette.tealSoft,
        title: `Você chegou em ${partnerName}`,
        detail: 'Pode fazer o check-in.',
        action: null,
      };
    }

    if (proximity.kind === 'far') {
      return {
        icon: 'walk-outline',
        tint: colors.textMuted,
        background: colors.backgroundMuted,
        title: `A ${formatGap(proximity.distanceM)} de ${partnerName}`,
        detail: 'O check-in abre quando você chegar no local.',
        action: { label: 'Atualizar', onPress: onRefresh },
      };
    }

    return {
      icon: 'navigate-outline',
      tint: colors.textMuted,
      background: colors.backgroundMuted,
      title: 'Localização não confirmada',
      detail: 'Você pode seguir: é a leitura do código pelo parceiro que confirma a presença.',
      action: { label: 'Ativar', onPress: onEnable },
    };
  }
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.base,
      ...blobRadius.tile,
    },
    iconWrapper: {
      width: 34,
      height: 34,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 17,
      backgroundColor: colors.background,
    },
    body: { flex: 1, gap: spacing.xxs },
    action: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
    pressed: { opacity: 0.6 },
  });
