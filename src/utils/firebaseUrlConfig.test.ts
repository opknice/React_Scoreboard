import { describe, expect, it } from 'vitest';
import { parseFirebaseConfigFromSearchParams } from './firebaseUrlConfig';

describe('parseFirebaseConfigFromSearchParams', () => {
  it('parses URL-safe base64 Firebase config', () => {
    const encoded = btoa(JSON.stringify({ databaseURL: 'https://example.test' }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const params = new URLSearchParams({ fb: encoded });

    expect(parseFirebaseConfigFromSearchParams(params)).toEqual({ databaseURL: 'https://example.test' });
  });

  it('supports encoded JSON fallback and invalid input', () => {
    const params = new URLSearchParams({ firebaseConfig: encodeURIComponent(JSON.stringify({ projectId: 'demo' })) });
    expect(parseFirebaseConfigFromSearchParams(params)).toEqual({ projectId: 'demo' });
    expect(parseFirebaseConfigFromSearchParams(new URLSearchParams({ fb: 'not-json' }))).toBeNull();
  });
});
