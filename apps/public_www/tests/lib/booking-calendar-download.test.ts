import { describe, expect, it, vi } from 'vitest';

import {
  buildBookingIcsCalendarContent,
  buildBookingIcsContent,
  sanitizeBookingIcsFilename,
  triggerBookingIcsDownload,
} from '@/lib/booking-calendar-download';

describe('booking-calendar-download', () => {
  it('returns null when start datetime is invalid', () => {
    expect(
      buildBookingIcsContent({
        title: 'Test',
        dateStartTime: 'not-a-date',
        location: 'Here',
      }),
    ).toBeNull();
  });

  it('builds a VEVENT with UTC times and escapes text', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uid-1234' });

    const ics = buildBookingIcsContent({
      title: 'Workshop, intro',
      dateStartTime: '2026-04-08T12:00:00.000Z',
      dateEndTime: '2026-04-08T13:30:00.000Z',
      location: 'Evolve Sprouts; Sheung Wan',
    });

    vi.unstubAllGlobals();

    expect(ics).not.toBeNull();
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260408T120000Z');
    expect(ics).toContain('DTEND:20260408T133000Z');
    expect(ics).toContain('SUMMARY:Workshop\\, intro');
    expect(ics).toContain('LOCATION:Evolve Sprouts\\; Sheung Wan');
    expect(ics).toContain('UID:test-uid-1234');
  });

  it('uses start plus one hour when end is missing', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'uid-2' });

    const ics = buildBookingIcsContent({
      title: 'Solo start',
      dateStartTime: '2026-01-01T10:00:00.000Z',
      location: 'Online',
    });

    vi.unstubAllGlobals();

    expect(ics).toContain('DTEND:20260101T110000Z');
  });

  it('builds multiple VEVENT blocks for multi-session calendars', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'multi-root' });

    const ics = buildBookingIcsCalendarContent({
      title: 'Course',
      location: 'Studio',
      sessions: [
        {
          dateStartTime: '2026-04-08T12:00:00.000Z',
          dateEndTime: '2026-04-08T13:00:00.000Z',
        },
        {
          dateStartTime: '2026-05-08T12:00:00.000Z',
          dateEndTime: '2026-05-08T13:00:00.000Z',
        },
      ],
    });

    vi.unstubAllGlobals();

    expect(ics).not.toBeNull();
    expect(ics?.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics?.match(/END:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain('UID:multi-root-0');
    expect(ics).toContain('UID:multi-root-1');
  });

  it('sanitizes download filename base', () => {
    expect(sanitizeBookingIcsFilename('  Hello @World!  ')).toBe('Hello-World');
    expect(sanitizeBookingIcsFilename('!!!')).toBe('booking');
  });

  it('triggers a download via temporary anchor', () => {
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    triggerBookingIcsDownload(
      'BEGIN:VCALENDAR\nEND:VCALENDAR\n',
      'My Event',
    );

    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url');

    clickSpy.mockRestore();
    createObjectUrlSpy.mockRestore();
    revokeSpy.mockRestore();
  });
});
