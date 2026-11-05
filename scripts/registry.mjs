export async function publicationNeeded(name, version, registry = 'https://registry.npmjs.org') {
  const response = await fetch(
    `${registry}/${encodeURIComponent(name)}/${encodeURIComponent(version)}`,
    {
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (response.status === 404) {
    await response.body?.cancel();
    return true;
  }
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Registry lookup failed: HTTP ${response.status}`);
  }
  const published = await response.json();
  if (published.name !== name || published.version !== version) {
    throw new Error('Registry returned unexpected package metadata.');
  }
  return false;
}

export async function assertLatestNotNewer(name, version, registry = 'https://registry.npmjs.org') {
  const parse = (value) => {
    if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) {
      throw new Error('Invalid stable version in registry metadata or release');
    }
    return value.split('.').map(BigInt);
  };
  const target = parse(version);
  const response = await fetch(`${registry}/${encodeURIComponent(name)}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`Registry latest lookup failed: HTTP ${response.status}`);
  }
  const metadata = await response.json();
  if (metadata?.name !== name) throw new Error('Unexpected registry package metadata');
  const latest = parse(metadata['dist-tags']?.latest);
  for (let i = 0; i < 3; i++) {
    if (target[i] < latest[i]) throw new Error('Release is older than registry latest');
    if (target[i] > latest[i]) return;
  }
}
