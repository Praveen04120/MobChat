import { X, Copy } from "lucide-react";

interface SelectionActionBarProps {
  selectedCount: number;
  onClose: () => void;
  onCopy: () => void;
}

export function SelectionActionBar({ selectedCount, onClose, onCopy }: SelectionActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <header className="bg-white border-b border-[#EEB2B2] py-3 px-4 flex items-center justify-between sticky top-0 z-20 shadow-md transition-all">
      <div className="flex items-center gap-4">
        <button 
          onClick={onClose}
          className="p-1 text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100"
          title="Close Selection"
        >
          <X className="w-5 h-5" />
        </button>
        <span className="font-semibold text-gray-900 text-lg">
          {selectedCount} selected
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <button 
          onClick={onCopy}
          className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-full hover:bg-gray-100 flex items-center gap-1.5"
          title="Copy"
        >
          <Copy className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Copy</span>
        </button>
      </div>
    </header>
  );
}
