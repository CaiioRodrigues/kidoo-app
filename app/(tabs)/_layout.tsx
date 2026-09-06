import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { fontFamily, useTheme } from '@/theme';

/** Altura da barra sem contar a área do sistema. */
const TAB_BAR_HEIGHT = Platform.OS === 'ios' ? 52 : 60;

/**
 * Pílula atrás do ícone ativo. A tab bar padrão só troca a cor do ícone, o que
 * é o desenho mais genérico possível — a pílula dá um alvo visual claro e uma
 * assinatura própria, sem custar legibilidade.
 */
function TabIcon({
  name,
  color,
  focused,
  tint,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: ColorValue;
  focused: boolean;
  tint: ColorValue;
}) {
  return (
    <View style={[tabIconStyles.wrapper, focused && { backgroundColor: tint }]}>
      <Ionicons name={name} size={22} color={color} />
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  wrapper: {
    minWidth: 46,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderBottomRightRadius: 18,
  },
});

export default function TabsLayout() {
  const { colors } = useTheme();
  // O Android 16 torna edge-to-edge obrigatório: o app desenha atrás da barra
  // de navegação do sistema. Sem somar o inset aqui, a barra de abas fica por
  // baixo dos botões do celular e vira uma disputa de toque.
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontFamily: fontFamily.medium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="home" color={color} focused={focused} tint={colors.primaryTint} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="search" color={color} focused={focused} tint={colors.primaryTint} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Reservas',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="calendar-outline" color={color} focused={focused} tint={colors.primaryTint} />
          ),
        }}
      />
      <Tabs.Screen
        name="journey"
        options={{
          title: 'Jornada',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="star-outline" color={color} focused={focused} tint={colors.primaryTint} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person-outline" color={color} focused={focused} tint={colors.primaryTint} />
          ),
        }}
      />
    </Tabs>
  );
}
