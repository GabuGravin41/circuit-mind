
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isLoading: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0f0f11]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="mt-10 p-6 rounded-2xl border border-dashed border-zinc-800 text-center space-y-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mx-auto text-sky-500">
               <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.38 8.38 0 0 1 3.8.9L21 3z"></path></svg>
            </div>
            <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Co-Pilot Terminal Online</p>
            <p className="text-xs text-zinc-500 leading-relaxed italic">"Define a requirement, and I will synthesize the schematic topology."</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-2.5 text-xs shadow-sm border ${
              msg.role === 'user' 
                ? 'bg-sky-500 border-sky-400 text-white font-medium' 
                : msg.isError 
                    ? 'bg-red-500/10 border-red-500/30 text-red-400' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-300 leading-relaxed'
            }`}>
              {msg.text}
              <div className={`text-[8px] mt-1 opacity-50 font-mono ${msg.role === 'user' ? 'text-white' : 'text-zinc-500'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="bg-zinc-900 border border-sky-500/30 text-sky-400 px-4 py-3 rounded-2xl text-[10px] font-bold flex items-center gap-3 animate-pulse shadow-glow shadow-sky-500/5">
                    <div className="flex gap-1">
                        <div className="w-1 h-1 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}} />
                        <div className="w-1 h-1 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}} />
                        <div className="w-1 h-1 bg-sky-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}} />
                    </div>
                    SYNTHESIZING NETLIST...
                </div>
            </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 bg-zinc-950/50 border-t border-zinc-800/40">
        <div className="relative group">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Command design synthesis..."
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/5 transition-all"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-sky-500 hover:bg-sky-400 disabled:opacity-30 disabled:hover:bg-sky-500 text-white p-1.5 rounded-lg transition-colors shadow-lg shadow-sky-500/20"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;
