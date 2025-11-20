import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { Brain } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";
import Chatbot from "../components/Chatbot";
import "../components/css/HomePage.css";
import WelcomeVideo from "../pages/WelcomeVideo";

export default function HomePage() {
    const { user } = useAuth();
    const [properties, setProperties] = useState([]);
    const [aiFeatures, setAiFeatures] = useState([]);
    const [traditionalFeatures, setTraditionalFeatures] = useState([]);

    // Feedbacks data
    const feedbacks = [
        { name: "Sarah Tan", role: "Home Buyer", text: "The AI prediction was spot on! I found my dream home faster than I imagined." },
        { name: "James Lee", role: "Property Agent", text: "The smart matching helps me connect with serious buyers instantly." },
        { name: "Amira Rahman", role: "Investor", text: "The market intelligence dashboard gave me deep insights before purchasing." },
        { name: "David Ong", role: "Landlord", text: "Listing with AI insights made my property stand out and rent out quickly." },
    ];

    useEffect(() => {
        api.get("/properties/all")
            .then((res) => setProperties(res.data || []))
            .catch((err) => console.error("Failed to load properties", err));
    }, []);

    useEffect(() => {
        api.get("/admin/features")
            .then((res) => {
                setAiFeatures(res.data.filter((f) => f.category === "ai" && f.is_visible));
                setTraditionalFeatures(res.data.filter((f) => f.category === "traditional" && f.is_visible));
            })
            .catch((err) => console.error("Failed to load features", err));
    }, []);

    const renderFeature = (f, isDark = false) => {
        const Icon = Icons[f.icon] || Icons.Sparkles;
        return (
            <div
                key={f.id}
                // Added shadow-xl and border logic to make cards pop over the video
                className={`text-center p-8 rounded-2xl transition duration-300 hover:-translate-y-2 ${isDark
                        ? "bg-white shadow-2xl border border-purple-100" // Style for floating cards
                        : "bg-white border border-gray-100 hover:shadow-lg" // Style for normal cards
                    }`}
            >
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Icon className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900">{f.title}</h3>
                <p className="text-gray-600 mt-2 leading-relaxed">{f.description}</p>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-50">

            {/* Hero Section */}
            {/* Hero Section */}
            <section className="relative h-[85vh] min-h-[600px] w-full overflow-hidden">

                {/* 1. Background Video */}
                {/* ensure CSS brightness is around 0.8 or 0.9 so it's bright enough to see details */}
                <div className="absolute inset-0 z-0">
                    <WelcomeVideo />
                    {/* Subtle gradient at the bottom only, to make the glass box pop */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                </div>

                {/* 2. Layout Container - Aligns content to the BOTTOM */}
                <div className="relative z-10 max-w-7xl mx-auto px-6 h-full flex flex-col justify-end pb-48 md:pb-56">

                    {/* POSH GLASS DOCK (Bottom Center) */}
                    <div className="w-full max-w-4xl mx-auto">
                        <div className="bg-black/30 backdrop-blur-xl border border-white/20 p-6 md:p-8 rounded-3xl shadow-2xl ring-1 ring-white/10 flex flex-col md:flex-row items-center justify-between gap-6">

                            {/* Text inside the Glass Bar */}
                            <div className="text-center md:text-left">
                                <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-emerald-300 text-xs font-bold uppercase tracking-widest">
                                        System Online
                                    </span>
                                </div>
                                <h2 className="text-2xl md:text-3xl font-bold text-white">
                                    Ready to find your home?
                                </h2>
                                <p className="text-gray-300 text-sm mt-1">
                                    Use our AI tools to analyze the market instantly.
                                </p>
                            </div>

                            {/* The Big Button */}
                            <div className="w-full md:w-auto flex-shrink-0">
                                <Link to="/properties/all">
                                    <button className="w-full md:w-auto bg-white text-emerald-900 hover:bg-emerald-50 font-bold py-4 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2">
                                        Start Searching Now
                                        <span className="text-xl">→</span>
                                    </button>
                                </Link>
                            </div>

                        </div>
                    </div>

                </div>
            </section>

            {/* --- OVERLAPPING AI FEATURES SECTION --- */}
            {/* -mt-32 pulls this section UP over the video */}
            <section className="relative z-20 -mt-32 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
                        {aiFeatures.map((f) => renderFeature(f, true))}
                    </div>
                </div>
            </section>

            {/* --- SPACER FOR VISUAL BREATHING ROOM --- */}
            <div className="h-20"></div>

            {/* --- FEATURED PROPERTIES --- */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex justify-between items-end mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-900">Featured Properties</h2>
                            <p className="text-gray-500 mt-2">Handpicked selections just for you</p>
                        </div>
                        <Link to="/properties/all">
                            <button className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center">
                                View All Properties <span className="ml-1">→</span>
                            </button>
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {properties.slice(0, 4).map((p) => (
                            <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-xl transition duration-300 overflow-hidden group">
                                <div className="relative h-48 overflow-hidden">
                                    {p.photos && p.photos.length > 0 ? (
                                        <img
                                            src={p.photos[0]}
                                            alt={p.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400">No Image</div>
                                    )}
                                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold text-emerald-800">
                                        {p.type || "Condo"}
                                    </div>
                                </div>
                                <div className="p-5">
                                    <h3 className="text-lg font-bold text-gray-900 truncate">{p.title}</h3>
                                    <p className="text-gray-500 text-sm flex items-center mt-1">
                                        <Icons.MapPin className="w-3 h-3 mr-1" /> {p.location}
                                    </p>
                                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                                        <p className="text-emerald-600 font-bold text-lg">
                                            ${parseInt(p.price).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* --- TRADITIONAL FEATURES --- */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-6 text-center mb-12">
                    <h2 className="text-3xl font-bold text-gray-900">Comprehensive Services</h2>
                    <p className="text-gray-500 mt-2">Everything you need for a smooth transaction</p>
                </div>
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
                    {traditionalFeatures.map((f) => renderFeature(f, false))}
                </div>
            </section>

            {/* --- FEEDBACK SECTION --- */}
            <section className="py-20 bg-gradient-to-b from-purple-50 to-white overflow-hidden">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-12">Trusted by Thousands</h2>
                    <div className="relative">
                        {/* Add a gradient mask to sides so it looks like it fades out */}
                        <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-purple-50 to-transparent z-10"></div>
                        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-white to-transparent z-10"></div>

                        <div className="flex animate-scroll-x space-x-6 w-max">
                            {[...feedbacks, ...feedbacks].map((f, i) => (
                                <div key={i} className="w-[350px] bg-white border border-purple-100 rounded-2xl shadow-sm p-8 flex-shrink-0 text-left">
                                    <div className="flex items-center mb-4">
                                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center font-bold text-purple-700 mr-3">
                                            {f.name[0]}
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900">{f.name}</h4>
                                            <span className="text-xs text-purple-600 font-semibold uppercase tracking-wider">{f.role}</span>
                                        </div>
                                    </div>
                                    <p className="text-gray-600 italic leading-relaxed">"{f.text}"</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <Chatbot />
        </div>
    );
}