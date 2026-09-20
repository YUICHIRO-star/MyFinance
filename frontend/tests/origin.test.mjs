import test from 'node:test';
import assert from 'node:assert/strict';
import { sameOrigin } from '../src/lib/access.ts';
test('same-origin accepts loopback host and rejects missing, foreign, malformed and downgraded origins', () => {
  assert.equal(sameOrigin('http://127.0.0.1:3092', '127.0.0.1:3092', 'http:'), true);
  assert.equal(sameOrigin('https://finance.example', 'finance.example', 'https:'), true);
  for (const origin of [null, 'null', 'https://other.example', 'http://finance.example', 'https://finance.example/path', 'https://user@finance.example'])
    assert.equal(sameOrigin(origin, 'finance.example', 'https:'), false);
});
