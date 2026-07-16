/// <reference types="jest" />
// Fresh and returning-user launch decisions.

import { getLaunchRoute } from '@/data/launch-route';
import { getLegalAgeConfirmed } from '@/data/legal-age';
import { getSavedFirstName } from '@/data/user-name';

jest.mock('@/data/legal-age', () => ({
  getLegalAgeConfirmed: jest.fn(),
}));

jest.mock('@/data/user-name', () => ({
  getSavedFirstName: jest.fn(),
}));

const mockGetLegalAgeConfirmed = jest.mocked(getLegalAgeConfirmed);
const mockGetSavedFirstName = jest.mocked(getSavedFirstName);

describe('launch routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sends every unconfirmed user to the age gate, including an existing user', () => {
    mockGetLegalAgeConfirmed.mockReturnValue(false);
    mockGetSavedFirstName.mockReturnValue('Nina');

    expect(getLaunchRoute()).toBe('/age-gate');
    expect(mockGetSavedFirstName).not.toHaveBeenCalled();
  });

  it('sends a confirmed new user to name onboarding', () => {
    mockGetLegalAgeConfirmed.mockReturnValue(true);
    mockGetSavedFirstName.mockReturnValue(null);

    expect(getLaunchRoute()).toBe('/welcome');
  });

  it('sends a confirmed existing user home', () => {
    mockGetLegalAgeConfirmed.mockReturnValue(true);
    mockGetSavedFirstName.mockReturnValue('Nina');

    expect(getLaunchRoute()).toBe('/home');
  });
});
