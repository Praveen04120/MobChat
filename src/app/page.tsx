"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Copy, Send, Trash2, Check, Loader2 } from "lucide-react";
import { 
  auth, db, signInAnonymously, onAuthStateChanged, 
  ref, set, get, onValue, push, serverTimestamp, update, 
  User 
} from "@/lib/firebase";
import { Unsubscribe } from "firebase/database";

type Screen = "loading" | "welcome" | "action" | "join" | "creating" | "chat";

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

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
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscriptions refs to clean up
  const roomStatusUnsub = useRef<Unsubscribe | null>(null);
  const messagesUnsub = useRef<Unsubscribe | null>(null);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      const roomRef = ref(db, `rooms/${code}`);
      await set(roomRef, {
        creatorId: user.uid,
        status: "active",
        createdAt: serverTimestamp(),
      });

      // Add as member
      await set(ref(db, `rooms/${code}/members/${user.uid}`), {
        name: name,
        joinedAt: serverTimestamp(),
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

      // Add as member
      await set(ref(db, `rooms/${roomCode}/members/${user.uid}`), {
        name: name,
        joinedAt: serverTimestamp(),
      });

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
    // Clean up existing listeners
    if (roomStatusUnsub.current) roomStatusUnsub.current();
    if (messagesUnsub.current) messagesUnsub.current();

    setMessages([]);

    // Listen for room status changes
    const statusRef = ref(db, `rooms/${code}/status`);
    roomStatusUnsub.current = onValue(statusRef, (snapshot) => {
      const status = snapshot.val();
      if (status === "deleted") {
        alert("This chat has been deleted by the creator.");
        leaveRoom();
      }
    });

    // Listen for messages
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
    setScreen("action");
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user || !roomCode) return;
    
    const text = newMessage.trim();
    setNewMessage(""); // optimistic clear

    try {
      const msgRef = push(ref(db, `rooms/${roomCode}/messages`));
      await set(msgRef, {
        senderId: user.uid,
        senderName: name,
        text: text,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Send message error:", error);
      setNewMessage(text); // revert on error
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
      await update(ref(db, `rooms/${roomCode}`), {
        status: "deleted",
        deletedAt: serverTimestamp(),
      });
      // The status listener will trigger leaveRoom for everyone including creator
      setShowDeleteModal(false);
      setIsDeleting(false);
    } catch (error) {
      console.error("Delete error:", error);
      setIsDeleting(false);
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
    <div className="flex flex-col h-[100dvh] bg-gray-50">
      {/* Header */}
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

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === user?.uid;

            return (
              <div key={msg.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                {!isMine && (
                  <span className="text-xs text-gray-500 font-medium ml-1 mb-1">{msg.senderName}</span>
                )}
                <div 
                  className={`max-w-[85%] sm:max-w-[70%] px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                    isMine 
                      ? "bg-[#EEB2B2] text-gray-900 rounded-tr-sm" 
                      : "bg-white text-gray-800 border border-gray-100 rounded-tl-sm"
                  }`}
                  style={{ wordBreak: 'break-word' }}
                >
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[10px] text-gray-400 mt-1 mx-1">
                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <div className="bg-white border-t border-gray-200 p-3 sm:p-4 pb-safe sticky bottom-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[44px] bg-gray-50 text-gray-900 border border-gray-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-1 focus:ring-[#EEB2B2] resize-none text-sm"
            rows={1}
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            className="bg-[#EEB2B2] text-gray-900 p-3 rounded-full hover:bg-[#D48989] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>

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
