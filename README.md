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

**Implementado**

1. Splash / abertura da marca
2. Login / cadastro (com validação e aceite LGPD)
3. Cadastro da criança — dados + seleção de interesses
4. Assinatura — escolha de plano
5. Home — recomendados, modalidades, jornada, coins
6. Explorar — busca e filtro por modalidade
7. Detalhes da atividade (sem o fluxo de reserva)

**Próxima fase**

8. Reserva / confirmação
9. Check-in
10. Jornada da criança (XP, conquistas, evolução)

Além disso: backend real, pagamento da assinatura, push notifications e testes
(unitários com Jest + E2E com Maestro).

---

## Notas

- As imagens das atividades no mock apontam para o Unsplash e servem apenas
  para desenvolvimento. Substitua por mídia própria dos parceiros.
- O logotipo é uma reconstrução em código (`src/components/brand/KidooLogo.tsx`)
  a partir do guia de identidade; para as lojas, exporte os ícones do arquivo
  original de design para `assets/`.
