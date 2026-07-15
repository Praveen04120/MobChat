export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text?: string;
  createdAt: number;
  type?: "text"; // Future expansion for media
  replyTo?: {
    messageId: string;
    senderId: string;
    senderName: string;
    previewText: string;
    type: "text";
  };
}
