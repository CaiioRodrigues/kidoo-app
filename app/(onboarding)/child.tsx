import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';

import { HeaderBar } from '@/components/navigation';
import { Avatar, Button, Chip, Input, Screen, StepIndicator, Text } from '@/components/ui';
import { brDateToIso, isoDateToBr, maskBirthDate } from '@/lib/format';
import { logger } from '@/lib/logger';
import { ageFromBirthDate, childProfileSchema, fieldErrors } from '@/lib/validation';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { colors, radius, spacing } from '@/theme';
import type { Gender } from '@/types/domain';

const GENDERS: { value: Gender; label: string }[] = [
  { value: 'boy', label: 'Menino' },
  { value: 'girl', label: 'Menina' },
  { value: 'undisclosed', label: 'Prefiro não informar' },
];

/** Tela 3 (etapa 1) — Quem é o pequeno Kidoo? */
export default function ChildProfileScreen() {
  const router = useRouter();
  const draft = useOnboardingStore((state) => state.draft);
  const setProfile = useOnboardingStore((state) => state.setProfile);

  const [name, setName] = useState(draft.name);
  const [birthDate, setBirthDate] = useState(draft.birthDate ? isoDateToBr(draft.birthDate) : '');
  const [gender, setGender] = useState<Gender>(draft.gender);
  const [photoUri, setPhotoUri] = useState<string | null>(draft.photoUri);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isoBirthDate = useMemo(() => brDateToIso(birthDate), [birthDate]);
  const ageLabel = useMemo(() => {
    if (!isoBirthDate || Number.isNaN(Date.parse(isoBirthDate))) return undefined;
    const age = ageFromBirthDate(isoBirthDate);
    if (age < 0 || age > 100) return undefined;
    return age === 1 ? '1 ano' : `${age} anos`;
  }, [isoBirthDate]);

  const pickPhoto = useCallback(async () => {
    try {
      // Sem permissão de biblioteca inteira: o seletor devolve só a imagem escolhida.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch (error) {
      logger.warn('Não foi possível abrir a galeria', error);
    }
  }, []);

  const handleContinue = useCallback(() => {
    const parsed = childProfileSchema.safeParse({
      name,
      birthDate: isoBirthDate ?? '',
      gender,
      photoUri,
    });

    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setProfile(parsed.data);
    router.push('/(onboarding)/interests');
  }, [gender, isoBirthDate, name, photoUri, router, setProfile]);

  return (
    <Screen scroll contentContainerStyle={styles.scroll}>
      <HeaderBar center={<StepIndicator total={4} current={1} />} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.intro}>
          <View style={styles.introText}>
            <Text variant="title">
              Quem é o pequeno{'\n'}
              <Text variant="title" color={colors.primary}>
                Kidoo?
              </Text>
            </Text>
            <Text variant="body" color={colors.textMuted}>
              Vamos começar com algumas informações básicas.
            </Text>
          </View>
          <View style={styles.introArt}>
            <Text style={styles.introEmoji}>🧒</Text>
          </View>
        </View>

        <View style={styles.form}>
          <Input
            label="Nome completo"
            icon="person-outline"
            placeholder="Nome da criança"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
            textContentType="none"
          />

          <Input
            label="Data de nascimento"
            icon="calendar-outline"
            placeholder="DD/MM/AAAA"
            value={birthDate}
            onChangeText={(value) => setBirthDate(maskBirthDate(value))}
            error={errors.birthDate}
            keyboardType="number-pad"
            maxLength={10}
            suffix={
              ageLabel ? (
                <Text variant="caption" color={colors.textFaint}>
                  {ageLabel}
                </Text>
              ) : null
            }
          />

          <View style={styles.group}>
            <Text variant="label" color={colors.textMuted}>
              Gênero (opcional)
            </Text>
            <View style={styles.genderRow}>
              {GENDERS.map((option) => (
                <Chip
                  key={option.value}
                  label={option.label}
                  selected={gender === option.value}
                  onPress={() => setGender(option.value)}
                  left={
                    <Ionicons
                      name="happy-outline"
                      size={16}
                      color={gender === option.value ? colors.primary : colors.textFaint}
                    />
                  }
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text variant="label" color={colors.textMuted}>
              Foto do pequeno (opcional)
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Escolher foto da criança"
              onPress={() => void pickPhoto()}
              style={styles.photoPicker}
            >
              <Avatar name={name || 'Kidoo'} uri={photoUri} size={92} ring />
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={16} color={colors.textOnPrimary} />
              </View>
            </Pressable>
            <Text variant="caption" color={colors.textFaint} center>
              A foto fica no seu aparelho e só é enviada quando você conclui o cadastro.
            </Text>
          </View>
        </View>

        <Button title="Continuar" onPress={handleContinue} style={styles.cta} />
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl },
  intro: { flexDirection: 'row', alignItems: 'center', gap: spacing.base, paddingTop: spacing.sm },
  introText: { flex: 1, gap: spacing.sm },
  introArt: {
    width: 92,
    height: 92,
    borderRadius: radius.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
  },
  introEmoji: { fontSize: 44, lineHeight: 52 },
  form: { gap: spacing.lg, marginTop: spacing.xxl },
  group: { gap: spacing.sm },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoPicker: { alignSelf: 'center', marginTop: spacing.xs },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
  },
  cta: { marginTop: spacing.xxl },
});
