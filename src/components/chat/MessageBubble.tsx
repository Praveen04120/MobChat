import { useState, useRef, useEffect } from "react";
import { ChevronDown, Reply, Copy } from "lucide-react";
import { Message } from "./types";

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onReply: (msg: Message) => void;
  onCopy: (msg: Message) => void;
  onQuoteClick: (messageId: string) => void;
}

const safeLinkify = (text: string) => {
  const urlRegex = /((?:https?:\/\/|www\.)[^\s]+)/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      let href = part;
      if (part.toLowerCase().startsWith("www.")) {
        href = "https://" + part;
      }
      return (
        <a 
          key={i} 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="underline decoration-1 underline-offset-2 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()} // Prevent selecting message when clicking link
        >
          {part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
};

export function MessageBubble({ 
  message, 
  isMine, 
  isSelected,
  onSelect,
  onReply, 
  onCopy,
  onQuoteClick
}: MessageBubbleProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        chevronRef.current && !chevronRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy(message);
    setMenuOpen(false);
  };

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(message);
    setMenuOpen(false);
  };

  return (
    <div 
      className={`flex flex-col relative group transition-colors rounded-lg ${isSelected ? 'bg-[#EEB2B2]/20' : ''} ${isMine ? "items-end" : "items-start"}`}
    >
      {!isMine && (
        <span className="text-xs text-gray-500 font-medium ml-1 mb-1">{message.senderName}</span>
      )}
      
      <div 
        className={`max-w-[85%] sm:max-w-[70%] rounded-2xl shadow-sm text-sm relative ${
          isMine 
            ? "bg-[#D48989] text-gray-900 rounded-tr-sm" 
            : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm"
        }`}
        style={{ wordBreak: 'break-word' }}
      >
        {/* Chevron */}
        <button
          ref={chevronRef}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
          className={`absolute top-1 right-2 p-0.5 rounded-full bg-black/5 hover:bg-black/10 text-gray-600 transition-opacity z-10 
            ${menuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 sm:opacity-0 focus:opacity-100'}`}
          title="Message actions"
        >
          <ChevronDown className="w-4 h-4" />
        </button>

        {/* Menu */}
        {menuOpen && (
          <div 
            ref={menuRef}
            className={`absolute top-8 ${isMine ? 'right-0' : 'left-8 sm:right-0 sm:left-auto'} bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1 min-w-[120px] flex flex-col`}
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={handleReply}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
            >
              <Reply className="w-4 h-4" /> Reply
            </button>
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors w-full text-left"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
        )}

        <div className="px-4 py-2.5 flex flex-col pointer-events-auto">
          {message.replyTo && (
            <div 
              className={`mb-2 p-2 rounded bg-black/5 border-l-4 cursor-pointer hover:bg-black/10 transition-colors
                ${isMine ? "border-gray-700" : "border-[#EEB2B2]"}`}
              onClick={(e) => {
                e.stopPropagation();
                onQuoteClick(message.replyTo!.messageId);
              }}
            >
              <p className="text-xs font-semibold truncate opacity-80">{message.replyTo.senderName}</p>
              <p className="text-xs truncate opacity-70">{message.replyTo.previewText}</p>
            </div>
          )}
          <p className="whitespace-pre-wrap">{safeLinkify(message.text || "")}</p>
        </div>
      </div>
      
      <span className="text-[10px] text-gray-400 mt-1 mx-1">
        {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
      </span>
    </div>
  );
}
