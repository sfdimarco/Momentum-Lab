import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Sparkles, X, Bot, User, MessageSquare, Lightbulb, Code } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TutorAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceXml?: string;
}

const TutorAssistant: React.FC<TutorAssistantProps> = ({ isOpen, onClose, workspaceXml }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hi! I'm your Momentum Lab Tutor. I can help you understand blocks, debug your logic, or suggest fun challenges. What would you like to build today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const model = "gemini-3-flash-preview";
      
      const systemInstruction = `
        You are a friendly and encouraging STEAM Tutor for "Momentum Lab", a block-based game engine.
        Your goal is to help students (ages 8-14) learn programming concepts through game design.
        
        Available Blocks in Momentum Lab:
        - Events: "When Game Starts", "Every Frame", "When Key Pressed", "When Sprites Collide".
        - Motion: "Move Sprite", "Rotate Sprite", "Flip Sprite".
        - Looks: "Change Appearance" (PULSE, GHOST, RAINBOW), "Display Text", "Play Sound", "Flash Screen", "Create Particles".
        - Physics: "Bounce if on edge", "Set Gravity", "Set Friction", "Shake Sprite".
        - Logic: "If/Then", Comparisons, AND/OR, "Key is pressed?".
        - Data: "My Sprite ID", "DB: Set/Get" (Global Database), "Set/Get/Change Variable" (Local Sprite Variables).
        - Groups: "Add Sprite to Group", "Move Group", "Rotate Group".
        - Sprites: "Create Sprite", "Create Block", "Get/Set Sprite Property", "Tween Sprite".
        - Camera: "Camera Follow".
        
        Context:
        - The user is using a blockly-based editor.
        - The engine handles physics (gravity, friction, collisions), sprites, groups, and local variables.
        - You can see the current workspace XML below to give specific advice.
        
        Guidelines:
        - Be encouraging and use emojis. 🚀✨
        - Explain *why* things work (e.g., "Gravity pulls things down because...").
        - If the user is stuck, suggest a small "Challenge" (e.g., "Can you make the sprite jump when you press Space?").
        - Keep responses concise and readable. Use bullet points for steps.
        
        Current Workspace State (XML):
        ${workspaceXml || "Empty workspace"}
      `;

      const response = await ai.models.generateContent({
        model,
        contents: messages.concat({ role: 'user', content: userMessage }).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
        })),
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      const aiText = response.text || "I'm sorry, I'm having trouble thinking right now. Can you try again?";
      setMessages(prev => [...prev, { role: 'assistant', content: aiText }]);
    } catch (error) {
      console.error("Tutor Error:", error);
      setMessages(prev => [...prev, { role: 'assistant', content: "Oops! Something went wrong on my end. Let's try that again." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-[60] flex flex-col border-l border-slate-200"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-50">
            <div className="flex items-center gap-2">
              <div className="bg-blue-600 p-2 rounded-lg text-white">
                <Bot size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Lab Assistant</h3>
                <p className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">AI Tutor Online</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/50 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50"
          >
            {messages.map((msg, i) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] p-3 rounded-2xl shadow-sm text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
                }`}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm flex gap-1">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
            <button 
              onClick={() => setInput("Explain my code")}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Code size={12} /> Explain Code
            </button>
            <button 
              onClick={() => setInput("Give me a challenge")}
              className="whitespace-nowrap px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Lightbulb size={12} /> Challenge Me
            </button>
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="relative">
              <input
                type="text"
                placeholder="Ask your tutor..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-all"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TutorAssistant;
