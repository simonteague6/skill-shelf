import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { publicationNeeded } from '../scripts/registry.mjs';

test('registry lookup skips a version that is already published', async () => {
  const server = createServer((request, response) => {
    assert.equal(request.url, '/%40simonteague6%2Fskill-shelf/1.2.3');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ name: '@simonteague6/skill-shelf', version: '1.2.3' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal(
      await publicationNeeded(
        '@simonteague6/skill-shelf',
        '1.2.3',
        `http://127.0.0.1:${server.address().port}`,
      ),
      false,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('registry lookup allows a missing version but fails closed on outages and malformed responses', async () => {
  let status = 404;
  let body = '{}';
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(body);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const lookup = () =>
    publicationNeeded(
      '@simonteague6/skill-shelf',
      '1.2.3',
      `http://127.0.0.1:${server.address().port}`,
    );
  try {
    assert.equal(await lookup(), true);
    for (status of [401, 403, 429, 500, 503]) {
      await assert.rejects(lookup, /Registry lookup failed/);
    }
    status = 200;
    await assert.rejects(lookup, /unexpected package metadata/);
    body = 'not json';
    await assert.rejects(lookup, SyntaxError);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await assert.rejects(
    () => publicationNeeded('@simonteague6/skill-shelf', '1.2.3', 'http://127.0.0.1:1'),
    /fetch failed/,
  );
});
