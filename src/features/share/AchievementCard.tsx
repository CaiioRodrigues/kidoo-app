import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { KidooLogo } from '@/components/brand';
import { Avatar, Text } from '@/components/ui';
import { fontFamily, radius, spacing, useStyles, type ThemeColors } from '@/theme';
import type { BookingDetails } from '@/types/domain';

export type AchievementShare = {
  booking: BookingDetails;
  xpEarned: number;
  levelUp: { to: number; bonusEarned: number } | null;
  levelName: string;
};

/**
 * Cartão renderizado fora da tela e capturado como imagem para compartilhar.
 *
 * Cores fixas de propósito: a imagem sai do app e vai para o WhatsApp, o
 * story, o grupo da família. Ela precisa ser sempre a mesma, e não herdar o
 * tema escuro de quem compartilhou.
 */
export const AchievementCard = forwardRef<View, { data: AchievementShare }>(
  function AchievementCard({ data }, ref) {
    const styles = useStyles(makeStyles);
    const { booking, xpEarned, levelUp, levelName } = data;
    const firstName = booking.child.name.split(' ')[0] ?? booking.child.name;

    return (
      <View ref={ref} collapsable={false} style={styles.card}>
        <View style={styles.header}>
          <KidooLogo size={26} onDark />
        </View>

        <Avatar name={booking.child.name} uri={booking.child.photoUri} size={92} ring />

        <Text style={styles.title}>
          {levelUp ? `${firstName} subiu de nível!` : `${firstName} mandou bem!`}
        </Text>

        <View style={styles.activityPill}>
          <Text style={styles.activityText} numberOfLines={1}>
            {booking.activity.title}
          </Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>+{xpEarned}</Text>
            <Text style={styles.statLabel}>XP</Text>
          </View>

          {levelUp ? (
            <>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{levelUp.to}</Text>
                <Text style={styles.statLabel}>nível</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>+{levelUp.bonusEarned}</Text>
                <Text style={styles.statLabel}>bônus</Text>
              </View>
            </>
          ) : null}
        </View>

        <Text style={styles.tier}>{levelName}</Text>
        <Text style={styles.tagline}>DESCUBRA. BRINQUE. MOVIMENTE-SE.</Text>
      </View>
    );
  },
);

// A imagem não segue o tema: precisa ser a mesma para todo mundo que a receber.
const SHARE_PURPLE = '#6A3FC6';
const SHARE_DEEP = '#2A1B4A';
const SHARE_YELLOW = '#FFC839';

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      width: 340,
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.xxl,
      paddingHorizontal: spacing.xl,
      backgroundColor: SHARE_PURPLE,
      borderRadius: radius.xxl,
    },
    header: { marginBottom: spacing.sm },
    title: {
      fontFamily: fontFamily.extrabold,
      fontSize: 24,
      lineHeight: 30,
      color: '#FFFFFF',
      textAlign: 'center',
    },
    activityPill: {
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: 'rgba(255,255,255,0.16)',
      maxWidth: '100%',
    },
    activityText: {
      fontFamily: fontFamily.semibold,
      fontSize: 14,
      color: '#FFFFFF',
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.base,
      marginTop: spacing.sm,
      paddingVertical: spacing.base,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.xl,
      backgroundColor: SHARE_DEEP,
    },
    stat: { alignItems: 'center', minWidth: 54 },
    statValue: { fontFamily: fontFamily.extrabold, fontSize: 22, color: SHARE_YELLOW },
    statLabel: { fontFamily: fontFamily.medium, fontSize: 11, color: 'rgba(255,255,255,0.75)' },
    divider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
    tier: { fontFamily: fontFamily.bold, fontSize: 15, color: '#FFFFFF' },
    tagline: {
      fontFamily: fontFamily.bold,
      fontSize: 9,
      letterSpacing: 1.6,
      color: 'rgba(255,255,255,0.6)',
    },
  });
