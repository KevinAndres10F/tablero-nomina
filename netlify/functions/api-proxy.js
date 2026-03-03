exports.handler = async (event) => {
  const backendOrigin = (process.env.BACKEND_API_ORIGIN || "").replace(/\/$/, "");

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

  const splat = event.path.replace(/^\/\.netlify\/functions\/api-proxy\/?/, "");
  const query = event.rawQuery ? `?${event.rawQuery}` : "";
  const targetUrl = `${backendOrigin}/api/${splat}${query}`;

  const headers = { ...event.headers };
  delete headers.host;
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-proto"];
  delete headers["x-nf-client-connection-ip"];

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers,
      body: ["GET", "HEAD"].includes(event.httpMethod) ? undefined : event.body,
    });

    const responseBody = await response.text();
    const responseHeaders = Object.fromEntries(response.headers.entries());

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: responseBody,
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "No se pudo conectar con el backend en Hetzner",
        detail: error.message
      })
    };
  }
};
