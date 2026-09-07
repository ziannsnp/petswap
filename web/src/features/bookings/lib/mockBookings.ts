import type { BookingWithDetails } from './bookingApi';

export const DEV_MOCK_USER_ID = 'dev-demo-user-1234';

export function isDevMockSession(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage?.getItem('petswap_dev_mock_session') === 'true'
    );
  } catch {
    return false;
  }
}

export function isDevMockEmpty(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      window.localStorage?.getItem('petswap_dev_mock_empty') === 'true'
    );
  } catch {
    return false;
  }
}

export function isLocalhost(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    );
  } catch {
    return false;
  }
}

export const MOCK_OUTGOING_BOOKINGS: BookingWithDetails[] = [
  {
    id: 'mock-out-1',
    listing_id: 'listing-chiangmai-1',
    pet_id: 'pet-milo',
    requester_id: DEV_MOCK_USER_ID,
    status: 'confirmed',
    start_date: '2026-09-15',
    end_date: '2026-09-20',
    requester_note: 'Milo loves daily walks and is very gentle with people.',
    owner_note: 'Happy to host Milo! We have a large fenced garden.',
    created_at: '2026-09-01T10:00:00.000Z',
    updated_at: '2026-09-02T14:30:00.000Z',
    confirmed_at: '2026-09-02T14:30:00.000Z',
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: {
      id: 'pet-milo',
      name: 'Milo (Golden Retriever)',
      species: 'dog',
      photo_url: null,
    },
    listing: {
      id: 'listing-chiangmai-1',
      title: 'Quiet garden home near the park',
      location: 'Chiang Mai',
    },
  },
  {
    id: 'mock-out-2',
    listing_id: 'listing-bangkok-1',
    pet_id: 'pet-luna',
    requester_id: DEV_MOCK_USER_ID,
    status: 'pending',
    start_date: '2026-10-01',
    end_date: '2026-10-05',
    requester_note: 'Luna needs daily wet food and gentle brushing.',
    owner_note: null,
    created_at: '2026-09-05T08:15:00.000Z',
    updated_at: '2026-09-05T08:15:00.000Z',
    confirmed_at: null,
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: {
      id: 'pet-luna',
      name: 'Luna',
      species: 'cat',
      photo_url: null,
    },
    listing: {
      id: 'listing-bangkok-1',
      title: 'Cozy high-rise apartment with cat tree',
      location: 'Bangkok, Sukhumvit',
    },
  },
  {
    id: 'mock-out-3',
    listing_id: 'listing-phuket-1',
    pet_id: 'pet-milo',
    requester_id: DEV_MOCK_USER_ID,
    status: 'completed',
    start_date: '2026-08-10',
    end_date: '2026-08-15',
    requester_note: null,
    owner_note: null,
    created_at: '2026-08-01T09:00:00.000Z',
    updated_at: '2026-08-15T18:00:00.000Z',
    confirmed_at: '2026-08-02T11:00:00.000Z',
    declined_at: null,
    cancelled_at: null,
    completed_at: '2026-08-15T18:00:00.000Z',
    pet: {
      id: 'pet-milo',
      name: 'Milo (Golden Retriever)',
      species: 'dog',
      photo_url: null,
    },
    listing: {
      id: 'listing-phuket-1',
      title: 'Beachside pet villa',
      location: 'Phuket',
    },
  },
];

export const MOCK_INCOMING_BOOKINGS: BookingWithDetails[] = [
  {
    id: 'mock-in-1',
    listing_id: 'listing-my-home',
    pet_id: 'pet-charlie',
    requester_id: 'guest-user-alice',
    status: 'pending',
    start_date: '2026-09-22',
    end_date: '2026-09-26',
    requester_note: 'Charlie is fully vaccinated and loves playing with toys.',
    owner_note: null,
    created_at: '2026-09-06T11:00:00.000Z',
    updated_at: '2026-09-06T11:00:00.000Z',
    confirmed_at: null,
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: {
      id: 'pet-charlie',
      name: 'Charlie (Beagle)',
      species: 'dog',
      photo_url: null,
    },
    listing: {
      id: 'listing-my-home',
      title: 'Spacious townhouse with fenced backyard',
      location: 'Nonthaburi',
    },
  },
  {
    id: 'mock-in-2',
    listing_id: 'listing-my-home',
    pet_id: 'pet-oliver',
    requester_id: 'guest-user-bob',
    status: 'confirmed',
    start_date: '2026-09-28',
    end_date: '2026-10-02',
    requester_note: 'Oliver is an indoor cat who enjoys sunbathing.',
    owner_note: 'All set! Look forward to hosting Oliver.',
    created_at: '2026-09-04T15:00:00.000Z',
    updated_at: '2026-09-05T09:30:00.000Z',
    confirmed_at: '2026-09-05T09:30:00.000Z',
    declined_at: null,
    cancelled_at: null,
    completed_at: null,
    pet: {
      id: 'pet-oliver',
      name: 'Oliver (British Shorthair)',
      species: 'cat',
      photo_url: null,
    },
    listing: {
      id: 'listing-my-home',
      title: 'Spacious townhouse with fenced backyard',
      location: 'Nonthaburi',
    },
  },
  {
    id: 'mock-in-3',
    listing_id: 'listing-my-home',
    pet_id: 'pet-rocky',
    requester_id: 'guest-user-dave',
    status: 'declined',
    start_date: '2026-09-18',
    end_date: '2026-09-21',
    requester_note: 'Rocky needs a quiet place.',
    owner_note: 'Sorry, we are already occupied on those dates.',
    created_at: '2026-09-03T08:00:00.000Z',
    updated_at: '2026-09-03T10:00:00.000Z',
    confirmed_at: null,
    declined_at: '2026-09-03T10:00:00.000Z',
    cancelled_at: null,
    completed_at: null,
    pet: {
      id: 'pet-rocky',
      name: 'Rocky (French Bulldog)',
      species: 'dog',
      photo_url: null,
    },
    listing: {
      id: 'listing-my-home',
      title: 'Spacious townhouse with fenced backyard',
      location: 'Nonthaburi',
    },
  },
];
