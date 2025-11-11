import { useEffect, useState } from "react";
import api from "../api";

export default function ChatModal({ enquiry, user, onClose }) {
    const [messages, setMessages] = useState([]);
    const [text, setText] = useState("");
    const enquiryId = enquiry?.enquiry_id || enquiry?.id;

    // === Fetch messages ===
    async function fetchMessages() {
        try {
            if (!enquiryId) {
                console.warn("⚠️ No enquiry ID provided to ChatModal");
                return;
            }

            const res = await api.get(`/chat/${enquiryId}`);
            console.log("📩 API Response:", res.data); // <-- ADD THIS LINE

            if (res.data.ok) {
                setMessages(res.data.messages || []);
                console.log("✅ Messages set:", res.data.messages);
            } else {
                console.warn("⚠️ Failed to fetch messages:", res.data.error);
            }
        } catch (err) {
            console.error("❌ Failed to load messages:", err);
        }
    }


    // === Send message ===
    async function sendMessage(e) {
        e.preventDefault();
        if (!text.trim()) return;

        try {
            await api.post("/chat", {
                enquiry_id: enquiryId,
                sender_id: user.id,
                message: text.trim(),
            });
            setText("");
            fetchMessages(); // refresh chat
        } catch (err) {
            console.error("❌ Failed to send message:", err);
        }
    }

    useEffect(() => {
        fetchMessages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enquiryId]);

    return (
        <div className="chat-modal fixed inset-0 flex justify-center items-center bg-black/10 backdrop-blur-sm z-50">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
                {/* === Header === */}
                <div className="bg-green-900 text-white p-4 rounded-t-lg flex justify-between items-center">
                    <h3 className="font-semibold text-lg">Chat between You & Agent</h3>
                    <button onClick={onClose} className="text-white text-xl font-bold">
                        ×
                    </button>
                </div>

                {/* === Chat Body === */}
                <div className="p-4 h-80 overflow-y-auto border-b border-gray-200">
                    {messages.length === 0 ? (
                        <p className="text-gray-500 text-sm">No messages yet</p>
                    ) : (
                        messages.map((m) => (
                            <div
                                key={m.id}
                                className={`mb-2 ${m.sender_id === user.id ? "text-right" : "text-left"
                                    }`}
                            >
                                <div
                                    className={`inline-block p-2 rounded-lg ${m.sender_id === user.id
                                            ? "bg-green-100 text-gray-800"
                                            : "bg-gray-200 text-gray-900"
                                        }`}
                                >
                                    <p className="text-sm">{m.message}</p>
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {new Date(m.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* === Input Box === */}
                {enquiry.status !== "Closed" ? (
                    <form onSubmit={sendMessage} className="flex items-center p-3 gap-2">
                        <input
                            type="text"
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            placeholder="Type a message..."
                            className="flex-grow border rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                            type="submit"
                            className="bg-green-800 text-white px-4 py-2 rounded-lg"
                        >
                            Send
                        </button>
                    </form>
                ) : (
                    <div className="p-3 text-center text-gray-500 text-sm italic">
                        Chat closed by agent.
                    </div>
                )}
            </div>
        </div>
    );
}
