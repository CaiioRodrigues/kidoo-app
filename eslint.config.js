// Flat config: Expo's rules + Prettier compatibility.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettier,
  {
    ignores: ['dist/*', 'node_modules/*', '.expo/*', 'android/*', 'ios/*'],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'react-hooks/exhaustive-deps': 'error',
      // Sessão/segredos nunca devem ir para storage não criptografado.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@react-native-async-storage/async-storage',
              message:
                'Não use AsyncStorage para dados sensíveis. Use src/lib/secure-storage.ts (expo-secure-store).',
            },
          ],
        },
      ],
    },
  },
]);
