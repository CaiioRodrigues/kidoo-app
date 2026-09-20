// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier/flat';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * O lint do painel.
 *
 * Existia um `npm run lint` no `package.json` desde o começo, e ele nunca
 * conferiu uma linha: sem arquivo de configuração aqui, o ESLint subia até a
 * raiz, achava o config do app — que ignora `partner/*` de propósito — e saía
 * com sucesso tendo ignorado tudo. Um lint que sempre passa é pior que não ter
 * lint nenhum: ele ocupa o lugar do que protegeria.
 *
 * O conjunto é o mesmo do app onde faz sentido (regras de hook como erro,
 * Prettier por último desligando o que é formatação), com uma diferença: o
 * painel roda no navegador, não no React Native, então os globais são os de
 * DOM.
 */
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Dependência faltando em hook é bug de dado velho na tela, não estilo.
      // No painel isso é o parceiro vendo a turma de ontem e confirmando a
      // presença errada.
      'react-hooks/exhaustive-deps': 'error',
      // O painel é tela de balcão: log vaza nome de criança e e-mail de
      // responsável no console de um computador compartilhado.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Configuração de build roda no Node, não no navegador.
    files: ['vite.config.ts', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
