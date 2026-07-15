"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Copy, Trash2, Check, Loader2 } from "lucide-react";
import { 
  auth, db, signInAnonymously, onAuthStateChanged, 
  ref, set, get, onValue, push, serverTimestamp, update, runTransaction,
  User 
} from "@/lib/firebase";
import { Unsubscribe } from "firebase/database";
import { Message } from "@/components/chat/types";
import { MessageList } from "@/components/chat/MessageList";
import { Composer } from "@/components/chat/Composer";
import { SelectionActionBar } from "@/components/chat/SelectionActionBar";
import { normalizeName, createFirebaseSafeNameKey, getMediaType, validateFileSize } from "@/lib/utils";
import { upload } from "@vercel/blob/client";

type Screen = "loading" | "welcome" | "action" | "join" | "creating" | "chat";

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [user, setUser] = useState<User | null>(null);
  
  // User Profile
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  
  // Validation errors
  const [nameError, setNameError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [joinError, setJoinError] = useState("");
  const [generalError, setGeneralError] = useState("");

  // Room state
  const [roomCode, setRoomCode] = useState("");
  const [isCreator, setIsCreator] = useState(false);
  
  // UI states
  const [copied, setCopied] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  // Advanced Chat State
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);

  // Media State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadedBlobUrl, setUploadedBlobUrl] = useState("");

  // Subscriptions refs to clean up
  const roomStatusUnsub = useRef<Unsubscribe | null>(null);
  const messagesUnsub = useRef<Unsubscribe | null>(null);

  // Auth and initial profile load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Load profile if exists
        const userRef = ref(db, `users/${currentUser.uid}`);
        const snapshot = await get(userRef);
        if (snapshot.exists()) {
          const data = snapshot.val();
          setName(data.name || "");
          setMobile(data.mobileNumber || "");
          setScreen("action");
        } else {
          setScreen("welcome");
        }
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error("Auth Error:", error);
          setGeneralError("Failed to authenticate. Please check connection.");
          setScreen("welcome");
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Cleanup listeners on unmount
  useEffect(() => {
    return () => {
      if (roomStatusUnsub.current) roomStatusUnsub.current();
      if (messagesUnsub.current) messagesUnsub.current();
    };
  }, []);

  const handleContinue = async () => {
    let valid = true;
    if (!name.trim()) {
      setNameError("Name is required");
      valid = false;
    } else {
      setNameError("");
    }

    const mobileRegex = /^[0-9]{10}$/;
    if (!mobileRegex.test(mobile)) {
      setMobileError("Enter a valid 10-digit mobile number");
      valid = false;
    } else {
      setMobileError("");
    }

    if (valid && user) {
      setScreen("loading");
      try {
        await set(ref(db, `users/${user.uid}`), {
          name: name.trim(),
          mobileNumber: mobile,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(), // If it overwrites, that's fine for MVP
        });
        setScreen("action");
      } catch (error) {
        console.error("Error saving profile", error);
        setGeneralError("Failed to save profile.");
        setScreen("welcome");
      }
    }
  };

  const reserveNameAndJoin = async (code: string) => {
    if (!user) throw new Error("Not authenticated");
    
    const normName = normalizeName(name);
    const safeKey = createFirebaseSafeNameKey(normName);
    const nameRef = ref(db, `rooms/${code}/memberNames/${safeKey}`);
    
    // Transaction to reserve the name
    const result = await runTransaction(nameRef, (currentData) => {
      if (currentData === null) {
        return user.uid; // Reserve it
      }
      if (currentData === user.uid) {
        return user.uid; // Rejoin allowed
      }
      return; // Abort
    });
    
    if (!result.committed) {
      throw new Error("NAME_TAKEN");
    }

    try {
      // Add as member
      await set(ref(db, `rooms/${code}/members/${user.uid}`), {
        name: name,
        normalizedName: normName,
        joinedAt: serverTimestamp(),
      });
    } catch (e) {
      // Cleanup if failed
      if (result.committed) {
        await set(nameRef, null).catch(console.error);
      }
      throw e;
    }
  };

  const handleCreateChat = async () => {
    if (!user) return;
    setScreen("creating");
    try {
      let code = "";
      let exists = true;
      // Find a unique code
      while (exists) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        const snapshot = await get(ref(db, `rooms/${code}`));
        exists = snapshot.exists();
      }

      const normName = normalizeName(name);
      const safeKey = createFirebaseSafeNameKey(normName);

      // We perform a SINGLE atomic set() for the entire room.
      // Since the room doesn't exist, this passes the !data.exists() rule check.
      const roomRef = ref(db, `rooms/${code}`);
      await set(roomRef, {
        creatorId: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
        members: {
          [user.uid]: {
            name: name,
            normalizedName: normName,
            joinedAt: serverTimestamp(),
          }
        },
        memberNames: {
          [safeKey]: user.uid
        }
      });

      setRoomCode(code);
      setIsCreator(true);
      joinRoomListeners(code);
      setScreen("chat");
    } catch (error) {
      console.error("Create Chat Error:", error);
      setGeneralError("Failed to create chat. Please try again.");
      setScreen("action");
    }
  };

  const handleJoinChat = async () => {
    if (roomCode.length !== 6 || !/^[0-9]{6}$/.test(roomCode)) {
      setJoinError("Enter a valid 6-digit code");
      return;
    }
    
    if (!user) return;
    setScreen("loading");
    setJoinError("");

    try {
      const roomRef = ref(db, `rooms/${roomCode}`);
      const snapshot = await get(roomRef);

      if (!snapshot.exists()) {
        setScreen("join");
        setJoinError("Chat not found. Check the code and try again.");
        return;
      }

      const roomData = snapshot.val();
      if (roomData.status === "deleted") {
        setScreen("join");
        setJoinError("This chat has been deleted by the creator.");
        return;
      }

      try {
        await reserveNameAndJoin(roomCode);
      } catch (e: any) {
        if (e.message === "NAME_TAKEN") {
          setScreen("action"); // Send them back to edit details
          setGeneralError("This name is already being used in this chat. Please use a different name.");
          return;
        }
        throw e;
      }

      setIsCreator(roomData.creatorId === user.uid);
      joinRoomListeners(roomCode);
      setScreen("chat");
    } catch (error) {
      console.error("Join Chat Error:", error);
      setScreen("join");
      setJoinError("Error joining chat. Please try again.");
    }
  };

  const joinRoomListeners = (code: string) => {
    if (roomStatusUnsub.current) roomStatusUnsub.current();
    if (messagesUnsub.current) messagesUnsub.current();

    setMessages([]);
    setSelectedMessageIds(new Set());
    setReplyTarget(null);

    const statusRef = ref(db, `rooms/${code}/status`);
    roomStatusUnsub.current = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status === "deleted") {
        alert("This chat has been deleted by the creator.");
        leaveRoom();
      }
    });

    const messagesRef = ref(db, `rooms/${code}/messages`);
    messagesUnsub.current = onValue(messagesRef, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((childSnapshot) => {
        msgs.push({
          id: childSnapshot.key as string,
          ...childSnapshot.val(),
        });
      });
      setMessages(msgs);
    });
  };

  const leaveRoom = () => {
    if (roomStatusUnsub.current) roomStatusUnsub.current();
    if (messagesUnsub.current) messagesUnsub.current();
    setRoomCode("");
    setMessages([]);
    setSelectedMessageIds(new Set());
    setReplyTarget(null);
    setSelectedFile(null);
    setUploadError("");
    setUploadedBlobUrl("");
    setScreen("action");
  };

  const handleSendMessage = async () => {
    if (!user || !roomCode) return;
    if (!newMessage.trim() && !selectedFile && !uploadedBlobUrl) return;
    
    let finalMediaUrl = uploadedBlobUrl;
    let finalFileName = "";
    let finalMimeType = "";
    let finalFileSize = 0;
    let finalType: Message["type"] = "text";

    if (selectedFile && !finalMediaUrl) {
      const validation = validateFileSize(selectedFile);
      if (!validation.valid) {
        setUploadError(validation.error!);
        return;
      }

      setIsUploading(true);
      setUploadError("");
      try {
        const type = getMediaType(selectedFile);
        // We use a room-scoped prefix for cleanup later: rooms/ROOMCODE/...
        const filename = `rooms/${roomCode}/${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const newBlob = await upload(filename, selectedFile, {
          access: 'public',
          handleUploadUrl: '/api/upload',
          clientPayload: JSON.stringify({ type })
        });
        
        finalMediaUrl = newBlob.url;
        setUploadedBlobUrl(newBlob.url);
      } catch (err: any) {
        setIsUploading(false);
        setUploadError("Upload failed. Please try again.");
        return; // Don't proceed to Firebase write
      }
    }

    if (selectedFile || finalMediaUrl) {
      // If we had a file (either just uploaded or previously uploaded)
      const fileToUse = selectedFile; // We need metadata. If it was retried, selectedFile is still there.
      if (fileToUse) {
        finalType = getMediaType(fileToUse);
        finalFileName = fileToUse.name;
        finalMimeType = fileToUse.type;
        finalFileSize = fileToUse.size;
      } else {
        // Fallback if somehow file is missing but URL exists
        finalType = "file";
      }
    }

    const text = newMessage.trim();
    const currentReply = replyTarget;
    const currentFile = selectedFile;
    
    // Optimistic UI clear for text/reply, keep file visually in case Firebase fails
    setNewMessage(""); 
    setReplyTarget(null);
    setUploadError("");
    setIsUploading(true); // Keep spinner during Firebase write

    try {
      const msgRef = push(ref(db, `rooms/${roomCode}/messages`));
      
      const messageData: Partial<Message> = {
        senderId: user.uid,
        senderName: name,
        text: text,
        type: finalType,
        createdAt: serverTimestamp() as unknown as number,
      };

      if (finalMediaUrl) {
        messageData.mediaUrl = finalMediaUrl;
        messageData.fileName = finalFileName;
        messageData.mimeType = finalMimeType;
        messageData.fileSize = finalFileSize;
      }

      if (currentReply) {
        let preview = "Message";
        if (currentReply.type === 'image') preview = "📷 Photo";
        else if (currentReply.type === 'video') preview = "🎥 Video";
        else if (currentReply.type === 'file') preview = `📄 ${currentReply.fileName || 'Document'}`;
        else if (currentReply.text) preview = currentReply.text.slice(0, 50);

        messageData.replyTo = {
          messageId: currentReply.id,
          senderId: currentReply.senderId,
          senderName: currentReply.senderName,
          previewText: preview,
          type: currentReply.type || "text"
        };
      }

      await set(msgRef, messageData);
      
      // Full clear on ultimate success
      setSelectedFile(null);
      setUploadedBlobUrl("");
      setIsUploading(false);
    } catch (error) {
      console.error("Send message error:", error);
      setIsUploading(false);
      setUploadError("Failed to send message. Click send to retry.");
      setNewMessage(text);
      if (currentReply) setReplyTarget(currentReply);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteChat = async () => {
    if (!isCreator || !roomCode) return;
    setIsDeleting(true);
    try {
      // Clean up blobs
      try {
        await fetch('/api/upload/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode }),
        });
      } catch (err) {
        console.error("Blob cleanup failed:", err);
      }

      await update(ref(db, `rooms/${roomCode}`), {
        status: "deleted",
        deletedAt: serverTimestamp(),
      });
      setShowDeleteModal(false);
      setIsDeleting(false);
      setScreen("action");
      setRoomCode("");
    } catch (error) {
      console.error("Delete room error:", error);
      setIsDeleting(false);
    }
  };

  // Interactions
  const handleSelectToggle = (id: string) => {
    setSelectedMessageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getMessageCopyText = (msg: Message, includeSender: boolean = false): string => {
    let prefix = includeSender ? `${msg.senderName}: ` : "";
    let content = "";

    if (msg.type === "image") {
      content = msg.text ? `[Photo] ${msg.text}` : "[Photo]";
    } else if (msg.type === "video") {
      content = msg.text ? `[Video] ${msg.text}` : "[Video]";
    } else if (msg.type === "file") {
      const fn = msg.fileName || "file";
      content = msg.text ? `[File: ${fn}] ${msg.text}` : `[File: ${fn}]`;
    } else {
      content = msg.text || "";
    }

    return `${prefix}${content}`;
  };

  const handleCopySelected = async () => {
    if (selectedMessageIds.size === 0) return;
    
    let textToCopy = "";
    if (selectedMessageIds.size === 1) {
      const msg = messages.find(m => m.id === Array.from(selectedMessageIds)[0]);
      if (msg) textToCopy = getMessageCopyText(msg, false);
    } else {
      const sorted = messages.filter(m => selectedMessageIds.has(m.id)).sort((a, b) => a.createdAt - b.createdAt);
      textToCopy = sorted.map(m => getMessageCopyText(m, true)).join("\n");
    }

    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error("Clipboard error", err);
      }
    }
    setSelectedMessageIds(new Set());
  };

  const handleCopySingle = async (msg: Message) => {
    const textToCopy = getMessageCopyText(msg, false);
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error("Clipboard error", err);
      }
    }
  };

  // -------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------

  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#EEB2B2]">
      <Loader2 className="w-12 h-12 text-white animate-spin" />
    </div>
  );

  const renderWelcome = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#EEB2B2]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col items-center text-center">
        <img 
          src="/assets/mobchat-logo.png" 
          alt="MobChat Logo" 
          className="w-24 h-24 object-contain mb-4"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">MobChat</h1>
        <p className="text-gray-500 mb-8">Chat instantly. No complicated setup.</p>

        {generalError && <p className="text-red-500 text-sm mb-4 w-full text-left">{generalError}</p>}

        <div className="w-full space-y-5">
          <div className="text-left">
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#EEB2B2] transition-all text-gray-900 bg-gray-50"
            />
            {nameError && <p className="text-red-500 text-sm mt-1">{nameError}</p>}
          </div>

          <div className="text-left">
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={mobile}
              onChange={(e) => setMobile(e.target.value.replace(/[^0-9]/g, ''))}
              maxLength={10}
              placeholder="Enter 10-digit mobile number"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#EEB2B2] transition-all text-gray-900 bg-gray-50"
            />
            {mobileError && <p className="text-red-500 text-sm mt-1">{mobileError}</p>}
          </div>

          <button
            onClick={handleContinue}
            className="w-full bg-[#EEB2B2] hover:bg-[#D48989] text-gray-900 font-semibold py-3 rounded-xl shadow-sm transition-colors mt-4"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );

  const renderActionScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#EEB2B2]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col">
        <button 
          onClick={() => setScreen("welcome")}
          className="self-start text-gray-500 hover:text-gray-800 mb-6 transition-colors flex items-center text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Edit Details
        </button>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Hi, {name}</h2>
        <p className="text-gray-500 mb-8">What would you like to do?</p>

        {generalError && <p className="text-red-500 text-sm mb-4">{generalError}</p>}

        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            onClick={() => { setScreen("join"); setJoinError(""); setRoomCode(""); }}
            className="flex-1 bg-white border-2 border-[#EEB2B2] text-gray-800 hover:bg-gray-50 font-semibold py-4 rounded-xl shadow-sm transition-all"
          >
            JOIN A CHAT
          </button>
          <button
            onClick={handleCreateChat}
            className="flex-1 bg-[#EEB2B2] hover:bg-[#D48989] text-gray-900 font-semibold py-4 rounded-xl shadow-sm transition-all"
          >
            CREATE A CHAT
          </button>
        </div>
      </div>
    </div>
  );

  const renderJoinScreen = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#EEB2B2]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 flex flex-col items-center text-center">
        <div className="w-full flex justify-start mb-6">
          <button 
            onClick={() => { setScreen("action"); setJoinError(""); setRoomCode(""); }}
            className="text-gray-500 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Join a Chat</h2>
        <p className="text-gray-500 mb-8">Enter the 6-digit chat code</p>

        <div className="w-full max-w-xs space-y-6">
          <div>
            <input
              type="tel"
              value={roomCode}
              onChange={(e) => {
                setRoomCode(e.target.value.replace(/[^0-9]/g, ''));
                setJoinError("");
              }}
              maxLength={6}
              placeholder="000000"
              className="w-full text-center text-4xl tracking-widest px-4 py-4 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-[#EEB2B2] transition-colors text-gray-900 bg-gray-50 font-mono"
            />
            {joinError && <p className="text-red-500 text-sm mt-2 font-medium">{joinError}</p>}
          </div>

          <button
            onClick={handleJoinChat}
            disabled={roomCode.length !== 6}
            className={`w-full py-4 rounded-xl shadow-sm transition-colors font-semibold ${
              roomCode.length === 6 
                ? "bg-[#EEB2B2] hover:bg-[#D48989] text-gray-900 cursor-pointer" 
                : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
          >
            Join Chat
          </button>
        </div>
      </div>
    </div>
  );

  const renderCreating = () => (
    <div className="flex flex-col items-center justify-center min-h-[100dvh] p-4 bg-[#EEB2B2]">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-10 flex flex-col items-center text-center">
        <Loader2 className="w-10 h-10 text-[#D48989] animate-spin mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">Creating your chat...</h2>
      </div>
    </div>
  );

  const renderChatScreen = () => (
    <div className="flex flex-col h-[100dvh] bg-[#EEB2B2] relative">
      {copyFeedback && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-sm font-medium px-4 py-2 rounded-full shadow-lg transition-opacity">
          Copied
        </div>
      )}

      {selectedMessageIds.size > 0 ? (
        <SelectionActionBar 
          selectedCount={selectedMessageIds.size} 
          onClose={() => setSelectedMessageIds(new Set())}
          onCopy={handleCopySelected}
        />
      ) : (
        <header className="bg-white border-b border-gray-100 py-3 px-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
             <img 
              src="/assets/mobchat-logo.png" 
              alt="MobChat" 
              className="w-8 h-8 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <span className="font-bold text-gray-900 text-lg hidden sm:block">MobChat</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 font-medium">Chat Code</span>
              <div className="flex items-center gap-1.5 bg-gray-100 pl-3 pr-2 py-1 rounded-md">
                <span className="font-mono font-bold text-gray-800 tracking-wider text-sm">{roomCode}</span>
                <button 
                  onClick={handleCopyCode}
                  className="p-1 text-gray-500 hover:text-gray-800 transition-colors"
                  title="Copy Code"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            
            {isCreator && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors ml-2"
                title="Delete Chat"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </header>
      )}

      <MessageList 
        messages={messages}
        currentUserId={user?.uid}
        selectedIds={selectedMessageIds}
        onSelectToggle={handleSelectToggle}
        onReply={(msg) => setReplyTarget(msg)}
        onCopy={handleCopySingle}
      />

        <Composer 
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSendMessage={handleSendMessage}
          replyTarget={replyTarget}
          onCancelReply={() => setReplyTarget(null)}
          selectedFile={selectedFile}
          setSelectedFile={(file) => {
            setSelectedFile(file);
            setUploadError("");
            setUploadedBlobUrl(""); // clear uploaded URL if file changes
          }}
          isUploading={isUploading}
          uploadError={uploadError}
          uploadedBlobUrl={uploadedBlobUrl}
        />

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete this chat?</h3>
            <p className="text-gray-500 text-sm mb-6">
              This will close the chat for everyone. Members will no longer be able to access this chat.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-gray-600 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteChat}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors flex items-center"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isDeleting ? "Deleting..." : "Delete Chat"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Router
  switch (screen) {
    case "loading":
      return renderLoading();
    case "welcome":
      return renderWelcome();
    case "action":
      return renderActionScreen();
    case "join":
      return renderJoinScreen();
    case "creating":
      return renderCreating();
    case "chat":
      return renderChatScreen();
    default:
      return renderWelcome();
  }
}
