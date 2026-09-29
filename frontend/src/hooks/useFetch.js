import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/**
 * Loads data for `key` (e.g. `project:123`) with `fetcher`, refetching when
 * the key changes or `reload()` is called. `loading` is derived from whether
 * the latest request has settled; on reload the previous data stays visible.
 */
export function useFetch(key, fetcher) {
  // Always call the latest fetcher without making it an effect dependency,
  // so inline arrow functions don't trigger a refetch on every render.
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const [result, setResult] = useState({ key: null, request: null, data: null, error: null });
  const request = `${key}#${nonce}`;

  useEffect(() => {
    let cancelled = false;
    fetcherRef.current().then(
      (data) => !cancelled && setResult({ key, request, data, error: null }),
      (error) => !cancelled && setResult({ key, request, data: null, error }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, request]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const sameKey = result.key === key;

  return {
    data: sameKey ? result.data : null,
    error: result.request === request ? result.error : null,
    loading: result.request !== request,
    reload,
  };
}
