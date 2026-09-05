const { withAppBuildGradle } = require('@expo/config-plugins');

/**
 * Nomeia o APK/AAB com a versão, em vez de deixar o `app-release.apk` genérico
 * que o Gradle gera por padrão.
 *
 * Sem isso, dois builds de versões diferentes têm exatamente o mesmo nome de
 * arquivo — é fácil instalar o binário errado ou sobrescrever o anterior sem
 * perceber. Com o nome carregando versão e versionCode, o arquivo se
 * identifica sozinho:
 *
 *   kidoo-1.0.0-1-release.apk
 *
 * Vale para build local (`expo run:android`, `gradlew assembleRelease`). O EAS
 * Build nomeia o artefato do lado dele; lá a rastreabilidade vem do
 * versionCode, que o perfil de produção já incrementa automaticamente.
 */
const MARKER = '// kidoo: nome de arquivo versionado';

const SNIPPET = `
${MARKER}
android.applicationVariants.all { variant ->
    variant.outputs.all { output ->
        def versionName = variant.versionName ?: "0.0.0"
        def versionCode = variant.versionCode ?: 0
        outputFileName = "kidoo-\${versionName}-\${versionCode}-\${variant.buildType.name}.apk"
    }
}
`;

module.exports = function withVersionedApk(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      throw new Error('with-versioned-apk: só suporta build.gradle em Groovy.');
    }
    // prebuild pode rodar sobre um projeto já gerado: não duplica o bloco.
    if (cfg.modResults.contents.includes(MARKER)) return cfg;

    cfg.modResults.contents += SNIPPET;
    return cfg;
  });
};
