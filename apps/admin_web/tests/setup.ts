import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

const fetchMock = vi.fn();
const clipboardWriteTextMock = vi.fn(async () => undefined);
const confirmMock = vi.fn(() => true);

vi.stubGlobal('fetch', fetchMock);
vi.stubGlobal('confirm', confirmMock);

Object.defineProperty(window.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: clipboardWriteTextMock,
  },
});

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  fetchMock.mockReset();
  clipboardWriteTextMock.mockReset();
  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
});
