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
Enquanto não existe o app do parceiro, um botão visível apenas em
desenvolvimento simula a leitura, para o ciclo ser testável de ponta a ponta.

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

- 100 XP por check-in; 250 XP fecham um nível
- Níveis: Iniciante, Curioso, Aventureiro, Explorador, Campeão
- Conquistas por regra (`src/services/mock/journey.ts`): primeira aula,
  3 aulas de futebol, 2 de natação, 3 modalidades diferentes
- Check-in é idempotente: repetir não credita XP duas vezes

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
