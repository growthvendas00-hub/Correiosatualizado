import { useState } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import carolImg from "@/assets/carol-assistant.png";

const QUICK_QUESTIONS = [
  "Como rastrear minha encomenda?",
  "Minha encomenda foi taxada, o que fazer?",
  "Quanto tempo demora a entrega?",
  "Como pagar a taxa de importação?",
  "Posso alterar o endereço de entrega?",
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

const RESPONSES: Record<string, string> = {
  "Como rastrear minha encomenda?":
    "Para rastrear sua encomenda, basta inserir o código de rastreio no campo acima e clicar em 'Consultar Encomendas Agora'. O código geralmente começa e termina com duas letras (ex: BR123456789BR).",
  "Minha encomenda foi taxada, o que fazer?":
    "Se sua encomenda foi taxada, você precisa pagar a taxa de importação para liberá-la. Consulte seu código de rastreio acima para verificar o valor da taxa e efetuar o pagamento.",
  "Quanto tempo demora a entrega?":
    "O prazo de entrega varia conforme a origem e destino. Encomendas nacionais levam de 3 a 10 dias úteis. Importações podem levar de 15 a 45 dias úteis após o desembaraço aduaneiro.",
  "Como pagar a taxa de importação?":
    "Após consultar seu rastreio e confirmar seu CPF, você será direcionado para a página de pagamento onde poderá pagar a taxa de forma segura.",
  "Posso alterar o endereço de entrega?":
    "Sim! Durante o processo de consulta, você poderá informar ou atualizar o endereço de entrega da sua encomenda.",
};

const CarolChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá, eu sou a Carol! Em que posso ajudar? 😊" },
  ]);
  const [input, setInput] = useState("");

  const handleQuickQuestion = (question: string) => {
    const userMsg: Message = { role: "user", content: question };
    const botMsg: Message = {
      role: "assistant",
      content: RESPONSES[question] || "Desculpe, não entendi. Tente outra pergunta!",
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    const botMsg: Message = {
      role: "assistant",
      content: "Obrigada pela sua mensagem! Para consultar sua encomenda, utilize o campo de rastreio acima. Se precisar de mais ajuda, estou aqui! 😊",
    };
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInput("");
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full px-4 py-3 shadow-lg hover:shadow-xl transition-shadow"
            style={{ background: "#FFD400", color: "#1a1a1a" }}
          >
            <MessageCircle className="h-5 w-5" />
            <span className="text-sm font-bold">Fale com a Carol</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ duration: 0.25 }}
            className="fixed bottom-5 right-5 z-50 w-[360px] max-h-[520px] rounded-2xl overflow-hidden flex flex-col"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3" style={{ background: "#FFD400" }}>
              <div className="h-10 w-10 rounded-full overflow-hidden bg-white flex-shrink-0">
                <img src={carolImg} alt="Carol" className="h-full w-full object-cover object-top" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold" style={{ color: "#1a1a1a" }}>Carol — Assistente Virtual</p>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-green-600" />
                  <span className="text-[10px]" style={{ color: "rgba(0,0,0,0.5)" }}>Online</span>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="transition-colors" style={{ color: "rgba(0,0,0,0.4)" }}>
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: "#f5f5f0", maxHeight: "300px" }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      background: msg.role === "user" ? "#FFD400" : "#fff",
                      color: msg.role === "user" ? "#ffffff" : "#1a1a1a",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                    }}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick questions */}
            <div className="px-3 py-2 flex flex-wrap gap-1.5" style={{ background: "#f5f5f0", borderTop: "1px solid #e5e5e0" }}>
              <p className="text-[9px] font-bold text-muted-foreground w-full mb-0.5">Perguntas frequentes:</p>
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleQuickQuestion(q)}
                  className="text-[10px] font-medium px-2.5 py-1.5 rounded-full border transition-colors hover:bg-white"
                  style={{ borderColor: "#FFD400", color: "#FFD400", background: "rgba(0,85,255,0.08)" }}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: "#fff", borderTop: "1px solid #e5e5e0" }}>
              <input
                className="flex-1 text-xs px-3 py-2 rounded-full border border-gray-200 outline-none focus:border-blue-500 transition-colors"
                placeholder="Digite sua mensagem..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <button
                onClick={handleSend}
                className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                style={{ background: "#FFD400", color: "#1a1a1a" }}
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default CarolChat;
