import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Button, Card, Text } from '@/components/ui';
import { backendName } from '@/services';
import { spacing, useStyles, useTheme, type ThemeColors, type ThemePalette } from '@/theme';
import type { SubscriptionState } from '@/types/domain';

/**
 * O aviso de que a assinatura ainda não vale.
 *
 * Existe porque escolher o plano deixou de ser ter o plano, e a diferença
 * precisa aparecer antes da primeira tentativa de reservar. Descobrir na hora
 * da reserva — que era o que aconteceria sem isto — é descobrir tarde: a
 * família já escolheu a turma e o horário, e leva a recusa como defeito.
 *
 * Devolve `null` para quem está em dia: a tela de quem paga não deve carregar
 * um cartão sobre pagamento.
 */
export function EstadoDaAssinatura({
  subscription,
  style,
  aoSimular,
  simulando = false,
}: {
  subscription: SubscriptionState;
  /**
   * Confirma o pagamento na demonstração.
   *
   * Só aparece com o backend em memória, e diz na etiqueta que é simulação. Não
   * é porta dos fundos: no Supabase a mesma operação passa por
   * `set_subscription_status`, que exige `is_kidoo_admin()` — uma família que a
   * chamasse receberia `not_admin`.
   *
   * Existe porque sem ela a demonstração fica inutilizável: todo mundo que
   * escolhe um plano trava em `aguardando`, e não há painel de administração no
   * app para destravar.
   */
  aoSimular?: () => void;
  simulando?: boolean;
  /**
   * A Home roda sem padding lateral — cada bloco põe o seu. Sem isto o cartão
   * sangra até a borda da tela, sozinho entre vizinhos recuados.
   */
  style?: ViewStyle;
}) {
  const { colors, palette } = useTheme();
  const styles = useStyles(makeStyles);

  if (subscription.status === 'ativa') return null;

  const aguardando = subscription.status === 'aguardando';

  return (
    <Card background={palette.yellowSoft} elevation="none" style={[styles.cartao, style]}>
      <Ionicons
        name={aguardando ? 'time-outline' : 'alert-circle-outline'}
        size={22}
        color={colors.warning}
      />
      <View style={styles.texto}>
        <Text variant="bodyStrong">
          {aguardando ? 'Assinatura aguardando confirmação' : 'Assinatura vencida'}
        </Text>
        <Text variant="caption" color={colors.textMuted}>
          {aguardando
            ? 'Você escolheu o plano e estamos confirmando o pagamento. Assim que ele entrar, os ' +
              'coins liberam e dá para reservar.'
            : 'O período do seu plano terminou. Renove para voltar a reservar aulas.'}
        </Text>
        {backendName === 'mock' && aoSimular ? (
          <Button
            title="Simular confirmação do pagamento"
            variant="secondary"
            size="sm"
            fullWidth={false}
            loading={simulando}
            onPress={aoSimular}
          />
        ) : null}
      </View>
    </Card>
  );
}

const makeStyles = (_colors: ThemeColors, _palette: ThemePalette) =>
  StyleSheet.create({
    cartao: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    texto: { flex: 1, gap: spacing.xxs },
  });
