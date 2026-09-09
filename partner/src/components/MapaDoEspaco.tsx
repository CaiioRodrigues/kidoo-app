import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/**
 * Onde fica o espaço, escolhido no mapa.
 *
 * A primeira versão só lia o GPS do aparelho, e isso quebra justamente no caso
 * mais comum: o parceiro preenchendo o cadastro no computador da recepção. Num
 * desktop a leitura vem do Wi-Fi ou do IP e erra por centenas de metros — às
 * vezes de cidade. Como o portão do check-in é de 250 m, uma coordenada assim
 * faria toda família chegar no local e ouvir "você ainda não chegou".
 *
 * Então quem decide é ele, olhando: busca pelo CEP, confere no mapa e arrasta o
 * alfinete até a porta. O GPS continua ali, como atalho para quem estiver no
 * espaço na hora — que é quando ele é preciso.
 *
 * Sem chave de API: CEP pelo ViaCEP, endereço pelo Nominatim, telha do
 * OpenStreetMap. Nenhum dos três cobra nem exige cadastro.
 */

const CENTRO_BH: [number, number] = [-19.9227, -43.9451];

/** Alfinete desenhado, e não imagem: o ícone padrão do Leaflet quebra em
 *  empacotador, e uma imagem faltando aqui vira um mapa sem marcador. */
const ALFINETE = L.divIcon({
  className: '',
  html:
    '<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="M15 39C15 39 28 24.5 28 14.5A13 13 0 1 0 2 14.5C2 24.5 15 39 15 39Z" ' +
    'fill="#6D3AE8" stroke="#fff" stroke-width="2.5"/>' +
    '<circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>',
  iconSize: [30, 40],
  iconAnchor: [15, 39],
});

export type Endereco = {
  address: string;
  neighborhood: string;
  city: string;
};

export function MapaDoEspaco({
  latitude,
  longitude,
  aoMover,
  aoAcharEndereco,
}: {
  latitude: number;
  longitude: number;
  aoMover: (lat: number, lng: number) => void;
  /** O CEP também preenche rua, bairro e cidade — são os mesmos dados. */
  aoAcharEndereco: (e: Endereco) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const marca = useRef<L.Marker | null>(null);
  const mover = useRef(aoMover);
  mover.current = aoMover;
  /*
    De onde veio a coordenada nova.

    Quando ela vem do CEP ou do GPS, o mapa tem de ir até lá — senão o ponto
    muda fora da vista e ninguém confere nada. Quando vem do próprio toque, o
    mapa não pode se mexer: recentralizar e dar zoom debaixo do dedo faz o
    segundo toque cair em outro lugar, e ajustar a porta vira uma briga.
  */
  const veioDoMapa = useRef(false);

  const [cep, setCep] = useState('');
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const temPonto = latitude !== 0 || longitude !== 0;

  // Monta o mapa uma vez. Em React 19 com StrictMode o efeito roda duas vezes
  // em desenvolvimento, e sem o `remove()` na limpeza o Leaflet reclama que o
  // contêiner já está inicializado — e o mapa some.
  useEffect(() => {
    if (!caixa.current || mapa.current) return;

    const m = L.map(caixa.current, { attributionControl: true }).setView(
      temPonto ? [latitude, longitude] : CENTRO_BH,
      temPonto ? 17 : 12,
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(m);

    const pin = L.marker(temPonto ? [latitude, longitude] : CENTRO_BH, {
      draggable: true,
      icon: ALFINETE,
      keyboard: true,
      title: 'Arraste para ajustar, ou toque no mapa',
    }).addTo(m);

    pin.on('dragend', () => {
      const { lat, lng } = pin.getLatLng();
      veioDoMapa.current = true;
      mover.current(lat, lng);
    });
    // Tocar no mapa é o caminho principal, e não o arrasto: funciona igual no
    // celular e no computador, e é o gesto que sai naturalmente para "é ali".
    // Arrastar continua valendo para o ajuste fino de quem já acertou a rua.
    m.on('click', (e: L.LeafletMouseEvent) => {
      pin.setLatLng(e.latlng);
      veioDoMapa.current = true;
      mover.current(e.latlng.lat, e.latlng.lng);
    });

    mapa.current = m;
    marca.current = pin;

    return () => {
      m.remove();
      mapa.current = null;
      marca.current = null;
    };
    // Só na montagem: as mudanças de coordenada entram pelo efeito abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Coordenada vinda de fora (GPS, busca por endereço): leva o mapa junto.
  useEffect(() => {
    if (!mapa.current || !marca.current || !temPonto) return;
    marca.current.setLatLng([latitude, longitude]);
    if (veioDoMapa.current) {
      veioDoMapa.current = false;
      return;
    }
    mapa.current.setView([latitude, longitude], Math.max(mapa.current.getZoom(), 17));
  }, [latitude, longitude, temPonto]);

  const buscarPeloCep = async () => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) {
      setAviso('O CEP tem 8 números.');
      return;
    }
    setBuscando(true);
    setAviso(null);
    try {
      const resp = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const dados = (await resp.json()) as {
        erro?: boolean | string;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      };
      if (dados.erro || !dados.localidade) {
        setAviso('CEP não encontrado. Escolha o ponto direto no mapa.');
        return;
      }

      aoAcharEndereco({
        address: dados.logradouro ?? '',
        neighborhood: dados.bairro ?? '',
        city: dados.localidade,
      });

      // O CEP dá o endereço, não a coordenada — quem converte é o Nominatim.
      // Falhar aqui não é problema: o alfinete continua arrastável.
      const busca = [dados.logradouro, dados.bairro, dados.localidade, dados.uf, 'Brasil']
        .filter(Boolean)
        .join(', ');
      const geo = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(busca)}`,
      );
      const achados = (await geo.json()) as { lat: string; lon: string }[];
      const primeiro = achados[0];
      if (primeiro) {
        mover.current(Number(primeiro.lat), Number(primeiro.lon));
        setAviso('Confira o alfinete e arraste até a porta do espaço.');
      } else {
        setAviso('Achei o endereço, mas não o ponto. Arraste o alfinete até o lugar certo.');
      }
    } catch {
      setAviso('Não consegui consultar o CEP agora. Escolha o ponto direto no mapa.');
    } finally {
      setBuscando(false);
    }
  };

  const usarMinhaLocalizacao = () => {
    if (!navigator.geolocation) {
      setAviso('Este navegador não sabe informar a localização.');
      return;
    }
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => mover.current(pos.coords.latitude, pos.coords.longitude),
      () => setAviso('Não consegui ler a localização. Escolha o ponto no mapa.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div>
      <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <div className="field" style={{ width: 150 }}>
          <label htmlFor="cep">CEP</label>
          <input
            id="cep"
            className="input mono"
            inputMode="numeric"
            maxLength={9}
            placeholder="30000-000"
            value={cep}
            onChange={(e) => setCep(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void buscarPeloCep();
              }
            }}
          />
        </div>
        <button type="button" className="btn btn-secundario" disabled={buscando}
                style={{ alignSelf: 'flex-end' }} onClick={() => void buscarPeloCep()}>
          {buscando ? 'Buscando…' : 'Buscar endereço'}
        </button>
        <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-end' }}
                onClick={usarMinhaLocalizacao}>
          Estou no espaço agora
        </button>
      </div>

      <div ref={caixa} className="mapa" role="application"
           aria-label="Mapa para escolher onde fica o espaço" />

      <div className="row" style={{ gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        {temPonto ? (
          <span className="badge badge-ok mono">
            {latitude.toFixed(5)}, {longitude.toFixed(5)}
          </span>
        ) : (
          <span className="faint">Toque no mapa para marcar onde fica o seu espaço.</span>
        )}
        {aviso && <span className="faint">{aviso}</span>}
      </div>
    </div>
  );
}
