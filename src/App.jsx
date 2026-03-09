import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Send, Bot, User, Download, Plus, Trash2, Cpu, Zap, Search, HelpCircle, FileText, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

import { jsPDF } from "jspdf";
import "jspdf-autotable";

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
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('orca_api_key') || '');
  const [isKeySaved, setIsKeySaved] = useState(!!localStorage.getItem('orca_api_key'));
  const [notification, setNotification] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = "success") => {
    setNotification({ message, type });
  };

  const saveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem('orca_api_key', apiKey.trim());
      setIsKeySaved(true);
      showNotification("Chave de API salva com sucesso! 🛡️");
    }
  };

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

  const generatePDF = (content) => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(33, 134, 54); // Incomel Green
      doc.text("Incomel Materiais Elétricos", 105, 20, { align: "center" });

      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text("Orçamento Inteligente AI", 105, 28, { align: "center" });

      doc.setDrawColor(200);
      doc.line(20, 35, 190, 35);

      // Extract items from content if any
      const lines = content.split('\n');
      const tableData = [];
      lines.forEach(line => {
        const itemMatch = line.match(/\[(.*?)\]\s+(.*?)\s+-\s+([\d,.]+)\s+\/\s+(\w+)/);
        if (itemMatch) {
          tableData.push([itemMatch[1], itemMatch[2], itemMatch[3], itemMatch[4]]);
        }
      });

      if (tableData.length > 0) {
        doc.autoTable({
          startY: 45,
          head: [['Código', 'Descrição', 'Preço Unit.', 'Unidade']],
          body: tableData,
          theme: 'grid',
          headStyles: { fillStyle: [33, 134, 54] }
        });
      } else {
        doc.setFontSize(10);
        doc.setTextColor(0);
        const splitText = doc.splitTextToSize(content, 170);
        doc.text(splitText, 20, 45);
      }

      const dateStr = new Date().toLocaleDateString('pt-BR');
      doc.setFontSize(8);
      doc.text(`Gerado em: ${dateStr}`, 20, doc.internal.pageSize.height - 10);

      doc.save(`Orcamento_Incomel_${Date.now()}.pdf`);
      showNotification("PDF gerado com sucesso!");
    } catch (error) {
      console.error("PDF Error:", error);
      showNotification("Erro ao gerar PDF", "error");
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    if (!apiKey) {
      showNotification("Por favor, configure sua Google API Key (Gemini) na barra lateral.", "error");
      return;
    }

    const userMessage = {
      role: "user",
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      // SMART SEARCH STRATEGY: Find relevant products locally first
      const cleanInput = currentInput.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/(preciso de|me ve|tem|queria|gostaria|um|uma|o|a|de|para|com|preco|quanto|custa)/g, '');

      const searchTerms = cleanInput.split(/\s+/).filter(t => t.length > 2);

      let relevantProducts = [];
      if (searchTerms.length > 0) {
        relevantProducts = products.filter(p => {
          const desc = p.descricao.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          const grupo = p.grupo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return searchTerms.some(term => desc.includes(term) || grupo.includes(term));
        });

        // Smart Sort: prioritize those that match multiple terms
        relevantProducts.sort((a, b) => {
          const aMatch = searchTerms.filter(t => a.descricao.toLowerCase().includes(t)).length;
          const bMatch = searchTerms.filter(t => b.descricao.toLowerCase().includes(t)).length;
          return bMatch - aMatch;
        });

        relevantProducts = relevantProducts.slice(0, 30);
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.0-flash",
        systemInstruction: `Você é o "OrçaElétrico", o melhor vendedor da Incomel Materiais Elétricos.
        
        DIRETRIZES:
        1. Responda em Português com tom profissional mas prestativo.
        2. Use os DADOS DE PRODUTOS abaixo para dar preços REAIS e precisos. 
        3. Formate orçamentos RIGOROSAMENTE assim para que o sistema gere o PDF: [CÓDIGO] DESCRIÇÃO - PREÇO / UNIDADE.
        4. Sempre que listar produtos, ofereça o botão de download de PDF (o sistema mostrará automaticamente se o formato estiver correto).
        
        DADOS DE PRODUTOS ENCONTRADOS NO SISTEMA:
        ${relevantProducts.length > 0 ? JSON.stringify(relevantProducts) : "Nenhum resultado exato na busca primária. Peça detalhes ao cliente (bitola, marca, etc)."}
        `,
      });

      const history = messages
        .map(m => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }))
        .filter((_, idx, arr) => {
          // Find the first index where role is 'user'
          const firstUserIdx = arr.findIndex(item => item.role === 'user');
          return idx >= firstUserIdx;
        });

      const chat = model.startChat({ history });

      const result = await chat.sendMessage(currentInput);
      const responseText = result.response.text();

      setMessages(prev => [...prev, {
        role: "assistant",
        content: responseText,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error("Gemini Error:", error);
      let errorMsg = "Ops! Tive um problema técnico.";

      if (error.message?.includes("API_KEY_INVALID")) {
        errorMsg = "Chave de API inválida! Verifique se copiou corretamente do Google AI Studio.";
      } else if (error.message?.includes("429") || error.message?.includes("QUOTA")) {
        errorMsg = "Limite de uso atingido. Tente novamente em alguns segundos.";
      } else {
        errorMsg = `Erro: ${error.message?.substring(0, 50)}...`;
      }

      setMessages(prev => [...prev, {
        role: "assistant",
        content: errorMsg,
        timestamp: new Date()
      }]);
      showNotification(errorMsg, "error");
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
                  <label className="text-[10px] font-bold text-[#8b949e] uppercase tracking-wider flex items-center justify-between">
                    Google API Key
                    {isKeySaved && <span className="text-green-500 font-bold">✓ Salva</span>}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => {
                        setApiKey(e.target.value);
                        setIsKeySaved(false);
                      }}
                      placeholder="Insira sua chave..."
                      className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    />
                    <button
                      onClick={saveApiKey}
                      className="p-2 bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] rounded-lg text-blue-400 transition-colors"
                      title="Salvar Chave"
                    >
                      <Zap size={14} fill={isKeySaved ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#8b949e]">
                    Salva apenas localmente no seu navegador.
                  </p>
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
                    {m.role === "assistant" && m.content.includes('[') && m.content.includes(']') && (
                      <button
                        onClick={() => generatePDF(m.content)}
                        className="mt-3 flex items-center gap-2 px-3 py-1.5 bg-[#238636] hover:bg-[#2eaa42] text-white rounded-lg text-xs font-bold transition-all shadow-lg"
                      >
                        <Download size={14} />
                        Baixar Orçamento em PDF
                      </button>
                    )}
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

      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={cn(
              "fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl shadow-2xl z-[100] font-medium text-sm flex items-center gap-3 backdrop-blur-xl border",
              notification.type === "error" ? "bg-red-500/20 text-red-400 border-red-500/30" : "bg-[#23863620] text-green-400 border-green-500/30"
            )}
          >
            <div className={cn(
              "w-2 h-2 rounded-full animate-pulse",
              notification.type === "error" ? "bg-red-500" : "bg-green-500"
            )}></div>
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
