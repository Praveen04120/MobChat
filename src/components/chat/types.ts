export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  createdAt: number;
  type?: "text" | "image" | "video" | "file";
  mediaUrl?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    previewText: string;
    type: "text" | "image" | "video" | "file";
  };
}
