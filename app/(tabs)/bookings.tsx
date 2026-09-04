import { ComingSoon, Screen } from '@/components/ui';

/** Tela 8 — Reservas (implementação na próxima fase). */
export default function BookingsScreen() {
  return (
    <Screen>
      <ComingSoon
        icon="calendar-outline"
        title="Reservas"
        description="Aqui vão aparecer as reservas confirmadas, o check-in do dia e o histórico das aulas do seu pequeno."
      />
    </Screen>
  );
}
