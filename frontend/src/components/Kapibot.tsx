import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, X, Send, Loader2, Sparkles } from "lucide-react";
import { chatWithBot, type ChatMessage } from "../lib/aiClient";

interface DisplayMessage {
  id: number;
  role: "user" | "bot";
  text: string;
}

const WELCOME_MESSAGE: DisplayMessage = {
  id: 0,
  role: "bot",
  text: "Hola 👋 Soy KapiBot, tu asistente de nómina. Puedo ayudarte con datos del dashboard, cálculos IESS, provisiones y más. ¿En qué te ayudo?",
};

const QUICK_PROMPTS = [
  "¿Cuál es el costo total de nómina?",
  "¿Qué área tiene más horas extras?",
  "Resumen de provisiones",
  "¿Cuántos empleados hay?",
];

interface KapibotProps {
  getContext: () => string;
}

export default function Kapibot({ getContext }: KapibotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [insightMode, setInsightMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextId = useRef(1);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: DisplayMessage = { id: nextId.current++, role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) textareaRef.current.style.height = "auto";

    // Build conversation history for AI
    const history: ChatMessage[] = messages
      .filter((m) => m.id > 0) // skip welcome
      .map((m) => ({
        role: m.role === "user" ? ("user" as const) : ("model" as const),
        content: m.text,
      }));
    const contentToSend = insightMode ? `[INSIGHT_MODE] ${trimmed}` : trimmed;
    history.push({ role: "user", content: contentToSend });

    try {
      const context = getContext();
      const response = await chatWithBot(history, context);
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "bot", text: response.message },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { id: nextId.current++, role: "bot", text: `Error: ${err.message}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };

  const showQuickPrompts = messages.length <= 2;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg hover:shadow-xl transition-shadow"
            aria-label="Abrir KapiBot"
          >
            <Bot className="h-6 w-6" />
            {/* Ping animation */}
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-30" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 right-6 z-50 flex w-[360px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ maxHeight: "560px" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <span className="text-sm font-semibold">KapiBot</span>
                <span className="flex h-2 w-2 rounded-full bg-green-400">
                  <span className="inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setInsightMode(!insightMode)}
                  className={`rounded-full p-1 transition ${insightMode ? "bg-amber-400/30 ring-1 ring-amber-300" : "hover:bg-white/20"}`}
                  aria-label={insightMode ? "Desactivar modo insight" : "Activar modo insight"}
                  title="Modo Insight: analisis causal profundo"
                >
                  <Sparkles className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-full p-1 transition hover:bg-white/20"
                  aria-label="Cerrar chat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4" style={{ maxHeight: "380px" }}>
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-indigo-400"
                        animate={{ y: [0, -6, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            {showQuickPrompts && (
              <div className="flex flex-wrap gap-1.5 border-t border-slate-100 bg-slate-50 px-3 py-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => sendMessage(prompt)}
                    disabled={isLoading}
                    className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="border-t border-slate-200 bg-white p-3 rounded-b-2xl">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleTextareaInput}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribe tu pregunta..."
                  rows={1}
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
                  style={{ maxHeight: "120px" }}
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  aria-label="Enviar mensaje"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="rounded-b-2xl bg-slate-50 px-3 py-1.5 text-center text-[10px] text-slate-400">
              Bot puede cometer errores · KAPIROLL AI
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
