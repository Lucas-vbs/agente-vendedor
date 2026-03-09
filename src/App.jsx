import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Bot, User, Download, Plus, Trash2, Cpu, Zap, Search, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Configuration from .env via Vite if possible, or manual input prompt
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    content: "Olá! Sou o **OrçaElétrico**, seu consultor especialista na Incomel. ⚡\n\nComo posso ajudar com materiais elétricos hoje? Você pode pedir um orçamento completo ou pesquisar itens específicos.",
    timestamp: new Date()
  }
];

export default function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [apiKey, setApiKey] = useState(API_KEY);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Load local products database for client-side search simulation
    // This makes the agent "precise" as requested.
    fetch('./products.json')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Database loading error:", err));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      alert("Por favor, configure sua Google API Key (Gemini) na barra lateral.");
      return;
    }

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // SMART SEARCH STRATEGY: Find relevant products locally first
      const searchTerms = input.toLowerCase()
        .replace(/(preciso de|me vê|tem|queria|gostaria|um|uma|o|a|de|para)/g, '')
        .split(' ')
        .filter(t => t.length > 2);

      let relevantProducts = [];
      if (searchTerms.length > 0) {
        relevantProducts = products.filter(p => {
          const desc = p.descricao.toLowerCase();
          const grupo = p.grupo.toLowerCase();
          return searchTerms.some(term => desc.includes(term) || grupo.includes(term));
        }).slice(0, 25); // Top 25 matches for precision
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `Você é o "OrçaElétrico", o melhor vendedor da Incomel Materiais Elétricos.
        
        DIRETRIZES:
        1. Responda em Português com tom profissional mas prestativo.
        2. Use os DADOS DE PRODUTOS abaixo para dar preços REAIS e precisos. Se o produto não estiver na lista abaixo, informe que não o encontrou no sistema no momento.
        3. Formate orçamentos em listas claras: [CÓDIGO] DESCRIÇÃO - PREÇO / UNIDADE.
        4. No final, ofereça para revisar ou fechar o orçamento.
        5. NÃO INVENTE PREÇOS.
        
        DADOS DE PRODUTOS ENCONTRADOS NO SISTEMA (CONTEÚDO DINÂMICO):
        ${relevantProducts.length > 0 ? JSON.stringify(relevantProducts) : "Nenhum resultado exato na busca primária. Peça detalhes ao cliente."}
        
        NOTA: O cliente é soberano. Se ele pedir algo que você não encontrou, tente sugerir produtos similares da lista se fizer sentido técnico.
        `,
      });

      const chat = model.startChat({
        history: messages.map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
      });

      const result = await chat.sendMessage(input);
      const responseText = result.response.text();

      setMessages(prev => [...prev, {
        role: "assistant",
        content: responseText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Ops! Tive um problema ao processar sua solicitação. Verifique sua conexão ou chave de API.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setMessages(INITIAL_MESSAGES);
  };

  return (
    <div className="flex h-screen bg-[#0d1117] text-[#c9d1d9] font-sans selection:bg-blue-500/30 overflow-hidden">
      {/* Sidebar - History and Tools */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-r border-[#30363d] bg-[#161b22] flex flex-col h-full overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-4 h-full">
              <button
                onClick={startNewChat}
                className="flex items-center gap-3 w-full px-4 py-3 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-xl transition-all font-medium text-sm text-blue-400 group"
              >
                <Plus size={18} className="group-hover:rotate-90 transition-transform" />
                Novo Orçamento
              </button>

              <div className="flex-1 overflow-y-auto space-y-2 mt-2">
                <div className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider px-2 mb-2">Recentes</div>
                <div className="p-3 bg-[#23863620] border border-[#23863640] rounded-lg text-xs flex items-center gap-2 cursor-pointer hover:bg-[#23863630]">
                  <FileText size={14} className="text-[#238636]" />
                  <span className="truncate">Cabo Flexível 2.5mm...</span>
                </div>
              </div>

              <div className="pt-4 border-t border-[#30363d] space-y-3">
                <div className="px-2 space-y-2">
                  <label className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider">Google API Key</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Insira sua chave..."
                    className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  />
                  <p className="text-[10px] text-[#8b949e]">Salva apenas localmente no seu navegador.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center bg-[#0d1117] relative">
        <header className="w-full h-14 border-b border-[#30363d] flex items-center justify-between px-4 bg-[#0d1117]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-[#30363d] rounded-lg text-[#8b949e] transition-colors"
            >
              <Cpu size={20} />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-outfit font-bold text-lg bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Incomel AI</span>
              <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20">AGENT</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-[#8b949e] bg-[#21262d] px-3 py-1.5 rounded-full border border-[#30363d]">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              {products.length ? `${products.length} Produtos Carregados` : "Carregando Base..."}
            </div>
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 w-full max-w-4xl flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 py-8 space-y-6 scrollbar-hide">
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex gap-4 max-w-3xl",
                    m.role === "assistant" ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border",
                    m.role === "assistant" ? "bg-[#21262d] border-[#30363d] text-blue-400" : "bg-blue-600 border-blue-500 text-white"
                  )}>
                    {m.role === "assistant" ? <Zap size={16} /> : <User size={16} />}
                  </div>
                  <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    m.role === "assistant" ? "bg-transparent text-[#e6edf3]" : "bg-[#21262d] text-[#e6edf3] border border-[#30363d]"
                  )}>
                    <div className="prose prose-invert prose-sm max-w-none">
                      {m.content.split('\n').map((line, idx) => (
                        <div key={idx} className="mb-2 whitespace-pre-wrap">{line}</div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-4"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-[#21262d] border-[#30363d] text-blue-400">
                    <Zap size={16} className="animate-spin" />
                  </div>
                  <div className="flex items-center gap-1.5 px-4 py-3">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </AnimatePresence>
          </div>

          {/* Input Interface */}
          <div className="p-4 md:p-6 bg-gradient-to-t from-[#0d1117] via-[#0d1117] to-transparent sticky bottom-0">
            <div className="max-w-4xl mx-auto">
              <div className="relative group">
                <textarea
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Pergunte sobre bitolas, marcas ou peça um orçamento completo..."
                  className="w-full bg-[#21262d]/50 hover:bg-[#21262d]/80 focus:bg-[#21262d] border border-[#30363d] focus:border-blue-500 rounded-2xl px-6 py-4 pr-16 text-sm resize-none outline-none transition-all shadow-xl placeholder:text-[#8b949e]"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className={cn(
                    "absolute right-3 bottom-3 p-2.5 rounded-xl transition-all",
                    input.trim() ? "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-500/20" : "bg-transparent text-[#484f58]"
                  )}
                >
                  <Send size={18} />
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center gap-6 text-[11px] text-[#8b949e]">
                <div className="flex items-center gap-1.5">
                  <Zap size={12} className="text-yellow-500/70" /> Respostas Inteligentes
                </div>
                <div className="flex items-center gap-1.5">
                  <Search size={12} className="text-blue-500/70" /> Base de 3.4k Itens
                </div>
                <div className="flex items-center gap-1.5">
                  <HelpCircle size={12} className="text-green-500/70" /> Orçamentos em PDF
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
