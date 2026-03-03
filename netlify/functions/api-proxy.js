const normalizeBackendOrigin = (rawOrigin) => {
  if (!rawOrigin) return "";

  const trimmed = rawOrigin.trim();
  if (!trimmed) return "";

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/api\/?$/i, "").replace(/\/$/, "");
};

const proxyRequest = async (targetUrl, event, timeoutMs) => {
  const headers = { ...event.headers };
  delete headers.host;
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-nf-client-connection-ip"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
      signal: controller.signal,
    });
    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } finally {
    clearTimeout(timeout);
  }
};

exports.handler = async (event) => {
  const backendOrigin = normalizeBackendOrigin(process.env.BACKEND_API_ORIGIN || "");

  if (!backendOrigin) {
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "Falta la variable BACKEND_API_ORIGIN en Netlify"
      })
    };
  }

  const rawSplat = event.path.replace(/^\/\.netlify\/functions\/api-proxy\/?/, "");
  const splat = rawSplat.replace(/^\/+/, "").replace(/^api\/+/, "");
  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const targetUrl = splat
    ? `${backendOrigin}/api/${splat}${query}`
    : `${backendOrigin}/api${query}`;

  const timeoutMs = Number(process.env.BACKEND_PROXY_TIMEOUT_MS || 15000);

  try {
    return await proxyRequest(targetUrl, event, timeoutMs);
  } catch (error) {
    try {
      return await proxyRequest(targetUrl, event, timeoutMs);
    } catch (retryError) {
      return {
        statusCode: 502,
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          ok: false,
          error: "No se pudo conectar con el backend en Hetzner",
          detail: retryError.message,
          target: targetUrl
        })
      };
    }
  }
};
