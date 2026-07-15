import { useEffect, useRef, useState } from "react";
import { Message } from "./types";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  currentUserId?: string;
  selectedIds: Set<string>;
  onSelectToggle: (id: string) => void;
  onReply: (msg: Message) => void;
  onCopy: (msg: Message) => void;
}

export function MessageList({ 
  messages, 
  currentUserId, 
  selectedIds, 
  onSelectToggle,
  onReply,
  onCopy
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  
  // Refs for scroll-to-original highlighting
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Swipe-to-reply state
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Long press state
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleQuoteClick = (id: string) => {
    const el = messageRefs.current.get(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('bg-black/10');
      setTimeout(() => {
        el.classList.remove('bg-black/10');
      }, 1500);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Long press logic
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      onSelectToggle(msgId);
      longPressTimer.current = null;
    }, 500);
  };

  const handleTouchMove = (e: React.TouchEvent, msgId: string) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;

    // If moved more than 10px, cancel long press
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }

    // Swipe to reply logic (only if moving mostly horizontally right)
    if (Math.abs(dx) > Math.abs(dy) && dx > 10) {
      // It's a horizontal swipe right
      e.preventDefault(); // prevent scrolling
      setSwipingId(msgId);
      setSwipeOffset(Math.min(dx, 80)); // cap at 80px
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, msg: Message) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    
    if (swipingId === msg.id && swipeOffset > 50) {
      onReply(msg);
    }
    
    setSwipingId(null);
    setSwipeOffset(0);
    touchStartPos.current = null;
  };

  const handleClick = (e: React.MouseEvent, msgId: string) => {
    if (selectedIds.size > 0) {
      onSelectToggle(msgId);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    onSelectToggle(msgId);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={listRef}>
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-600 text-sm font-medium">
          No messages yet. Start the conversation.
        </div>
      ) : (
        messages.map((msg) => {
          const isMine = msg.senderId === currentUserId;
          const isSelected = selectedIds.has(msg.id);
          const isSwiping = swipingId === msg.id;

          return (
            <div 
              key={msg.id}
              ref={(el) => {
                if (el) messageRefs.current.set(msg.id, el);
                else messageRefs.current.delete(msg.id);
              }}
              className={`transition-all duration-300 relative py-1 px-2 -mx-2 rounded-lg cursor-pointer
                ${isSelected ? 'bg-black/5' : 'hover:bg-black/5'}`}
              onClick={(e) => handleClick(e, msg.id)}
              onContextMenu={(e) => handleContextMenu(e, msg.id)}
              onTouchStart={(e) => handleTouchStart(e, msg.id)}
              onTouchMove={(e) => handleTouchMove(e, msg.id)}
              onTouchEnd={(e) => handleTouchEnd(e, msg)}
              onTouchCancel={(e) => handleTouchEnd(e, msg)}
            >
              <div 
                style={{ 
                  transform: isSwiping ? `translateX(${swipeOffset}px)` : 'translateX(0)',
                  transition: isSwiping ? 'none' : 'transform 0.2s ease'
                }}
              >
                <MessageBubble 
                  message={msg}
                  isMine={isMine}
                  isSelected={isSelected}
                  onSelect={onSelectToggle}
                  onReply={onReply}
                  onCopy={onCopy}
                  onQuoteClick={handleQuoteClick}
                />
              </div>
            </div>
          );
        })
      )}
      <div ref={bottomRef} />
    </div>
  );
}
