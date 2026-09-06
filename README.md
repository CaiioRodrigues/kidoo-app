# Kidoo

App mobile (Android + iOS) para famílias descobrirem, reservarem e acompanharem
atividades esportivas e culturais infantis.

Construído com **Expo SDK 57 / React Native 0.86 / React 19** e **expo-router**.

---

## Como ver o app

### 1. Expo Go — mais rápido, sem build (~2 min)

No computador:

```bash
npm install
npx expo start
```

No celular, instale o **Expo Go** (Play Store / App Store) e leia o QR code que
aparece no terminal. Celular e computador precisam estar na mesma rede Wi-Fi;
se a rede bloquear, use `npx expo start --tunnel`.

Todos os módulos nativos usados aqui (secure-store, image, haptics,
image-picker, reanimated, gesture-handler, svg) fazem parte do runtime do
Expo Go, então o app roda completo, com hot reload.

### 2. APK instalável — via EAS Build (nuvem, ~15 min)

Não exige Android SDK na sua máquina. O perfil `preview` já está configurado
em `eas.json` para gerar **APK** (e não AAB):

```bash
npm install -g eas-cli
eas login                              # conta Expo gratuita
eas build --platform android --profile preview
```

Ao final o EAS devolve um link de download do `.apk`, que você instala
direto no aparelho.

### 3. Build local — exige Android Studio

Com o Android SDK e JDK 17+ instalados:

```bash
npx expo run:android --variant release
```

O APK sai em `android/app/build/outputs/apk/release/`.

---

## Como rodar

```bash
npm install
npm start          # abre o Metro; leia o QR code no app Expo Go
npm run android    # abre direto no emulador/dispositivo Android
npm run ios        # abre direto no simulador iOS (requer macOS)
```

Verificações:

```bash
npm run typecheck  # tsc --noEmit (strict)
npm run lint       # eslint, zero warnings tolerados
npm run format     # prettier
```

Para gerar binários, use EAS Build (`eas build -p android|ios`). As pastas
`android/` e `ios/` não são versionadas: são reconstruídas com
`npm run prebuild` a partir do `app.json`.

---

## Identidade do app

O ícone usa a assinatura da marca: os dois "o" sorridentes sobre o roxo Kidoo.
O wordmark inteiro fica ilegível num ícone de 48px; os dois rostinhos
continuam reconhecíveis e amigáveis em tamanho pequeno.

Os arquivos em `assets/` são gerados a partir da mesma geometria, com respiro
calculado para cada destino: 70% de largura no ícone do iOS (que arredonda os
cantos) e 62% no foreground adaptativo do Android (que pode recortar em
círculo ou squircle). O monocromático usa silhueta sólida com o sorriso
vazado, porque o Android tematiza pelo canal alfa.

## Versionamento

`app.json` guarda os três números que precisam andar juntos: `version`
(1.0.0), `android.versionCode` e `ios.buildNumber`.

```bash
npm run version:patch   # 1.0.0 -> 1.0.1, versionCode 1 -> 2
npm run version:minor
npm run version:major
```

O erro fácil é subir a versão e esquecer o `versionCode`: as lojas recusam um
envio cujo número de build não cresceu. O script move os três de uma vez.

O APK sai com a versão no nome, via o config plugin
`plugins/with-versioned-apk.js`:

```
kidoo-1.0.0-1-release.apk
```

Sem isso o Gradle gera sempre `app-release.apk`, e dois builds de versões
diferentes ficam indistinguíveis no disco. Vale para build local; no EAS Build
o artefato é nomeado pelo serviço, e a rastreabilidade vem do `versionCode`,
que o perfil de produção já incrementa sozinho.

## Arquitetura

```
app/                      rotas (expo-router, file-based)
  _layout.tsx             providers, fontes, splash, guarda de sessão
  index.tsx               tela 1 — abertura da marca + redirect
  (auth)/                 telas 2 — welcome, sign-in, sign-up
  (onboarding)/           telas 3 e 4 — criança, interesses, plano
  (tabs)/                 tela 5 (home) + explorar, reservas, jornada, perfil
  activity/[id].tsx       tela 7 — detalhes da atividade

src/
  theme/                  tokens de cor, tipografia, espaçamento, sombra
  components/ui/          biblioteca de componentes (Button, Input, Card...)
  components/brand/       logotipo e elementos de marca
  components/navigation/  HeaderBar
  features/activities/    cards de atividade reutilizados entre telas
  services/               contrato KidooApi + implementação mockada
  hooks/queries.ts        React Query (chaves centralizadas)
  stores/                 zustand (sessão, rascunho de onboarding)
  lib/                    validação (zod), formatação, storage seguro, logger
  types/domain.ts         modelo de domínio
```

### A regra que sustenta tudo

Nenhuma tela conhece HTTP. Toda a UI depende só da interface `KidooApi`
(`src/services/types.ts`). Hoje ela é atendida por um mock em memória
(`src/services/mock/`). Quando o backend real existir, basta criar uma nova
implementação da mesma interface e apontar `src/services/index.ts` para ela —
nenhuma tela muda.

---

## Segurança

| Decisão                                                                                                      | Onde                             |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Token de sessão em Keychain (iOS) / Keystore (Android), com `WHEN_UNLOCKED_THIS_DEVICE_ONLY`                 | `src/lib/secure-storage.ts`      |
| Na web nada é persistido — token só em memória (localStorage é vulnerável a XSS)                             | `src/lib/secure-storage.ts`      |
| Só o token é salvo; o perfil é sempre revalidado no servidor ao restaurar                                    | `src/stores/auth-store.ts`       |
| Toda entrada do usuário validada com zod antes de virar estado ou requisição                                 | `src/lib/validation.ts`          |
| Logs com redação automática de PII (nome, e-mail, data de nascimento, foto, token)                           | `src/lib/logger.ts`              |
| Dados da criança ficam apenas em memória durante o onboarding e só são enviados após consentimento explícito | `src/stores/onboarding-store.ts` |
| Aceite de termos/LGPD obrigatório no cadastro                                                                | `app/(auth)/sign-up.tsx`         |
| Permissões nativas mínimas; `blockedPermissions` remove microfone, vídeo e localização precisa               | `app.json`                       |
| Textos de permissão explicam o uso real (exigência das lojas)                                                | `app.json`                       |
| ESLint bloqueia importar AsyncStorage (evita sessão em storage não criptografado)                            | `eslint.config.js`               |
| `.env` fora do versionamento; `EXPO_PUBLIC_*` documentado como público                                       | `.env.example`                   |

**Nenhum segredo pode viver no app.** Tudo que vai para o bundle é legível por
quem baixa o APK/IPA. Chaves de pagamento, service roles e assinatura de push
ficam no backend ou em EAS secrets.

## Performance

- Fontes empacotadas no bundle e splash nativa segurada até fontes + sessão
  resolverem: sem flash de fonte nem de tela de login.
- `expo-image` com `cachePolicy="memory-disk"`, `blurhash` de placeholder e
  `recyclingKey` nas listas.
- `FlatList` com `keyExtractor` estável, itens memoizados,
  `removeClippedSubviews` e janelas de render ajustadas por lista.
- `useDeferredValue` na busca de Explorar: digitar não trava a lista.
- React Query com `staleTime` de 5 min e `refetchOnWindowFocus` desligado —
  menos rede e menos bateria.
- Reanimated 4 (animações na UI thread) e React Compiler habilitado.
- Sombras via tokens equivalentes iOS/Android, usadas só onde o card flutua.

## Acessibilidade

Alvos de toque de no mínimo 44pt, `accessibilityRole`/`accessibilityLabel`/
`accessibilityState` em todo elemento interativo, e `maxFontSizeMultiplier`
para respeitar fonte grande do sistema sem quebrar o layout.

---

## Estado atual

As 10 telas do fluxo estão implementadas:

1. Splash / abertura da marca
2. Login / cadastro (com validação e aceite LGPD)
3. Cadastro da criança — dados + seleção de interesses
4. Assinatura — escolha de plano
5. Home — recomendados, modalidades, jornada, coins
6. Explorar — busca e filtro por modalidade
7. Detalhes da atividade
8. Reserva / confirmação (+ aba Reservas com histórico e status)
9. Check-in, com XP creditado e conquistas desbloqueadas
10. Jornada da criança — XP, níveis, conquistas e evolução semanal

O ciclo fecha: reservar → check-in → XP → conquista → jornada atualizada.

### Tema claro e escuro

Todo o design system lê cor em runtime: nenhum componente importa cor estática.
Duas paletas com as mesmas chaves (`src/theme/palettes.ts`), um `ThemeProvider`
com modo **Claro / Escuro / Automático** persistido, e `useStyles` recriando a
folha de estilos só quando o tema muda.

O escuro não é o claro invertido: o roxo da marca (#6A3FC6) não atinge
contraste legível sobre fundo escuro, então nele o primário é clareado, e os
fundos puxam para o roxo-carvão da identidade em vez de cinza neutro.

O módulo de tema **não exporta cor estática de propósito** — sem isso, um
componente poderia silenciosamente ficar preso no tema claro e ninguém
perceberia até ver a tela.

O seletor fica na aba Perfil.

### Cada modalidade tem cor e desenho próprios

O app inteiro era roxo. Isso deixa a marca coerente, mas faz Futebol, Natação e
Judô parecerem o mesmo produto — e a criança que abre o app não lê rótulo, lê
forma e cor.

- `src/theme/categories.ts` dá a cada modalidade um par **sólido/suave**, com
  variantes para o tema escuro. É essa cor que pinta o tile da Home, o chip de
  filtro selecionado no Explorar, o medalhão da tela de detalhe e os cartões de
  "Minhas atividades" na Jornada.
- `src/components/CategoryIcon.tsx` traz nove desenhos em SVG no lugar dos
  emojis. Emoji resolve rápido, mas cada sistema desenha o seu: o app ficava com
  a cara do Android ou do iOS, não do Kidoo. Os traços seguem a geometria do
  logotipo e assumem a cor da modalidade.
- `src/components/brand/BlobBackdrop.tsx` traz as formas orgânicas do guia da
  marca para trás dos cabeçalhos, em opacidade baixa — o texto passa por cima
  sem perder contraste.
- `blobRadius` (`src/theme/layout.ts`) quebra a simetria dos cantos: um canto
  grande e três pequenos, em vez do retângulo arredondado padrão.

Os desenhos foram revisados em captura de tela, no tamanho real de uso. Judô,
dança, ginástica e tênis foram redesenhados porque, a 28px, o primeiro traçado
não era legível — a versão anterior de judô lia como a letra "M".

### Distância é derivada, não guardada

O catálogo trazia `distanceKm` fixo em cada atividade — o que só funciona
enquanto todo mundo mora no mesmo lugar. Distância é uma relação entre o
parceiro e *quem está olhando*, então agora o parceiro guarda
`latitude`/`longitude` e o valor sai de `haversineKm` (`src/lib/geo.ts`), no
serviço e não na tela. No backend real isso vira um filtro por bounding box
antes do haversine; a tela continua recebendo o número pronto.

Sem localização, `distanceKm` é `null` e a tela **omite a distância** em vez de
estimar uma que não temos — "Buritis", não "Buritis • ~3 km".

O filtro **Perto de mim**, no Explorar, liga o raio (2 / 5 / 10 km) e a
ordenação por distância. Quatro decisões que valem também com backend:

- **Só primeiro plano.** `ACCESS_BACKGROUND_LOCATION` e `ACCESS_FINE_LOCATION`
  entram em `blockedPermissions`; sobra `ACCESS_COARSE_LOCATION`, e o app pede
  `Accuracy.Low`. Bairro basta para ordenar uma lista — calçada, não.
- **Só em memória.** A coordenada vive no store zustand e nunca vai para disco
  nem para o armazenamento seguro. Fechou o app, acabou.
- **Arredondada na entrada.** Três casas decimais (~110 m) antes de guardar:
  não dá para reconstruir o endereço da família, e a chave de cache para de
  mudar a cada tremida do GPS.
- **O prompt é do usuário.** Na abertura o app só *confere* uma permissão que
  já exista; o diálogo aparece quando alguém toca em "Perto de mim", com o
  rótulo na tela dizendo para quê.

Prompt e leitura têm teto de tempo (20 s e 8 s). Sem isso, quem simplesmente
ignora o diálogo do sistema deixa a tela em "Localizando…" para sempre — foi o
que aconteceu na primeira verificação em navegador, que fica em `prompt` sem
chamar nenhum callback. Estourado o tempo do prompt, o estado volta para
`idle` e não para `denied`: ninguém negou nada, e o próximo toque aproveita a
resposta que tenha chegado nesse meio-tempo.

### Banco (Supabase)

As migrations vivem em `supabase/migrations/` e o que elas garantem está em
`supabase/README.md`. Três pontos que valem aqui:

- **A vaga não é vendida duas vezes.** `book_session` trava a linha da turma
  antes de contar. Há um teste que abre duas conexões e disputa a mesma última
  vaga — sem o `for update`, as duas passam.
- **RLS separa os dois públicos** que vivem no mesmo banco: o responsável, no
  app, e o parceiro, no painel. E um parceiro nunca enxerga outro.
- **O responsável não confirma a própria presença.** Ele não tem `update` em
  `bookings`; quem confirma é o parceiro, e é isso que faz o repasse não ser
  autodeclaração.

- **O dinheiro anda dentro da transação da vaga.** `book_session` debita bônus
  e cota junto com o `slots_taken`; debitar fora abriria janela para gastar o
  mesmo coin duas vezes.

As regras de nível existem em SQL e em `src/lib/levels.ts` — o banco credita, a
tela prevê. `supabase/tests/parity.ts` compara as duas sobre a mesma faixa de XP,
porque duplicação em duas linguagens é onde isso racha em silêncio.

`supabase/tests/run.sh` sobe um Postgres descartável e roda tudo, sem Docker.

### Turmas, capacidade e vaga ociosa

A reserva era de uma **atividade**, com um horário genérico. Mas quem tem lugar
é a **turma** — e é o parceiro quem decide quantos lugares abre em cada uma.
`ClassSession` (`src/types/domain.ts`) carrega dia, hora, capacidade,
matriculados, vagas liberadas ao Kidoo e o tipo da vaga.

**Vaga ociosa é outro produto, não um desconto.** Numa turma que vai acontecer
de qualquer jeito e tem lugar sobrando, a criança a mais não custa nada ao
parceiro: o professor já está pago e a sala já está alugada. É a única fonte de
custo marginal baixo que existe em atividade infantil — o equivalente à
musculação no modelo do Wellhub, que consegue ser "ilimitado" justamente porque
uma visita a mais custa zero à academia.

Duas consequências no código:

- **A capacidade sai da modalidade.** Natação é 1 professor para 8 crianças, por
  segurança; futebol cabe 20 na quadra. Turma apertada lota, turma grande sobra
  — então a ocupação simulada é derivada da capacidade, e não um número solto.
  O resultado é um gradiente real: natação tem 1 turma ociosa em 3, futebol tem
  as 3. Na primeira versão do gerador **toda** modalidade dava a mesma
  proporção, o que fazia a elasticidade parecer modelada sem estar.
- **O `coinCost` da atividade virou "a partir de".** Quem cobra é a turma, e a
  ociosa custa um coin a menos. O desconto é repassado à família de propósito:
  é o que a move para o horário vazio, que é justamente o que dá para comprar
  barato. Sem esse incentivo todo mundo pede sábado de manhã.

`Booking` congela o `slotKind` no momento da reserva. O extrato de repasse do
parceiro é calculado sobre isso, e a turma pode mudar depois.

Cancelar devolve a vaga (`slotsTaken`), e a reserva rejeita turma cheia ou já
começada no serviço — duas famílias podem tocar em "confirmar" ao mesmo tempo.

### Check-in por proximidade

Chegou no local, o botão abre — o fluxo do Wellhub. Duas condições, em
`src/lib/check-in.ts`:

- **Janela de horário**: abre 45 min antes da aula, fecha 90 min depois.
- **Raio de 250 m** do parceiro. Generoso de propósito: um clube ocupa um
  quarteirão e o GPS erra dezenas de metros perto de prédio alto.

A margem de erro do aparelho entra **a favor de quem está chegando** — a
comparação é `distância − precisão` contra o raio. Um GPS que diz "300 m,
±120 m" pode estar em cima do local, e não cabe ao app apostar contra.

**GPS não é a autoridade do check-in, e não deve ser.** Falsificar localização
no Android é trivial (opções de desenvolvedor). Então a regra é assimétrica:
negamos quando há **prova contra** (leitura boa dizendo que a pessoa está
longe), nunca por **falta de prova**. Sem permissão, sem sinal, ou com
localização simulada, o check-in segue — marcado como não verificado. Quem
confirma a presença de verdade continua sendo o parceiro lendo o código.

Travar sem prova puniria a quadra coberta sem sinal e renderia chamado de
suporte; deixar passar um check-in não verificado apenas o marca como tal.

Três decisões de servidor que valem no backend real:

- **A distância é recalculada no serviço.** O cliente manda onde acha que
  está, nunca `estouNoLocal: true` — senão a checagem inteira vira um booleano
  que qualquer um reescreve.
- **Guardamos a distância, não a coordenada.** Para auditar um check-in
  suspeito basta saber que ele veio de 40 km; a localização da família não
  precisa existir no banco (`CheckInProof`).
- **Localização simulada nunca é `arrived`.** Se o próprio aparelho avisa que
  o dado é falso, o mínimo é não usá-lo como prova — vira "não verificado", e
  a flag fica registrada.

O catálogo tem sempre algumas turmas começando na próxima hora
(`startsInMin`). Sem isso, um mock em que tudo começa "hoje às 17:00" deixaria
o check-in inalcançável na maior parte do dia.

### Check-in confirmado pelo parceiro

O check-in gera um **comprovante**: um QR e um código de 6 dígitos que o
parceiro lê para confirmar a presença (`src/lib/check-in.ts`). Duas decisões
que valem também no backend real:

- **O código expira** (30 min). Um código eterno viraria passe livre: bastaria
  guardar a captura de tela para "provar presença" em outro dia.
- **O QR não carrega dado da criança.** Leva só o id da reserva e o código;
  quem escanear de fora não descobre nome, idade nem foto. O parceiro busca o
  resto no servidor, autenticado.

O código também **morre ao ser usado**, então não vale para uma segunda aula.

Enquanto o app do parceiro não existe, um atalho simula a leitura para o ciclo
ser testável. Ele é controlado por `src/lib/flags.ts` e fica ligado em
desenvolvimento **e nas builds de preview** (`EXPO_PUBLIC_ENABLE_PARTNER_SIM`,
definido no perfil `preview` do `eas.json`), e desligado em produção.

`__DEV__` sozinho não bastava: ele é falso em qualquer build de release,
inclusive no APK de preview que se instala no aparelho para testar — o atalho
simplesmente não aparecia lá.

### Avaliações

Atividades têm nota de 0 a 5 com meia estrela, distribuição por nota e
comentários (`src/features/reviews/`). A tela de detalhes ganhou as abas
**Sobre** e **Avaliações**.

Quando uma atividade ainda não tem comentários, o resumo cai para a nota do
catálogo em vez de exibir "0,0". Comentários mostram apenas o primeiro nome de
quem avaliou — nunca o nome completo nem o da criança.

Depois da aula o responsável avalia o estabelecimento (estrelas + comentário),
pela tela de check-in ou pela aba Reservas. Só é possível avaliar uma aula em
que houve check-in, e apenas uma vez por aula — as duas regras são do serviço,
não da tela.

### Economia de Kidoo Coins

A cobrança é **mensal**, mas a cota de coins é **semanal** e volta ao cheio toda
segunda-feira. Coins **não acumulam**: o que sobra na semana é perdido na virada
— a ideia é incentivar frequência, não estoque.

Cada atividade custa 2, 3 ou 4 coins conforme a estrutura exigida
(`COIN_TIERS` em `src/types/domain.ts`). No catálogo atual o custo médio é
**2,83 coins**, e é ele que calibra a cota de cada plano:

| Plano | Preço/mês | Coins/semana | Atividades/semana | Custo por coin |
| ----- | --------- | ------------ | ----------------- | -------------- |
| Start | R$ 79,90  | 8            | ~2,8              | R$ 9,99        |
| Plus  | R$ 109,90 | 12           | ~4,2              | R$ 9,16        |
| Max   | R$ 149,90 | 18           | ~6,4              | R$ 8,33        |

O custo por coin cai conforme o plano sobe, então o upgrade sempre compensa.
Nos extremos, a cota do Plus rende de 3 atividades (só as premium) a 6 (só as
básicas).

A virada de semana é aplicada na leitura e antes de cada débito
(`src/lib/subscription.ts`), então uma reserva feita depois da segunda usa a
cota nova mesmo que o app tenha ficado aberto desde a semana anterior.

### Moedas bônus (Kidoo Bônus)

Segunda moeda, **diferente dos Kidoo Coins da assinatura**: não vem do plano,
não reseta toda semana, e **cada lote vale 30 dias** a partir do dia em que foi
ganho. Por isso é guardada como lotes datados, e não como um saldo solto — sem
isso não há como saber o que vence quando.

Ganha ao subir de nível, com recompensa crescente mas contida:

| Nível alcançado | Bônus    |
| --------------- | -------- |
| 2 e 3           | 1 moeda  |
| 4 a 6           | 2 moedas |
| 7 a 9           | 3 moedas |
| 10 em diante    | 4 moedas |

Do nível 2 ao 10 são 21 moedas acumuladas. Com o custo médio de 2,83 coins por
atividade, isso equivale a cerca de 7 aulas de presente ao longo de ~23 aulas
feitas — um agrado por frequência, não um substituto da assinatura.

**Ao reservar, o bônus é gasto primeiro**, e dentro dele os lotes que vencem
antes — justamente porque expiram. A cota semanal cobre o restante. A tela de
confirmação mostra a divisão, e a Jornada avisa o que está perto de vencer.

Regras em `src/lib/bonus.ts`.

### Gamificação

- 100 XP por check-in
- O custo do nível **cresce**: `150 + (nível − 1) × 80`. O primeiro nível sai em
  2 aulas, para engatar rápido; o vigésimo quarto exige 20
- Chegar ao **nível 25** (teto inicial) pede 25.680 XP ≈ **257 aulas**, algo
  como 15 meses a 4 aulas por semana. Antes eram 250 XP fixos por nível, o que
  fechava o nível 25 em 60 aulas — curto demais para ser um objetivo
- Faixas: Iniciante, Curioso, Aventureiro, Explorador, Campeão e Lenda Kidoo
- Conquistas por regra: primeira aula, 3 de futebol, 2 de natação,
  3 modalidades diferentes
- Check-in é idempotente: repetir não credita XP duas vezes

A tela **Níveis e recompensas** (`app/journey/levels.tsx`) responde à pergunta
"o que eu ganho no próximo nível?" — por isso o próximo nível aparece
destacado no topo, e não como mais uma linha no meio da tabela.

Curva e recompensas ficam em `src/lib/levels.ts`, num lugar só.

### Tutorial de boas-vindas

Na primeira abertura, o mascote **Kiddo** apresenta o app em quatro passos, em
balão de fala (`src/features/tutorial/`). O mascote é SVG e não imagem: escala
em qualquer densidade e acompanha a paleta do tema.

A preferência de "já vi" é persistida (`src/lib/preferences.ts`), e enquanto
ela não chega do armazenamento nada é exibido — assim quem já viu não vê o
tutorial piscar a cada abertura.

O módulo de preferências mantém um **espelho em memória** atualizado *antes* da
gravação em disco. São dois problemas em um: a gravação podia falhar em
silêncio, e o "já vi" vivia só no estado local da tela — então qualquer
remontagem reapresentava o tutorial, sem erro visível em lugar nenhum. Com o
espelho, a decisão vale para a execução inteira mesmo que o disco falhe. No
navegador o armazenamento cai para `localStorage`: antes disso as duas funções
eram no-op fora do aparelho, e o tutorial reaparecia a cada carga da página.

O estado do tutorial vive num store (`src/stores/tutorial-store.ts`), e não no
estado local da Home. Voltar do check-in faz `replace` para as abas, o que
**remonta a Home** — com estado local, o tutorial ressuscitava a cada volta.

Em **Perfil › Ajuda** dá para rever a apresentação. Sem isso, quem dispensou
uma vez nunca mais via o tutorial: a preferência sobrevive à atualização do
APK, então nem reinstalar por cima trazia ele de volta.

Quatro passos é o teto útil: tutorial longo tem queda forte de conclusão, e
quem pula não vê justamente o que importa. Por isso o conteúdo é enxuto e a
instrução mais incomum do app — mostrar o código ao parceiro — aparece
**também** como dica contextual.

**Dicas contextuais** (`useOneTimeHint`) aparecem uma única vez, na primeira
vez que a pessoa chega à tela, ao lado do que explicam. Instrução no momento
em que é necessária gruda muito mais do que a mesma frase decorada dias antes
num carrossel de abertura. Diferente do tutorial, elas não bloqueiam a tela.

### Cancelamento

Cancelar é permitido até **6 horas antes** da aula, e só antes do check-in
(`src/lib/cancellation.ts`). O prazo protege o parceiro, que reservou vaga,
professor e equipamento.

A devolução é exata: a parte paga pela assinatura volta para a cota semanal, e
os lotes de bônus voltam **com a validade original**. Sem guardar essa data, o
cancelamento devolveria moeda nova de 30 dias, e bastaria reservar e cancelar
para renovar o prazo indefinidamente.

### Compartilhar conquista

O check-in gera um cartão da conquista, capturado como imagem e compartilhado
com o texto. O cartão usa cores fixas de propósito: a imagem sai do app e vai
para grupos e redes, então não deve herdar o tema escuro de quem compartilhou.

A mensagem cita apenas o primeiro nome da criança e a atividade — **nunca**
sobrenome, idade, local ou horário. Horário somado a local diria a estranhos
onde a criança está.

Quando o aparelho não permite compartilhar arquivo, cai para texto puro: é
melhor compartilhar algo do que falhar.

**Próxima fase:** backend real, pagamento da assinatura, push notifications e
testes (unitários com Jest + E2E com Maestro).

---

## Notas

- As imagens das atividades no mock apontam para o Unsplash e servem apenas
  para desenvolvimento. Substitua por mídia própria dos parceiros.
- `seedDemoHistory` (em `src/services/mock/index.ts`) dá 6 aulas concluídas à
  criança recém-cadastrada, para a Jornada não nascer vazia na apresentação.
  **Remover ao ligar o backend real** — está marcado no código.
- O logotipo é uma reconstrução em código (`src/components/brand/KidooLogo.tsx`)
  a partir do guia de identidade; para as lojas, exporte os ícones do arquivo
  original de design para `assets/`.
