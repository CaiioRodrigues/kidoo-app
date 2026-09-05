import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, Text } from '@/components/ui';
import { formatCode, isTicketValid, minutesLeft } from '@/lib/check-in';
import { fontFamily, radius, spacing, useStyles, useTheme, type ThemeColors } from '@/theme';
import type { CheckInTicket } from '@/types/domain';

/**
 * Comprovante que o responsável mostra ao parceiro.
 *
 * O QR é o caminho rápido; o número existe porque câmera falha — sala escura,
 * tela riscada, celular sem permissão. Um código de 6 dígitos se dita em voz
 * alta em dois segundos.
 */
export function CheckInTicketCard({ ticket }: { ticket: CheckInTicket }) {
  const { colors } = useTheme();
  const styles = useStyles(makeStyles);
  const [now, setNow] = useState(() => new Date());

  // Atualiza o contador a cada 30s: o suficiente para o minuto exibido não
  // ficar mentindo, sem acordar a tela o tempo todo.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const valid = isTicketValid(ticket, now);
  const remaining = minutesLeft(ticket, now);

  return (
    <Card bordered elevation="none" style={styles.card}>
      <Text variant="label" color={colors.textMuted} center>
        Mostre para o parceiro confirmar a presença
      </Text>

      <View style={[styles.qrFrame, !valid && styles.qrExpired]}>
        {valid ? (
          <QRCode value={ticket.qrPayload} size={168} backgroundColor="#FFFFFF" color="#1E1E2F" />
        ) : (
          <View style={styles.expiredBox}>
            <Ionicons name="time-outline" size={30} color={colors.textFaint} />
            <Text variant="caption" color={colors.textFaint} center>
              Código expirado
            </Text>
          </View>
        )}
      </View>

      <View style={styles.codeBlock}>
        <Text variant="caption" color={colors.textMuted}>
          ou informe o código
        </Text>
        <Text
          style={[styles.code, { color: valid ? colors.text : colors.textFaint }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          // O código já é grande de propósito. Deixá-lo seguir a fonte do
          // sistema até 1,4x estourava a largura do cartão.
          maxFontSizeMultiplier={1.1}
        >
          {formatCode(ticket.code)}
        </Text>
      </View>

      <View style={styles.expiry}>
        <Ionicons
          name={valid ? 'time-outline' : 'alert-circle-outline'}
          size={14}
          color={valid ? colors.textFaint : colors.danger}
        />
        <Text variant="caption" color={valid ? colors.textFaint : colors.danger}>
          {valid
            ? remaining <= 1
              ? 'Vale por menos de 1 minuto'
              : `Vale por mais ${remaining} minutos`
            : 'Toque em fazer check-in de novo para gerar um código novo'}
        </Text>
      </View>
    </Card>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: { alignItems: 'center', gap: spacing.base },
    qrFrame: {
      // Fundo branco fixo: leitor de QR precisa de contraste real, e no tema
      // escuro um QR sobre fundo escuro simplesmente não é lido.
      backgroundColor: '#FFFFFF',
      padding: spacing.base,
      borderRadius: radius.lg,
    },
    qrExpired: { opacity: 0.4 },
    expiredBox: {
      width: 168,
      height: 168,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    codeBlock: { alignSelf: 'stretch', alignItems: 'center', gap: spacing.xxs },
    code: {
      fontFamily: fontFamily.extrabold,
      fontSize: 34,
      // lineHeight explícito: sem ele o Android corta o topo e a base de fonte
      // grande e customizada.
      lineHeight: 46,
      letterSpacing: 4,
      textAlign: 'center',
      alignSelf: 'stretch',
      paddingHorizontal: spacing.sm,
      color: colors.text,
    },
    expiry: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  });
