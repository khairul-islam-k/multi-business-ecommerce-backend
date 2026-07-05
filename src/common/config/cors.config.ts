export function parseCorsOrigins(value: string) {
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function parseCorsDomainBases(value: string) {
  return value
    .split(",")
    .map((domain) => normalizeHostname(domain))
    .filter(Boolean);
}

type CorsOriginOptions = {
  allowedOrigins: string[];
  allowedSubdomainBases?: string[];
  isAllowedCustomDomain?: (hostname: string) => Promise<boolean>;
};

export function createCorsOrigin(options: CorsOriginOptions) {
  const allowedOrigins = new Set(options.allowedOrigins);
  const allowedSubdomainBases = options.allowedSubdomainBases ?? [];

  return (
    origin: string | undefined,
    callback: (error: Error | null, allow?: boolean) => void,
  ) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    const parsedOrigin = parseHttpOrigin(origin);

    if (
      parsedOrigin &&
      isAllowedSubdomainHostname(parsedOrigin.hostname, allowedSubdomainBases)
    ) {
      callback(null, true);
      return;
    }

    if (!parsedOrigin || !options.isAllowedCustomDomain) {
      callback(new Error(`CORS origin not allowed: ${origin}`), false);
      return;
    }

    void options
      .isAllowedCustomDomain(parsedOrigin.hostname)
      .then((allowed) => {
        if (allowed) {
          callback(null, true);
          return;
        }

        callback(new Error(`CORS origin not allowed: ${origin}`), false);
      })
      .catch(() => {
        callback(new Error(`CORS origin not allowed: ${origin}`), false);
      });
  };
}

function parseHttpOrigin(origin: string) {
  try {
    const url = new URL(origin);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return {
      hostname: normalizeHostname(url.hostname),
    };
  } catch {
    return null;
  }
}

function isAllowedSubdomainHostname(
  hostname: string,
  allowedSubdomainBases: string[],
) {
  return allowedSubdomainBases.some(
    (base) => hostname === base || hostname.endsWith(`.${base}`),
  );
}

function normalizeHostname(value?: string | null) {
  return (
    value
      ?.split(",")[0]
      ?.trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "") || ""
  );
}
