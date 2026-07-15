import { Send, X, Paperclip, FileIcon, Loader2 } from "lucide-react";
import { Message } from "./types";
import { KeyboardEvent, useRef } from "react";
import { getMediaType } from "../../lib/utils";

interface ComposerProps {
  newMessage: string;
  setNewMessage: (msg: string) => void;
  onSendMessage: () => void;
  replyTarget: Message | null;
  onCancelReply: () => void;
  selectedFile: File | null;
  setSelectedFile: (file: File | null) => void;
  isUploading: boolean;
  uploadError: string;
  uploadedBlobUrl: string;
}

export function Composer({ 
  newMessage, setNewMessage, onSendMessage, replyTarget, onCancelReply,
  selectedFile, setSelectedFile, isUploading, uploadError, uploadedBlobUrl
}: ComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
    // Reset input so the same file can be selected again if canceled
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSend = Boolean(newMessage.trim() || selectedFile || uploadedBlobUrl);

  const renderFilePreview = () => {
    if (!selectedFile) return null;
    const type = getMediaType(selectedFile);
    const size = (selectedFile.size / (1024 * 1024)).toFixed(1) + " MB";

    return (
      <div className="relative mb-2 max-w-4xl mx-auto bg-gray-50 border border-gray-200 rounded-lg p-2 flex items-center gap-3">
        {type === 'image' ? (
          <img src={URL.createObjectURL(selectedFile)} alt="preview" className="w-12 h-12 object-cover rounded" />
        ) : type === 'video' ? (
          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-xs font-bold text-gray-500">VIDEO</div>
        ) : (
          <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-500">
            <FileIcon className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
          <p className="text-xs text-gray-500">{size}</p>
        </div>
        <button 
          onClick={() => setSelectedFile(null)} 
          disabled={isUploading}
          className="text-gray-400 hover:text-gray-700 p-1 mr-1 disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  };

  return (
    <div className="bg-white border-t border-gray-200 p-3 sm:p-4 pb-safe sticky bottom-0 z-10 flex flex-col">
      {replyTarget && (
        <div className="max-w-4xl w-full mx-auto mb-2 bg-gray-50 border-l-4 border-[#EEB2B2] p-2 rounded-r-lg flex items-start justify-between">
          <div className="flex-1 min-w-0 pr-2">
            <p className="text-xs font-semibold text-[#D48989] truncate">Replying to {replyTarget.senderName}</p>
            <p className="text-sm text-gray-600 truncate">
              {replyTarget.type === 'image' ? "📷 Photo" : 
               replyTarget.type === 'video' ? "🎥 Video" : 
               replyTarget.type === 'file' ? `📄 ${replyTarget.fileName || 'Document'}` : 
               (replyTarget.text || "Message")}
            </p>
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

      {renderFilePreview()}

      {uploadError && (
        <div className="max-w-4xl mx-auto w-full mb-2 text-sm text-red-500 font-medium px-1">
          {uploadError}
        </div>
      )}

      <div className="flex items-end gap-2 max-w-4xl mx-auto relative w-full">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-3 text-gray-500 hover:text-[#EEB2B2] hover:bg-gray-50 rounded-full transition-colors disabled:opacity-50 mb-0.5"
          title="Attach media or file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt,.zip,.xls,.xlsx,.ppt,.pptx"
        />
        
        <textarea
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={selectedFile ? "Add a caption..." : "Type a message..."}
          className="flex-1 max-h-32 min-h-[44px] bg-gray-50 text-gray-900 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#EEB2B2] resize-none text-sm"
          rows={1}
        />
        <button
          onClick={onSendMessage}
          disabled={!canSend || isUploading}
          className="bg-[#EEB2B2] text-gray-900 p-3 rounded-full hover:bg-[#D48989] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
        >
          {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}
