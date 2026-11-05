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
