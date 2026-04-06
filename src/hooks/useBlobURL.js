import { useEffect, useState } from 'react';

/**
 * Creates a stable object URL from a Blob and revokes it on cleanup.
 * Returns null if blob is null/undefined.
 */
export function useBlobURL(blob) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return url;
}
