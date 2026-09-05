# Guia do repositório

App Expo SDK 57 (React Native 0.86, React 19) com expo-router.

## Antes de escrever código

Consulte a documentação versionada do SDK em
https://docs.expo.dev/versions/v57.0.0/ — a API do Expo muda entre SDKs.
Quando os docs não estiverem acessíveis, valide contra os tipos e o código
dentro de `node_modules/` (fonte casada com a versão instalada).

## Regras do projeto

- **Nenhum hex solto.** Cores, espaçamentos, raios e sombras vêm de `src/theme`.
- **Nenhum `fontFamily` solto.** Use `<Text variant="...">` de `@/components/ui`.
- **Telas não conhecem HTTP.** Toda chamada passa pela interface `KidooApi`
  (`src/services/types.ts`).
- **Nada sensível fora do storage seguro.** Sessão só via
  `src/lib/secure-storage.ts`. AsyncStorage é bloqueado pelo ESLint.
- **Entrada do usuário sempre validada com zod** antes de virar estado ou request.
- **Nunca `console.*` direto** em código de produto: use `src/lib/logger.ts`,
  que redige PII.
- **Sem segredos no bundle.** `EXPO_PUBLIC_*` é público por definição.
- **Nada colado no rodapé sem área segura.** O Android 16 torna edge-to-edge
  obrigatório: o app desenha atrás da barra do sistema. Barra de abas, rodapés
  fixos e Modais precisam somar `useSafeAreaInsets().bottom`, senão os toques
  disputam espaço com os botões do celular. Altura fixa em `tabBarStyle`
  anula o cálculo automático do React Navigation.

## Antes de commitar

```bash
npm run typecheck && npm run lint
```

Ambos devem passar sem erros nem warnings.
