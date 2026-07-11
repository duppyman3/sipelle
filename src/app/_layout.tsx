import { Caveat_600SemiBold } from '@expo-google-fonts/caveat';
import { PlayfairDisplay_600SemiBold } from '@expo-google-fonts/playfair-display';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlayfairDisplay_600SemiBold,
    Caveat_600SemiBold,
  });

  useEffect(() => {
    // Hide on error too, so a font failure degrades to system fonts instead
    // of hanging the native splash.
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    // The design is light-only; DefaultTheme pins navigator surfaces light
    // even when the device is in dark mode.
    <ThemeProvider value={DefaultTheme}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
        <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.washSplash } }} />
        <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: colors.washMint } }} />
        <Stack.Screen name="home" options={{ contentStyle: { backgroundColor: colors.tile } }} />
        <Stack.Screen name="results" options={{ contentStyle: { backgroundColor: colors.washCream } }} />
      </Stack>
    </ThemeProvider>
  );
}
