import * as Location from 'expo-location';
import { create } from 'zustand';

import { DEFAULT_RADIUS_KM, type Coords, type RadiusKm } from '@/lib/geo';
import type { LocationProof } from '@/lib/check-in';

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
  /** Leitura crua mais recente. A distância nunca é calculada aqui. */
  proof: LocationProof | null;
  nearbyOnly: boolean;
  radiusKm: RadiusKm;
  /** Lê a permissão já concedida, sem abrir prompt. */
  hydrate: () => Promise<void>;
  /** Abre o prompt. Só a partir de um gesto explícito do usuário. */
  request: () => Promise<boolean>;
  /** Relê a posição se a permissão já existe. Nunca abre prompt. */
  refresh: () => Promise<void>;
  /**
   * Garante uma leitura para o check-in: relê se já pode, e **pergunta** se
   * ainda não perguntou.
   */
  ensure: () => Promise<void>;
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
 * Erro que o próprio arredondamento introduz.
 *
 * Cortar a terceira casa decimal desloca o ponto em até ~80 m. Somar isso à
 * precisão declarada mantém a conta honesta: o raio do check-in passa a
 * considerar tanto o erro do GPS quanto o que nós mesmos jogamos fora.
 */
const COARSE_ERROR_M = 80;

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

async function read(): Promise<LocationProof | null> {
  try {
    // `Low` é bairro, não calçada — é tudo que a ordenação por distância pede,
    // e o raio de check-in (250 m) absorve com folga.
    const position = await withTimeout(
      // `Balanced` (~100 m) e não `Low` (antena de celular, quilômetros).
      // O portão do check-in é de 250 m e a regra desconta a margem de erro a
      // favor de quem chega: com precisão de 3 km, qualquer um num raio de
      // 3 km "chegaria", e a checagem de proximidade não checaria nada.
      //
      // Não usamos `High` (GPS puro): ele custa bateria e demora mais para
      // responder, e 100 m já decide um raio de 250 m com folga.
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      READ_TIMEOUT_MS,
    );
    if (!position) return null;

    return {
      origin: coarse(position.coords),
      accuracyM: (position.coords.accuracy ?? 0) + COARSE_ERROR_M,
      // Android avisa quando há app de mock location no comando.
      mocked: position.mocked ?? false,
    };
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
  proof: null,
  nearbyOnly: false,
  radiusKm: DEFAULT_RADIUS_KM,

  hydrate: async () => {
    if (get().status !== 'idle') return;
    try {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted) return;

      set({ status: 'asking' });
      const proof = await read();
      set(proof ? { status: 'granted', proof } : { status: 'unavailable', proof: null });
    } catch {
      set({ status: 'unavailable' });
    }
  },

  refresh: async () => {
    try {
      const { granted } = await Location.getForegroundPermissionsAsync();
      if (!granted) return;
      const proof = await read();
      if (proof) set({ status: 'granted', proof });
    } catch {
      // Uma releitura que falha não derruba o que já sabíamos.
    }
  },

  /**
   * O prompt na hora do check-in.
   *
   * `hydrate` e `refresh` só leem uma permissão que já existe — nenhum dos dois
   * pergunta nada. O resultado era que o app nunca pedia localização no caminho
   * do check-in: mostrava "Ativar" ao lado de um botão de check-in liberado, e
   * ninguém tocava. Nos cinco primeiros check-ins reais, cinco vieram sem
   * coordenada, e o portão de 250 m não checou nada.
   *
   * Perguntar aqui é diferente de perguntar na Home: a pessoa acabou de chegar
   * no local, e o motivo de o app querer saber onde ela está é evidente. É a
   * diferença entre uma permissão concedida e uma negada por reflexo.
   *
   * Não insiste: quem já negou de vez (`canAskAgain` falso) não é perguntado de
   * novo, e o check-in segue sem verificação, como sempre seguiu.
   */
  ensure: async () => {
    try {
      const { granted, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (granted) {
        const proof = await read();
        if (proof) set({ status: 'granted', proof });
        return;
      }
      // `denied` nesta sessão já foi uma recusa nossa: não vira um segundo
      // diálogo na mesma visita à tela.
      if (!canAskAgain || get().status === 'denied') return;
      await get().request();
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
        set({ status: 'idle', proof: null });
        return false;
      }

      if (!permission.granted) {
        set({ status: 'denied', proof: null });
        return false;
      }

      const proof = await read();
      if (!proof) {
        set({ status: 'unavailable', proof: null });
        return false;
      }

      set({ status: 'granted', proof });
      return true;
    } catch {
      set({ status: 'unavailable', proof: null });
      return false;
    }
  },

  setNearbyOnly: (value) => set({ nearbyOnly: value }),
  setRadiusKm: (value) => set({ radiusKm: value }),
}));
