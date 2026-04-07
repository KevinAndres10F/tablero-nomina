import { GoogleGenerativeAI } from "@google/generative-ai";

const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash-8b"];

const SYSTEM_PROMPT = `Eres KapiBot, asistente experto en nómina ecuatoriana para el tablero KAPIROLL.

Conoces en profundidad:
- Aportes IESS: personal 9.45%, patronal 11.15%
- Fondos de reserva: 8.33% (después de 1 año de trabajo)
- Décimo tercero (D13): sueldo/12 mensual, se paga en diciembre
- Décimo cuarto (D14): SBU/12 mensual (SBU 2025 = $460), se paga en marzo (Sierra) o abril (Costa)
- Vacaciones: sueldo/24 mensual
- Horas extras: 50% recargo (diurnas) y 100% recargo (nocturnas/feriados)
- Recargo nocturno: 25% adicional
- Préstamos IESS: hipotecarios y quirografarios (se descuentan del rol)
- Tipos de contrato: Fijo, Temporal, Por Obra
- Neto a recibir = Total Ingresos - Total Descuentos

RAZONAMIENTO CAUSAL (OBLIGATORIO):
- Cuando reportes un dato, SIEMPRE explica POR QUE ocurre, no solo QUE ocurre
- Ejemplo MALO: "El área Ventas tiene el mayor costo de nómina"
- Ejemplo BUENO: "Ventas concentra 38% del costo porque tiene 15 empleados con salario promedio $1,200 (22% sobre el promedio general) y acumula 45% de las horas extras totales"
- Si detectas una anomalía (variación >5%, concentración >35%, horas extra atípicas), menciónala proactivamente
- Sugiere UNA acción concreta basada en los datos

MODO INSIGHT (cuando el mensaje del usuario contiene "[INSIGHT_MODE]"):
- Actúa como auditor proactivo, no como asistente reactivo
- Busca: (1) concentraciones de costo >35% en una área, (2) variaciones mensuales >5%, (3) empleados con horas extra atípicas, (4) diferencias significativas entre tipos de contrato
- Responde JSON: {"action": "insights", "insights": [{"titulo": "...", "explicacion": "...", "severidad": "alta|media|baja"}], "message": "resumen ejecutivo"}

INSTRUCCIONES GENERALES:
- Responde SIEMPRE en español
- Usa datos específicos del contexto proporcionado, nunca respuestas genéricas
- Si te preguntan por un dato que está en el contexto, cítalo con cifras exactas
- Sé conciso pero informativo
- Formatea montos con $ y separador de miles
- Responde SIEMPRE con JSON válido: {"action": null, "message": "tu respuesta"}
- Si necesitas hacer una acción especial, usa: {"action": "nombre_accion", "data": {...}, "message": "explicación"}
- No uses markdown dentro del campo message, usa texto plano`;

interface ChatMessage {
  role: "user" | "model";
  content: string;
}

interface RequestBody {
  action: string;
  messages: ChatMessage[];
  pageContext: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonResponse = (statusCode: number, body: any) => ({
  statusCode,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

async function callGemini(apiKey: string, messages: ChatMessage[], pageContext: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Build conversation as plain text to avoid startChat issues
  let conversationText = `${SYSTEM_PROMPT}\n\nCONTEXTO ACTUAL DEL DASHBOARD:\n${pageContext}\n\n`;
  conversationText += "CONVERSACIÓN:\n";

  for (const msg of messages) {
    const prefix = msg.role === "user" ? "USUARIO" : "BOT";
    conversationText += `${prefix}: ${msg.content}\n`;
  }
  conversationText += "BOT:";

  let lastError: Error | null = null;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(conversationText);
      const text = result.response.text();
      return text;
    } catch (err: any) {
      lastError = err;
      const status = err?.status || err?.httpStatusCode || 0;
      // Retry on 429 (rate limit) or 404 (model not found)
      if (status === 429 || status === 404) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error("All models failed");
}

function extractJson(raw: string): { action: string | null; message: string; data?: any } {
  // Try to extract JSON from the response (may be wrapped in markdown code blocks)
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        action: parsed.action || null,
        message: parsed.message || raw,
        ...(parsed.data ? { data: parsed.data } : {}),
      };
    } catch {
      // Fall through to plain text
    }
  }
  return { action: null, message: raw.trim() };
}

exports.handler = async (event: any) => {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, "");
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return jsonResponse(500, { error: "GOOGLE_AI_KEY no configurada", detail: "Agrega GOOGLE_AI_KEY en las variables de entorno de Netlify" });
  }

  let body: RequestBody;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "JSON inválido" });
  }

  const { action, messages, pageContext } = body;

  if (action !== "chat") {
    return jsonResponse(400, { error: `Acción no soportada: ${action}` });
  }

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return jsonResponse(400, { error: "Se requiere al menos un mensaje" });
  }

  try {
    const rawResponse = await callGemini(apiKey, messages, pageContext || "Sin contexto disponible");
    const parsed = extractJson(rawResponse);
    return jsonResponse(200, parsed);
  } catch (err: any) {
    return jsonResponse(500, {
      error: "Error al comunicarse con Gemini",
      detail: err.message || String(err),
    });
  }
};
