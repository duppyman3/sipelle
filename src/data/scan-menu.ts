import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Alert } from 'react-native';

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
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'] });
    if (result.canceled) {
      return;
    }
    // result.assets[0].uri is the menu photo — the future scan flow consumes it here.
    router.push('/results');
  } finally {
    scanning = false;
  }
}
