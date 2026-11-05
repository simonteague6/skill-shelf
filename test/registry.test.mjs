import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { publicationNeeded, assertLatestNotNewer } from '../scripts/registry.mjs';

test('an unpublished older version cannot replace the registry latest tag', async () => {
  const server = createServer((request, response) => {
    response.writeHead(request.url.endsWith('/1.2.3') ? 404 : 200, {
      'Content-Type': 'application/json',
    });
    response.end(JSON.stringify({ name: 'pkg', 'dist-tags': { latest: '1.3.0' } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    assert.equal(
      await publicationNeeded('pkg', '1.2.3', `http://127.0.0.1:${server.address().port}`),
      true,
    );
    await assert.rejects(
      () => assertLatestNotNewer('pkg', '1.2.3', `http://127.0.0.1:${server.address().port}`),
      /latest/,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('latest comparison handles numeric ordering and fails closed on invalid metadata or registry errors', async () => {
  let status = 200;
  let body = { name: 'pkg', 'dist-tags': { latest: '1.9.9' } };
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(typeof body === 'string' ? body : JSON.stringify(body));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const check = (version = '1.10.0') =>
    assertLatestNotNewer('pkg', version, `http://127.0.0.1:${server.address().port}`);
  try {
    await check();
    await check('1.9.9');
    for (body of [
      {},
      { name: 'pkg' },
      { name: 'pkg', 'dist-tags': {} },
      { name: 'pkg', 'dist-tags': { latest: 123 } },
      { name: 'other', 'dist-tags': { latest: '1.0.0' } },
      { name: 'pkg', 'dist-tags': { latest: '1.0.0-beta.1' } },
      { name: 'pkg', 'dist-tags': { latest: '01.0.0' } },
      'not json',
    ])
      await assert.rejects(() => check());
    body = { name: 'pkg', 'dist-tags': { latest: '1.0.0' } };
    await assert.rejects(() => check('1.0.0-beta'));
    for (status of [404, 429, 500])
      await assert.rejects(() => check(), /Registry latest lookup failed/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  await assert.rejects(() => assertLatestNotNewer('pkg', '1.0.0', 'http://127.0.0.1:1'));
});

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
