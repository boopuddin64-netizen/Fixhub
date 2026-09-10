import React, { useState, useEffect, useRef } from 'react';
import { MessageItem, User } from '../../types';
import { ApiClient } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Send,
  X,
  MessageSquare,
  Sparkles,
  Paperclip,
  CheckCircle2,
  Lock
} from 'lucide-react';

interface RepairChatDrawerProps {
  repairId: string;
  isOpen: boolean;
  onClose: () => void;
  otherPartyName: string;
}

export const RepairChatDrawer: React.FC<RepairChatDrawerProps> = ({
  repairId,
  isOpen,
  onClose,
  otherPartyName,
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!user) return;
    try {
      const list = await ApiClient.getMessages(repairId);
      setMessages(list || []);
    } catch (err) {
      // Silently catch in polling loop
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, repairId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    setIsSending(true);
    try {
      await ApiClient.sendMessage(repairId, inputText.trim());
      setInputText('');
      fetchMessages();
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      id="chat-drawer-backdrop"
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex justify-end"
      onClick={onClose}
    >
      <div
        id="chat-drawer-content"
        className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
              {otherPartyName.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">{otherPartyName}</h3>
              <p className="text-[11px] text-cyan-300 font-medium">Repair #{repairId}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security / Escrow Protection Subheader */}
        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100 flex items-center gap-2 text-[11px] text-emerald-900">
          <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Keep all conversations here. Fixhub records ensure buyer protection.</span>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400">
              <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>No messages yet. Send a greeting or ask a question about your device!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                      isMe
                        ? 'bg-blue-600 text-white rounded-br-xs'
                        : 'bg-slate-100 text-slate-900 rounded-bl-xs'
                    }`}
                  >
                    <p>{msg.text}</p>
                    {msg.attachmentUrl && (
                      <img src={msg.attachmentUrl} alt="Attachment" className="mt-2 rounded-lg max-h-40 object-cover" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 flex items-center gap-2 bg-slate-50">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 p-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm transition-all disabled:opacity-50 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
