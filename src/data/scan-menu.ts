import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import { beginScan } from '@/data/scan-session';

let scanning = false;

/** Opens the system camera to photograph a drink menu, then shows results. */
export async function scanMenu(): Promise<void> {
  if (scanning) {
    return;
  }
  scanning = true;
  try {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Camera access needed',
        'To scan menus, allow camera access for Sipelle in your device Settings.',
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.7,
    });
    if (result.canceled) {
      return;
    }
    const asset = result.assets[0];
    if (!asset?.base64) {
      Alert.alert('Scan failed', 'The photo could not be read. Please try again.');
      return;
    }
    // Hand the base64 JPEG to the scan store, then show the results screen,
    // which subscribes to the session and renders drinks as they arrive.
    beginScan(asset.base64);
    router.push('/results');
  } finally {
    scanning = false;
  }
}
