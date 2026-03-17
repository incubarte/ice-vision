import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock BroadcastChannel since it's not available in jsdom
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent) => void) | null = null;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: any) {
    // In a real mock, we could track messages or trigger other instances
  }

  close() {
    // Close logic
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() { return true; }
}

global.BroadcastChannel = MockBroadcastChannel as any;

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
