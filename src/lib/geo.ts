/**
 * Distância entre dois pontos.
 *
 * O catálogo guardava `distanceKm` como número fixo por atividade — o que só
 * funciona enquanto o app é um mock e todo mundo mora no mesmo lugar. Distância
 * é uma relação entre o parceiro e *quem está olhando*, então ela é derivada:
 * o parceiro guarda a coordenada, o usuário fornece a dele, e o valor sai daqui.
 *
 * O cálculo vive no servidor (aqui, no mock) e não na tela. No backend real
 * isso vira um filtro por bounding box no banco antes do haversine — a tela
 * continua só recebendo o número pronto.
 */

export type Coords = {
  latitude: number;
  longitude: number;
};

const EARTH_RADIUS_KM = 6371;

const toRad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Distância em linha reta, em quilômetros.
 *
 * Haversine assume a Terra esférica. O erro contra o elipsoide fica abaixo de
 * 0,5% — irrelevante para "2,3 km daqui", e muito mais barato que Vincenty.
 */
export function haversineKm(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Raios oferecidos no filtro "Perto de mim". */
export const RADIUS_OPTIONS_KM = [2, 5, 10] as const;

export type RadiusKm = (typeof RADIUS_OPTIONS_KM)[number];

export const DEFAULT_RADIUS_KM: RadiusKm = 5;
