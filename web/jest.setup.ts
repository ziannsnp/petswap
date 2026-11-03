import { TextDecoder, TextEncoder } from 'node:util';
import '@testing-library/jest-dom';

// jsdom's globals don't include these (react-router-dom needs them at import time),
// unlike real browsers and Node itself.
if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder as unknown as typeof globalThis.TextEncoder;
  globalThis.TextDecoder = TextDecoder as unknown as typeof globalThis.TextDecoder;
}
