import { getLegalAgeConfirmed } from '@/data/legal-age';
import { getSavedFirstName } from '@/data/user-name';

export type LaunchRoute = '/age-gate' | '/home' | '/welcome';

export function getLaunchRoute(): LaunchRoute {
  if (!getLegalAgeConfirmed()) {
    return '/age-gate';
  }
  return getSavedFirstName() ? '/home' : '/welcome';
}
