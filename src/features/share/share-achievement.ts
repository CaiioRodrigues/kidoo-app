import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import type { RefObject } from 'react';
import type { View } from 'react-native';

import { logger } from '@/lib/logger';
import { buildShareMessage } from '@/lib/share-message';
import type { AchievementShare } from './AchievementCard';

/**
 * Compartilha a conquista com imagem quando o aparelho permite, e cai para
 * texto puro quando não permite — melhor compartilhar algo do que falhar.
 */
export async function shareAchievement(
  cardRef: RefObject<View | null>,
  data: AchievementShare,
): Promise<void> {
  const message = buildShareMessage(data);

  try {
    const canShareFiles = await Sharing.isAvailableAsync();
    if (canShareFiles && cardRef.current) {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Compartilhar conquista',
        UTI: 'public.png',
      });
      return;
    }
  } catch (error) {
    logger.warn('Falha ao compartilhar imagem, caindo para texto', error);
  }

  try {
    await Share.share({ message });
  } catch (error) {
    logger.warn('Compartilhamento cancelado ou indisponível', error);
  }
}
