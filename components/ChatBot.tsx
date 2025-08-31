import React, { useState, useRef, useEffect } from 'react';
import type { Product, Sale, ChatMessage } from '../types';
import { getChat } from '../lib/gemini';
import { SparklesIcon, XIcon, SendIcon } from './icons/Icons';

interface ChatBotProps {
  sales: Sale[];
  products: Product[];
}

const ChatBot: React.FC<ChatBotProps> = ({ sales, products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'model',
      text: "Hi! I'm PYJ-AI. Ask me anything about your sales or inventory.",
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const chat = getChat();
      const contextMessage = `Here is the current data context:
Sales data (last 50 sales): ${JSON.stringify(sales.slice(0, 50))}
Inventory data: ${JSON.stringify(products)}

Please answer the following user question based on this data:
${input}`;
      
      const stream = await chat.sendMessageStream({ message: contextMessage });
      
      let newModelMessage = '';
      setMessages(prev => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of stream) {
        newModelMessage += chunk.text;
        setMessages(prev => {
            const newMessages = [...prev];
            newMessages[newMessages.length - 1] = { role: 'model', text: newModelMessage };
            return newMessages;
        });
      }

    } catch (error) {
      console.error("Gemini API error:", error);
      const errorMessage: ChatMessage = { role: 'model', text: "Sorry, I encountered an error. Please try again." };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className={`fixed bottom-0 right-0 m-4 sm:m-6 z-40 transition-all duration-300 ease-in-out ${isOpen ? 'opacity-0 scale-90' : 'opacity-100 scale-100'}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 text-white rounded-full p-4 shadow-lg hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-indigo-500 transform transition-transform hover:scale-110"
          aria-label="Open AI Assistant"
        >
          <SparklesIcon />
        </button>
      </div>

      <div className={`fixed bottom-0 right-0 m-4 sm:m-6 z-50 w-[calc(100%-2rem)] max-w-md bg-slate-800/80 backdrop-blur-md rounded-xl shadow-2xl transition-all duration-300 ease-in-out ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}`}>
        <div className="flex flex-col h-[70vh] max-h-[600px]">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-slate-700">
            <h3 className="font-bold text-white flex items-center gap-2">
              <SparklesIcon /> PYJ AI Assistant
            </h3>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white" aria-label="Close chat">
              <XIcon />
            </button>
          </header>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'}`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              ))}
               {isLoading && messages[messages.length - 1].role === 'user' && (
                <div className="flex justify-start">
                    <div className="bg-slate-700 text-slate-200 rounded-lg px-4 py-2">
                        <span className="animate-pulse">...</span>
                    </div>
                </div>
               )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input */}
          <footer className="p-4 border-t border-slate-700">
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about sales, inventory..."
                className="flex-1 bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-indigo-600 text-white rounded-lg p-2 disabled:bg-slate-600 disabled:cursor-not-allowed hover:bg-indigo-500 transition-colors"
                aria-label="Send message"
              >
                <SendIcon />
              </button>
            </form>
          </footer>
        </div>
      </div>
    </>
  );
};

export default ChatBot;