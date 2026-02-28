import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageCircle, Send, X } from "lucide-react";

type MessageRole = "user" | "assistant";

interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
}

interface ChatSuccessResponse {
  ok: true;
  answer: string;
}

interface ChatErrorResponse {
  ok: false;
  error: string;
}

type ChatResponse = ChatSuccessResponse | ChatErrorResponse;

interface KapiBotProps {
  scriptUrl: string;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hola, soy KapiBot. ¿En qué tema de nómina te ayudo hoy?",
};

const createMessageId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export default function KapiBot({ scriptUrl }: KapiBotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping, isOpen]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || isTyping) return;

    const userMessage: ChatMessage = {
      id: createMessageId(),
      role: "user",
      text: question,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "CHAT",
          question,
        }),
      });

      const data = (await response.json()) as ChatResponse;

      if (!response.ok || !data?.ok) {
        const errorText = "error" in data ? data.error : "No se pudo obtener respuesta del asistente.";
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: "assistant",
            text: `Error: ${errorText}`,
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          text: data.answer || "No recibí contenido en la respuesta.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: "assistant",
          text: "Error de conexión con KapiBot. Inténtalo de nuevo en unos segundos.",
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 left-6 z-50">
      {isOpen && (
        <div className="mb-4 w-[340px] rounded-2xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between rounded-t-2xl bg-blue-700 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <h2 className="text-sm font-semibold">KapiBot - Asistente de Nómina</h2>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 transition hover:bg-blue-600"
              aria-label="Cerrar chat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="h-80 space-y-3 overflow-y-auto bg-slate-50 p-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Escribiendo...</span>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") sendMessage();
                }}
                placeholder="Escribe tu pregunta de nómina..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isTyping || !input.trim()}
                className="inline-flex items-center justify-center rounded-xl bg-blue-600 p-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
        aria-label="Abrir KapiBot"
      >
        <MessageCircle className="h-7 w-7" />
      </button>
    </div>
  );
}
