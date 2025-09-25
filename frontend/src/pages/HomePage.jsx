import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Brain, MapPin, Search, Shield, Users, Sparkles, BarChart3, Target } from "lucide-react";
import api from "../api"; // axios client

export default function HomePage() {
    const [searchQuery, setSearchQuery] = useState("");
    const [properties, setProperties] = useState([]);

    // fetch all properties across all agents
    useEffect(() => {
        api.get("/properties/all")
            .then((res) => setProperties(res.data || []))
            .catch((err) => console.error("Failed to load properties", err));
    }, []);


    const handleSearch = () => {
        console.log("Searching for:", searchQuery);
    };

    const features = [
        {
            icon: Brain,
            title: "AI Price Prediction",
            description: "Our AI analyzes market data to predict future property values with high accuracy.",
        },
        {
            icon: Target,
            title: "Smart Property Matching",
            description: "AI-powered recommendations that learn your preferences to find your dream home.",
        },
        {
            icon: BarChart3,
            title: "Market Intelligence",
            description: "Real-time insights into pricing trends, neighborhoods, and investments.",
        },
    ];

    const traditionalFeatures = [
        { icon: Shield, title: "Verified Listings", description: "All properties are vetted by our experts." },
        { icon: Users, title: "Trusted Agents", description: "Connect with certified professionals." },
        { icon: Sparkles, title: "Premium Experience", description: "A seamless, modern home-search journey." },
    ];

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white py-20">
                <div className="max-w-7xl mx-auto px-6 text-center space-y-8">
                    <span className="inline-flex items-center bg-white/20 text-white border border-white/30 text-sm px-4 py-2 rounded-full">
                        <Brain className="w-4 h-4 mr-2" /> AI-Powered Real Estate
                    </span>
                    <h1 className="text-5xl font-bold">
                        Find Your Dream Home with <span className="text-yellow-300">AI Intelligence</span>
                    </h1>
                    <p className="text-xl text-emerald-100 max-w-2xl mx-auto">
                        Explore listings, analyze market trends, and predict property values all in one place.
                    </p>

                    {/* Search bar */}
                    <div className="max-w-2xl mx-auto flex gap-4 bg-white p-4 rounded-lg shadow-lg">
                        <div className="flex-1 flex items-center space-x-3">
                            <MapPin className="w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search by location, property type..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full border-0 focus:ring-0 text-gray-800 placeholder-gray-500"
                                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg flex items-center gap-2"
                        >
                            <Search className="w-4 h-4" /> Search
                        </button>
                    </div>
                </div>
            </section>

            {/* AI Features */}
            <section className="py-20 bg-gradient-to-b from-purple-50 to-blue-50">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
                    {features.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div
                                key={i}
                                className="bg-white text-center p-8 rounded-xl border border-purple-100 hover:shadow-lg transition"
                            >
                                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon className="w-8 h-8 text-purple-600" />
                                </div>
                                <h3 className="text-xl font-semibold">{f.title}</h3>
                                <p className="text-gray-600 mt-2">{f.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* Featured Properties */}
            <section className="py-16 bg-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-3xl font-bold text-gray-900">Featured Properties</h2>
                        <Link to="/properties/all">
                            <button className="border border-emerald-200 text-emerald-700 px-4 py-2 rounded-lg hover:bg-emerald-50">
                                View All
                            </button>
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {properties.slice(0, 4).map((p) => (
                            <div key={p.id} className="bg-white rounded-xl shadow hover:shadow-lg transition overflow-hidden">
                                {p.photos && p.photos.length > 0 && (
                                    <img
                                        src={JSON.parse(p.photos)[0]} // first photo
                                        alt={p.title}
                                        className="w-full h-40 object-cover"
                                    />
                                )}
                                <div className="p-4">
                                    <h3 className="text-lg font-semibold">{p.title}</h3>
                                    <p className="text-gray-500 text-sm">{p.location}</p>
                                    <p className="text-emerald-700 font-bold mt-2">SGD {p.price}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Traditional Features */}
            <section className="py-16">
                <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-3 gap-8">
                    {traditionalFeatures.map((f, i) => {
                        const Icon = f.icon;
                        return (
                            <div key={i} className="bg-white text-center p-6 rounded-xl shadow hover:shadow-lg transition">
                                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Icon className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-semibold">{f.title}</h3>
                                <p className="text-gray-600 mt-2">{f.description}</p>
                            </div>
                        );
                    })}
                </div>
            </section>

            {/* AI Results Section */}
            <section className="py-16 bg-gray-900 text-white">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold mb-4">AI-Powered Results</h2>
                        <p className="text-gray-300">
                            See how our artificial intelligence is transforming real estate
                        </p>
                    </div>

                    <div className="grid md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-4xl font-bold text-purple-400 mb-2">95%</div>
                            <p className="text-gray-300">Price Prediction Accuracy</p>
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-blue-400 mb-2">47%</div>
                            <p className="text-gray-300">Faster Property Discovery</p>
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-green-400 mb-2">12x</div>
                            <p className="text-gray-300">More Market Insights</p>
                        </div>
                        <div>
                            <div className="text-4xl font-bold text-yellow-400 mb-2">98%</div>
                            <p className="text-gray-300">User Satisfaction Rate</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-16 bg-gradient-to-r from-emerald-50 to-purple-50">
                <div className="max-w-4xl mx-auto text-center px-6">
                    <h2 className="text-3xl font-bold text-gray-900 mb-4">
                        Ready to Experience AI-Powered Real Estate?
                    </h2>
                    <p className="text-gray-600 mb-8 text-lg">
                        Join thousands who've discovered their perfect homes with our AI
                        intelligence
                    </p>
                    <div className="flex justify-center space-x-4">
                        <Link to="/signup">
                            <button className="bg-gradient-to-r from-emerald-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold shadow">
                                Start AI-Powered Search
                            </button>
                        </Link>
                        <Link to="/signup">
                            <button className="border border-emerald-300 text-emerald-700 px-6 py-3 rounded-lg font-semibold hover:bg-emerald-50 transition">
                                List with AI Insights
                            </button>
                        </Link>
                    </div>

                </div>
            </section>

        </div>
    );
}
