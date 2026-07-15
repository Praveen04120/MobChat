import { Send, X } from "lucide-react";
import { Message } from "./types";
import { KeyboardEvent } from "react";

interface ComposerProps {
  newMessage: string;
  setNewMessage: (msg: string) => void;
  onSendMessage: () => void;
  replyTarget: Message | null;
  onCancelReply: () => void;
}

export function Composer({ newMessage, setNewMessage, onSendMessage, replyTarget, onCancelReply }: ComposerProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 p-3 sm:p-4 pb-safe sticky bottom-0 z-10">
      {replyTarget && (
        <div className="max-w-4xl mx-auto mb-2 bg-gray-50 border-l-4 border-[#EEB2B2] p-2 rounded-r-lg flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-semibold text-[#D48989] truncate">Replying to {replyTarget.senderName}</p>
            <p className="text-sm text-gray-600 truncate">{replyTarget.text || "Message"}</p>
          </div>
          <button 
            onClick={onCancelReply} 
            className="text-gray-400 hover:text-gray-700 p-1"
            title="Cancel Reply"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 max-h-32 min-h-[44px] bg-gray-50 text-gray-900 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#EEB2B2] resize-none text-sm"
          rows={1}
        />
        <button
          onClick={onSendMessage}
          disabled={!newMessage.trim()}
          className="bg-[#EEB2B2] text-gray-900 p-3 rounded-full hover:bg-[#D48989] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
