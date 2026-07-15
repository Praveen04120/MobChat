import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown, Reply, Copy, FileIcon, Download, X } from "lucide-react";
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
  if (!text) return null;
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
          onClick={(e) => e.stopPropagation()}
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
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
      if (e.key === "Escape") {
        setMenuOpen(false);
        setLightboxOpen(false);
      }
    };
    
    if (menuOpen || lightboxOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, lightboxOpen]);

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

  const renderMedia = (): ReactNode => {
    if (!message.mediaUrl) return null;

    if (message.type === 'image') {
      return (
        <div className="relative rounded overflow-hidden cursor-pointer" onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}>
          <img src={message.mediaUrl} alt={message.fileName || "Image"} className="w-full max-h-64 object-cover" />
        </div>
      );
    }

    if (message.type === 'video') {
      return (
        <div className="relative rounded overflow-hidden bg-black max-w-full" onClick={(e) => e.stopPropagation()}>
          <video 
            src={message.mediaUrl} 
            controls 
            playsInline 
            className="w-full max-h-64 object-contain"
          />
        </div>
      );
    }

    if (message.type === 'file') {
      const sizeStr = message.fileSize ? (message.fileSize / (1024 * 1024)).toFixed(1) + " MB" : "";
      return (
        <a 
          href={message.mediaUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-3 p-3 bg-black/5 hover:bg-black/10 rounded-lg transition-colors border border-black/5"
        >
          <div className="w-10 h-10 bg-black/5 rounded flex items-center justify-center flex-shrink-0">
            <FileIcon className="w-5 h-5 opacity-70" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{message.fileName || "Document"}</p>
            {sizeStr && <p className="text-xs opacity-70">{sizeStr}</p>}
          </div>
          <Download className="w-4 h-4 opacity-70 flex-shrink-0" />
        </a>
      );
    }

    return null;
  };

  return (
    <>
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

          <div className="px-3 py-2.5 flex flex-col pointer-events-auto w-full gap-2 overflow-hidden">
            {message.replyTo && (
              <div 
                className={`p-2 rounded bg-black/5 border-l-4 cursor-pointer hover:bg-black/10 transition-colors
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
            
            {message.mediaUrl && renderMedia()}
            
            {message.text && (
              <p className="whitespace-pre-wrap px-1">{safeLinkify(message.text)}</p>
            )}
          </div>
        </div>
        
        <span className="text-[10px] text-gray-400 mt-1 mx-1">
          {message.createdAt ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
        </span>
      </div>

      {lightboxOpen && message.type === 'image' && message.mediaUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
            <button 
              onClick={() => setLightboxOpen(false)}
              className="p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <img 
            src={message.mediaUrl} 
            alt={message.fileName || "Full Image"} 
            className="max-w-full max-h-[90vh] object-contain rounded" 
            onClick={(e) => e.stopPropagation()}
          />
          {message.text && (
            <p className="mt-4 text-white/90 text-center max-w-2xl px-4 whitespace-pre-wrap">
              {message.text}
            </p>
          )}
        </div>
      )}
    </>
  );
}
