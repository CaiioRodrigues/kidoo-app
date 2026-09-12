import { ConquistaNova } from './ConquistaNova';
import { useConquistasNovas } from '@/hooks/conquistas';
import { useChildren, useJourney } from '@/hooks/queries';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { useTutorialStore } from '@/stores/tutorial-store';

/**
 * Vigia a jornada da criança ativa e comemora o que destravar.
 *
 * Mora nas abas, e não dentro da tela Jornada, porque a conquista não chega
 * quando a família abre aquela aba: chega quando o parceiro confirma a aula, do
 * outro lado do balcão. Pendurada na Jornada, a comemoração esperaria uma
 * visita que pode demorar dias — ou nunca acontecer.
 */
export function AvisoDeConquista() {
  const activeChildId = useOnboardingStore((state) => state.activeChildId);
  const { data: children = [] } = useChildren();
  const child = children.find((item) => item.id === activeChildId) ?? children[0] ?? null;

  const { data: journey } = useJourney(child?.id ?? null);
  const { atual, proxima } = useConquistasNovas(child?.id ?? null, journey?.achievements);

  // Duas festas ao mesmo tempo não são duas festas. O tutorial de boas-vindas
  // é modal também, e quem acabou de instalar veria as duas sobrepostas.
  //
  // `'checking'` também segura: a preferência ainda está sendo lida, e soltar a
  // comemoração agora é apostar que o tutorial não vem — se vier, ele aparece
  // por cima do que já estava na tela.
  const tutorial = useTutorialStore((state) => state.status);

  if (!atual || !child || !journey || tutorial !== 'hidden') return null;

  const desbloqueadas = journey.achievements.filter((c) => c.unlockedAt !== null).length;

  return (
    <ConquistaNova
      conquista={atual}
      nomeDaCrianca={child.name.split(' ')[0] ?? child.name}
      desbloqueadas={desbloqueadas}
      total={journey.achievements.length}
      onClose={proxima}
    />
  );
}
