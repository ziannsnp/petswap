import type { Session } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';
import { authKeys } from '../context/authContext';
import { setSessionCache } from './sessionCache';

function sessionFor(userId: string): Session {
  return { access_token: `token-${userId}`, user: { id: userId } } as unknown as Session;
}

const outgoingKey = ['bookings', 'outgoing'] as const;
const profileKey = ['profiles', 'current'] as const;

function seedUserData(queryClient: QueryClient, owner: string) {
  queryClient.setQueryData(outgoingKey, [{ id: `${owner}-booking` }]);
  queryClient.setQueryData(profileKey, { displayName: owner });
}

describe('setSessionCache', () => {
  it('drops the previous user\'s cached data when they sign out', () => {
    const queryClient = new QueryClient();
    setSessionCache(queryClient, sessionFor('alex'));
    seedUserData(queryClient, 'alex');

    setSessionCache(queryClient, null);

    expect(queryClient.getQueryData(outgoingKey)).toBeUndefined();
    expect(queryClient.getQueryData(profileKey)).toBeUndefined();
    expect(queryClient.getQueryData(authKeys.session())).toBeNull();
  });

  it('never shows one user\'s bookings to the next user who signs in', () => {
    const queryClient = new QueryClient();
    setSessionCache(queryClient, sessionFor('alex'));
    seedUserData(queryClient, 'alex');

    setSessionCache(queryClient, sessionFor('blair'));

    expect(queryClient.getQueryData(outgoingKey)).toBeUndefined();
    expect(queryClient.getQueryData(profileKey)).toBeUndefined();
    expect(queryClient.getQueryData<Session>(authKeys.session())?.user.id).toBe('blair');
  });

  it('keeps cached data when the same user\'s token is refreshed', () => {
    const queryClient = new QueryClient();
    setSessionCache(queryClient, sessionFor('alex'));
    seedUserData(queryClient, 'alex');

    setSessionCache(queryClient, { ...sessionFor('alex'), access_token: 'refreshed' });

    expect(queryClient.getQueryData(outgoingKey)).toEqual([{ id: 'alex-booking' }]);
  });

  it('keeps public data cached on the first sign-in of the tab', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['search', 'listings'], ['public listing']);
    setSessionCache(queryClient, null);

    setSessionCache(queryClient, sessionFor('alex'));

    expect(queryClient.getQueryData(['search', 'listings'])).toEqual(['public listing']);
  });
});
