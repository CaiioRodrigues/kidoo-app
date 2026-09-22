import { useRouter } from 'expo-router';

import { Text } from '@/components/ui';
import { DOCUMENTOS, type DocumentoId } from '@shared/documentos';
import { useTheme } from '@/theme';

/**
 * "Termos de Uso" e "Política de Privacidade", clicáveis.
 *
 * `Text` aninhado com `onPress`, e não `Pressable`: estas palavras vivem no
 * meio de uma frase, e um Pressable ali quebraria a linha. O toque no texto
 * interno tem precedência sobre o Pressable de fora, que é o que permite a
 * caixa de aceite continuar sendo uma caixa de aceite.
 *
 * O rótulo vem do próprio documento. Se o título mudar lá, muda aqui — ninguém
 * precisa lembrar de dois lugares.
 */
export function LinkDoDocumento({
  id,
  color,
}: {
  id: DocumentoId;
  /** A cor do texto ao redor; o link entra em `primary` sobre ela. */
  color?: string;
}) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Text
      variant="caption"
      color={colors.primary}
      style={{ textDecorationLine: 'underline' }}
      accessibilityRole="link"
      onPress={() => router.push(`/documento/${id}`)}
      suppressHighlighting={color === undefined}
    >
      {DOCUMENTOS[id].titulo}
    </Text>
  );
}
