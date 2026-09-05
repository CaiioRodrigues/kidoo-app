#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Sobe a versão do app em um lugar só.
 *
 * O erro fácil aqui é subir o `version` e esquecer o `versionCode` do Android
 * ou o `buildNumber` do iOS — as lojas recusam um envio cujo número de build
 * não cresceu, e o APK acabaria com o mesmo nome do anterior. Este script
 * move os três juntos.
 *
 *   npm run version:patch   1.0.0 -> 1.0.1
 *   npm run version:minor   1.0.1 -> 1.1.0
 *   npm run version:major   1.1.0 -> 2.0.0
 */
const kind = process.argv[2];
if (!['patch', 'minor', 'major'].includes(kind)) {
  console.error('Uso: node scripts/bump-version.mjs <patch|minor|major>');
  process.exit(1);
}

const path = new URL('../app.json', import.meta.url);
const config = JSON.parse(readFileSync(path, 'utf8'));
const expo = config.expo;

const [major, minor, patch] = expo.version.split('.').map(Number);
const next =
  kind === 'major'
    ? `${major + 1}.0.0`
    : kind === 'minor'
      ? `${major}.${minor + 1}.0`
      : `${major}.${minor}.${patch + 1}`;

const nextCode = (expo.android.versionCode ?? 0) + 1;

expo.version = next;
expo.android.versionCode = nextCode;
expo.ios.buildNumber = String(nextCode);

writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);

console.log(`versão ${major}.${minor}.${patch} -> ${next}`);
console.log(`versionCode / buildNumber -> ${nextCode}`);
console.log(`APK sairá como kidoo-${next}-${nextCode}-release.apk`);
