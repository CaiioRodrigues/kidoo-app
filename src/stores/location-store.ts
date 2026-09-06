import * as Location from 'expo-location';
import { create } from 'zustand';

import { DEFAULT_RADIUS_KM, type Coords, type RadiusKm } from '@/lib/geo';

export type LocationStatus =
  /** Ainda não perguntamos nada ao sistema. */
  | 'idle'
  /** Prompt aberto ou leitura em andamento. */
  | 'asking'
  | 'granted'
  | 'denied'
  /** Sem GPS, serviço desligado, ou a leitura falhou. */
  | 'unavailable';

type LocationState = {
  status: LocationStatus;
  coords: Coords | null;
  nearbyOnly: boolean;
  radiusKm: RadiusKm;
  /** Lê a permissão já concedida, sem abrir prompt. */
  hydrate: () => Promise<void>;
  /** Abre o prompt. Só a partir de um gesto explícito do usuário. */
  request: () => Promise<boolean>;
  setNearbyOnly: (value: boolean) => void;
  setRadiusKm: (value: RadiusKm) => void;
};

/**
 * Arredonda para ~110 m antes de guardar.
 *
 * Ninguém precisa saber a casa da família para dizer "2,3 km daqui". Cortar a
 * precisão na entrada é a forma mais barata de não ter o dado preciso em lugar
 * nenhum — e ainda estabiliza a chave de cache, que senão mudaria a cada tremida
 * do GPS.
 */
function coarse(coords: Coords): Coords {
  return {
    latitude: Math.round(coords.latitude * 1000) / 1000,
    longitude: Math.round(coords.longitude * 1000) / 1000,
  };
}

/**
 * Teto para a leitura do GPS. Dentro de ginásio ou piscina coberta o sinal
 * não vem e a chamada fica pendente sem erro.
 */
const READ_TIMEOUT_MS = 8000;

/**
 * Teto para o prompt de permissão.
 *
 * Nem sistema nem navegador respondem enquanto o diálogo está aberto: quem
 * simplesmente ignora o alerta deixaria o app em "Localizando…" para sempre.
 * O limite é generoso de propósito — tem que caber alguém lendo o texto antes
 * de decidir.
 */
const PROMPT_TIMEOUT_MS = 20000;

/** `null` quando estourou o tempo, para separar "demorou" de "falhou". */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function read(): Promise<Coords | null> {
  try {
    // `Low` é bairro, não calçada — é tudo que a ordenação por distância pede.
    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
      READ_TIMEOUT_MS,
    );
    return position ? coarse(position.coords) : null;
  } catch {
    return null;
  }
}

/**
 * Onde o usuário está, para medir a distância até os parceiros.
 *
 * Três decisões que valem também quando houver backend:
 *
 * 1. **Só primeiro plano.** Nada de `ACCESS_BACKGROUND_LOCATION`: além de
 *    exigir declaração e revisão na Play Store, o app não tem motivo para
 *    saber onde a família está com a tela apagada.
 * 2. **Só em memória.** A coordenada nunca vai para disco nem para o
 *    armazenamento seguro, e não sai do aparelho fora da consulta ao catálogo.
 *    Fechou o app, acabou.
 * 3. **O prompt é do usuário.** `hydrate` apenas confere uma permissão que já
 *    existe; o prompt só aparece quando alguém toca em "Perto de mim".
 */
export const useLocationStore = create<LocationState>((set, get) => ({
  status: 'idle',
  coords: null,
  nearbyOnly: false,
  radiusKm: DEFAULT_RADIUS_KM,

  hydrate: async () => {
    if (get().status !== 'idle') return;
    try {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted) return;

      set({ status: 'asking' });
      const coords = await read();
      set(coords ? { status: 'granted', coords } : { status: 'unavailable', coords: null });
    } catch {
      set({ status: 'unavailable' });
    }
  },

  request: async () => {
    set({ status: 'asking' });
    try {
      const permission = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        PROMPT_TIMEOUT_MS,
      );

      // Diálogo ainda aberto quando o tempo acabou. Volta para `idle`, e não
      // para `denied`: ninguém negou nada, e um novo toque tenta de novo — se
      // a resposta tiver chegado nesse meio-tempo, ela já vale.
      if (permission === null) {
        set({ status: 'idle', coords: null });
        return false;
      }

      if (!permission.granted) {
        set({ status: 'denied', coords: null });
        return false;
      }

      const coords = await read();
      if (!coords) {
        set({ status: 'unavailable', coords: null });
        return false;
      }

      set({ status: 'granted', coords });
      return true;
    } catch {
      set({ status: 'unavailable', coords: null });
      return false;
    }
  },

  setNearbyOnly: (value) => set({ nearbyOnly: value }),
  setRadiusKm: (value) => set({ radiusKm: value }),
}));
