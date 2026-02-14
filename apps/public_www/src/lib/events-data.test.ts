import { afterEach, describe, expect, it, vi } from 'vitest';

import enContent from '@/content/en.json';
import {
  fetchEventsPayload,
  normalizeEvents,
  resolveEventsApiUrl,
} from '@/lib/events-data';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('events-data', () => {
  it('resolves CRM events endpoint from base URL', () => {
    expect(
      resolveEventsApiUrl(
        'https://api.evolvesprouts.com/www',
        'https://fallback.example.com/events',
      ),
    ).toBe('https://api.evolvesprouts.com/www/v1/calendar/events');
    expect(
      resolveEventsApiUrl(
        'https://api.evolvesprouts.com/www/',
        'https://fallback.example.com/events',
      ),
    ).toBe('https://api.evolvesprouts.com/www/v1/calendar/events');
    expect(
      resolveEventsApiUrl('   ', 'https://fallback.example.com/events'),
    ).toBe('https://fallback.example.com/events');
  });

  it('normalizes calendar events payload from CRM API', () => {
    const payload = {
      status: 'success',
      data: [
        {
          title: 'TEST Creative Writing Masterclass',
          description:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
          tags: {
            '7': 'Fully Booked',
            '265': 'TEST Beginner Friendly',
            '268': 'TEST In-Person',
            '269': 'TEST Limited Seats',
          },
          categories: {
            '264': 'TEST Creative Arts',
          },
          location: 'physical',
          address:
            'H210, 2/F, PMQ, Mid-Levels, Central and Western, Hong Kong Island',
          address_url:
            'https://www.google.com/maps/search/?api=1&query=H210%2C+2%2FF%2C+PMQ%2C+Mid-Levels%2C+Central+and+Western%2C+Hong+Kong+Island',
          dates: [
            {
              start_datetime: '2025-12-05T10:00:00Z',
              end_datetime: '2025-12-05T13:00:00Z',
            },
          ],
          is_fully_booked: true,
        },
        {
          title: 'TEST Data Science Intensive Touch',
          description:
            'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.',
          tags: {
            '266': 'TEST Advanced Level',
            '268': 'TEST In-Person',
          },
          categories: {
            '261': 'TEST Workshop Category',
          },
          location: 'virtual',
          address: 'Virtual Meeting',
          address_url: 'https://meet.example.com/data-science',
          dates: [
            {
              start_datetime: '2025-12-15T09:00:00Z',
              end_datetime: '2025-12-15T12:00:00Z',
            },
          ],
          is_fully_booked: false,
        },
      ],
    };

    const events = normalizeEvents(payload, enContent.events);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: 'TEST Creative Writing Masterclass',
      status: 'fully_booked',
      dateLabel: '05 Dec 2025',
      timeLabel: '10:00 AM - 1:00 PM',
      locationName:
        'H210, 2/F, PMQ, Mid-Levels, Central and Western, Hong Kong Island',
      ctaHref:
        'https://www.google.com/maps/search/?api=1&query=H210%2C+2%2FF%2C+PMQ%2C+Mid-Levels%2C+Central+and+Western%2C+Hong+Kong+Island',
      ctaLabel: enContent.events.card.ctaLabel,
      timestamp: Date.parse('2025-12-05T10:00:00Z'),
    });
    expect(events[0]?.tags).toEqual([
      'Fully Booked',
      'TEST Beginner Friendly',
      'TEST In-Person',
      'TEST Limited Seats',
      'TEST Creative Arts',
    ]);

    expect(events[1]).toMatchObject({
      title: 'TEST Data Science Intensive Touch',
      status: 'open',
      dateLabel: '15 Dec 2025',
      timeLabel: '9:00 AM - 12:00 PM',
      locationName: 'Virtual Meeting',
      ctaHref: 'https://meet.example.com/data-science',
      ctaLabel: enContent.events.card.ctaLabel,
      timestamp: Date.parse('2025-12-15T09:00:00Z'),
    });
    expect(events[1]?.tags).toEqual([
      'TEST Advanced Level',
      'TEST In-Person',
      'TEST Workshop Category',
    ]);
  });

  it('fetches events payload with x-api-key', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'success',
          data: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const payload = await fetchEventsPayload(
      'https://api.evolvesprouts.com/www/v1/calendar/events',
      'public-crm-key',
      new AbortController().signal,
    );

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.evolvesprouts.com/www/v1/calendar/events',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'x-api-key': 'public-crm-key',
        }),
      }),
    );
    expect(payload).toEqual({
      status: 'success',
      data: [],
    });
  });

  it('throws if events API key is missing', async () => {
    await expect(
      fetchEventsPayload(
        'https://api.evolvesprouts.com/www/v1/calendar/events',
        '   ',
        new AbortController().signal,
      ),
    ).rejects.toThrow('Events API key is missing');
  });
});
