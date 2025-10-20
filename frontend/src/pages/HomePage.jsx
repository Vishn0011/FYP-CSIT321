import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { Brain } from "lucide-react";
import api from "../api";
import { useAuth } from "../AuthContext";
import Chatbot from "../components/Chatbot";
import "../components/css/HomePage.css";

export default function HomePage() {
  const { user } = useAuth();
  const [properties, setProperties] = useState([]);
  const [aiFeatures, setAiFeatures] = useState([]);
  const [traditionalFeatures, setTraditionalFeatures] = useState([]);

  const feedbacks = [
    { name: "Sarah Tan", role: "Home Buyer", text: "The AI prediction was spot on! I found my dream home faster than I imagined." },
    { name: "James Lee", role: "Property Agent", text: "The smart matching helps me connect with serious buyers instantly." },
    { name: "Amira Rahman", role: "Investor", text: "The market intelligence dashboard gave me deep insights before purchasing." },
    { name: "David Ong", role: "Landlord", text: "Listing with AI insights made my property stand out and rent out quickly." },
  ];

  // fetch properties
  useEffect(() => {
    api
      .get("/properties/all")
      .then((res) => setProperties(res.data || []))
      .catch((err) => console.error("Failed to load properties", err));
  }, []);

  // fetch features (configurable by admin)
  useEffect(() => {
    api
      .get("/admin/features")
      .then((res) => {
        const ai = res.data.filter((f) => f.category === "ai" && f.is_visible);
        const trad = res.data.filter((f) => f.category === "traditional" && f.is_visible);
        setAiFeatures(ai);
        setTraditionalFeatures(trad);
      })
      .catch((err) => console.error("Failed to load features", err));
  }, []);

  const renderFeature = (f) => {
    const Icon = Icons[f.icon] || Icons.Sparkles;
    return (
      <div
        key={f.id}
        className="
          bg-white text-center p-8 rounded-2xl border border-purple-100 shadow
          hover:shadow-lg transition
          dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700
        "
      >
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-200/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon className="w-8 h-8 text-purple-600 dark:text-purple-300" />
        </div>
        <h3 className="text-xl font-semibold">{f.title}</h3>
        <p className="text-gray-600 dark:text-zinc-300 mt-2">{f.description}</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-900">
      {/* Hero */}
      <section
        className="
          bg-gradient-to-r from-emerald-600 to-emerald-700
          dark:from-emerald-800 dark:to-emerald-900
          text-white py-20
        "
      >
        <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
          <span className="inline-flex items-center bg-white/20 text-white border border-white/30 text-sm px-4 py-2 rounded-full">
            <Brain className="w-4 h-4 mr-2" /> AI-Powered Real Estate
          </span>
          <h1 className="text-5xl font-bold">
            Find Your Dream Home with{" "}
            <span className="text-yellow-300">AI Intelligence</span>
          </h1>
          <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
            Explore listings, analyze market trends, and predict property values
            all in one place.
          </p>
        </div>
      </section>

      {/* AI Features (Configurable) */}
      <section className="py-20 bg-gradient-to-b from-purple-50 to-blue-50 dark:from-zinc-900 dark:to-zinc-900">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {aiFeatures.map(renderFeature)}
        </div>
      </section>

      {/* Featured Properties */}
      <section className="py-16 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-50">
              Featured Properties
            </h2>
            <Link to="/properties/all">
              <button
                className="
                  border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-50
                  dark:border-emerald-700/50 dark:text-emerald-200 dark:hover:bg-emerald-950
                "
              >
                View All
              </button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {properties.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="
                  bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden
                  dark:bg-zinc-800
                "
              >
                {p.photos && p.photos.length > 0 && (
                  <img
                    src={JSON.parse(p.photos)[0]}
                    alt={p.title}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-50">{p.title}</h3>
                  <p className="text-gray-500 dark:text-zinc-300 text-sm">{p.location}</p>
                  <p className="text-emerald-700 dark:text-emerald-300 font-bold mt-2">
                    SGD {p.price}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Traditional Features (Configurable) */}
      <section className="py-16 bg-gray-50 dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {traditionalFeatures.map(renderFeature)}
        </div>
      </section>

      {/* Feedback Carousel */}
      <section className="py-16 bg-gray-50 dark:bg-zinc-900">
        <div className="max-w-6xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-zinc-50 mb-8">
            What Our Users Say
          </h2>

          <div className="overflow-hidden relative">
            <div className="flex animate-scroll-x space-x-6 w-max">
              {[...feedbacks, ...feedbacks].map((f, i) => (
                <div
                  key={i}
                  className="
                    min-w-[300px] max-w-sm bg-white rounded-xl shadow p-6 flex-shrink-0
                    dark:bg-zinc-800
                  "
                >
                  <p className="text-gray-600 dark:text-zinc-300 italic mb-4">{f.text}</p>
                  <h4 className="font-semibold text-emerald-700 dark:text-emerald-300">{f.name}</h4>
                  <span className="text-sm text-gray-500 dark:text-zinc-400">{f.role}</span>
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
