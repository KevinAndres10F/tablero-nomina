export interface ChatMessage {
  role: "user" | "model";
  content: string;
}

export interface BotResponse {
  action: string | null;
  message: string;
  data?: Record<string, unknown>;
}

export async function chatWithBot(
  messages: ChatMessage[],
  pageContext: string
): Promise<BotResponse> {
  const res = await fetch("/.netlify/functions/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "chat",
      messages,
      pageContext,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.detail || data.error || `Error ${res.status}`);
  }

  return {
    action: data.action || null,
    message: data.message || "Sin respuesta",
    ...(data.data ? { data: data.data } : {}),
  };
}
