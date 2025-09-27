import { useState } from "react";
import { MessageCircle, X, Hand } from "lucide-react";

export default function Chatbot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        {
            from: "bot",
            text: (
                <span className="flex items-center gap-2">
                    <Hand className="w-4 h-4 text-emerald-600" />
                    Hi! I'm your Real Estate Assistant. Ask me about buying a house,
                    common terms, or the process!
                </span>
            )
        }
    ]);
    const [input, setInput] = useState("");

    const responses = {
        mortgage: "A mortgage is a type of loan you take from a bank or lender to buy a property. You’ll repay monthly with interest.",
        downpayment: "A downpayment is the upfront cash you pay (usually 20-25% of property price) before taking a loan.",
        conveyancing: "Conveyancing is the legal process of transferring ownership of a property from seller to buyer.",
        process: "Typical buying process: 1) Get loan pre-approval → 2) Find a property → 3) Make offer & Option-to-Purchase → 4) Finalize mortgage → 5) Legal conveyancing → 6) Collect keys 🎉",
        default: "I can help with terms like 'mortgage', 'downpayment', 'conveyancing', or explain the buying 'process'. Try asking me about those!"
    };

    const handleSend = () => {
        if (!input.trim()) return;

        const userMessage = { from: "user", text: input };
        setMessages([...messages, userMessage]);

        // simple keyword matching
        const key = Object.keys(responses).find((k) =>
            input.toLowerCase().includes(k)
        );
        const botReply = responses[key] || responses.default;

        setMessages((prev) => [...prev, { from: "bot", text: botReply }]);
        setInput("");
    };

    return (
        <div>
            {/* Floating button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 bg-emerald-600 text-white p-4 rounded-full shadow-lg hover:bg-emerald-700"
            >
                {isOpen ? (
                    <X className="w-6 h-6" />
                ) : (
                    <MessageCircle className="w-6 h-6" />
                )}
            </button>

            {/* Chat window */}
            {isOpen && (
                <div className="fixed bottom-20 right-6 w-80 bg-white shadow-xl rounded-lg overflow-hidden border border-gray-200 flex flex-col">
                    <div className="bg-emerald-600 text-white px-4 py-2 font-semibold">
                        Real Estate Chatbot
                    </div>
                    <div className="flex-1 p-3 overflow-y-auto space-y-2 text-sm">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={`p-2 rounded-lg max-w-[75%] ${m.from === "user"
                                        ? "bg-emerald-100 self-end ml-auto"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                            >
                                {m.text}
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t flex">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === "Enter" && handleSend()}
                            placeholder="Ask me something..."
                            className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none"
                        />
                        <button
                            onClick={handleSend}
                            className="ml-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-lg text-sm"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
