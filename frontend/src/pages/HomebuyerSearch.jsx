import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Heart, Search, MapPin, Home } from "lucide-react";
import api from "../api";
import ChatModal from "../components/ChatModel";

export default function HomebuyerSearch() {
    const [q, setQ] = useState("");
    const [location, setLocation] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");
    const [bedrooms, setBedrooms] = useState("");
    const [items, setItems] = useState([]);
    const [msg, setMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [enquiries, setEnquiries] = useState([]);
    const [activeChat, setActiveChat] = useState(null);

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    useEffect(() => {
        const savedToken = localStorage.getItem("token");
        if (savedToken) {
            api.defaults.headers.common["Authorization"] = `Bearer ${savedToken}`;
        }
    }, []);

    async function search() {
        setMsg("");
        setLoading(true);
        try {
            const params = {
                ...(q && { q }),
                ...(location && { location }),
                ...(minPrice && { min_price: minPrice }),
                ...(maxPrice && { max_price: maxPrice }),
                ...(bedrooms && { bedrooms }),
            };
            const { data } = await api.get("/homeowner/properties", { params });
            if (data?.success) setItems(data.items || []);
            else setMsg(data?.error || "Search failed");
        } catch {
            setMsg("Network error");
        } finally {
            setLoading(false);
        }
    }

    async function fetchEnquiries() {
        try {
            const res = await api.get(`/enquiries/buyer/${user.id}`);
            if (res.data.ok) {
                const active = (res.data.enquiries || []).filter(
                    (e) => e.status && e.status.toLowerCase() === "contacted"
                );
                setEnquiries(active);
            }
        } catch (err) {
            console.error("Failed to fetch enquiries", err);
        }
    }

    useEffect(() => {
        search();
        fetchEnquiries();
    }, []);

    function getEnquiry(propertyId) {
        return enquiries.find(
            (e) => String(e.property_id).trim() === String(propertyId).trim()
        );
    }

    function handleOpenChat(propertyId) {
        const enquiry = getEnquiry(propertyId);
        if (enquiry && enquiry.status === "Contacted") {
            setActiveChat(enquiry);
        }
    }

    return (
        <div className="homebuyer-page px-6 py-10 max-w-7xl mx-auto">
            <h2 className="text-3xl font-semibold text-emerald-700 mb-8">
                Find Your Dream Home
            </h2>

            {/* --- Search Filters --- */}
            <div className="bg-white rounded-xl shadow-md p-6 mb-10">
                <div className="grid md:grid-cols-5 gap-5">
                    <input
                        className="input border border-gray-300 rounded-lg p-2 w-full"
                        placeholder="Search by title or area"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <input
                        className="input border border-gray-300 rounded-lg p-2 w-full"
                        placeholder="Location"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                    />
                    <input
                        type="number"
                        className="input border border-gray-300 rounded-lg p-2 w-full"
                        placeholder="Min Price"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                    />
                    <input
                        type="number"
                        className="input border border-gray-300 rounded-lg p-2 w-full"
                        placeholder="Max Price"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
                    />
                    <input
                        type="number"
                        className="input border border-gray-300 rounded-lg p-2 w-full"
                        placeholder="Bedrooms"
                        value={bedrooms}
                        onChange={(e) => setBedrooms(e.target.value)}
                    />
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        onClick={search}
                        disabled={loading}
                        className="btn btn-primary flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg hover:bg-emerald-700 transition"
                    >
                        <Search size={16} />
                        {loading ? "Searching…" : "Search"}
                    </button>
                </div>
            </div>

            {msg && (
                <p className="text-center text-gray-600 mb-6 italic">{msg}</p>
            )}

            {/* --- Results Grid --- */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
                {items.length > 0 ? (
                    items.map((p) => {
                        const enquiry = getEnquiry(p.id);
                        const status = enquiry ? enquiry.status : null;

                        return (
                            <div
                                key={p.id}
                                className="bg-white rounded-xl shadow-md hover:shadow-lg transition overflow-hidden"
                            >
                                {/* 🏙️ Property Photo */}
                                {p.photos && p.photos.length > 0 ? (
                                    <img
                                        src={p.photos[0]}  // first Base64 image
                                        alt={p.title || "Property Photo"}
                                        className="w-full h-48 object-cover rounded-t-xl"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = "/placeholder.jpg"; // fallback
                                        }}
                                    />
                                ) : (
                                    <div className="h-48 bg-gray-200 flex items-center justify-center rounded-t-xl">
                                        <Home className="w-10 h-10 text-emerald-600 opacity-70" />
                                        </div>
                                )}

                                {/* --- Content --- */}
                                <div className="p-5">
                                    <h3 className="text-lg font-semibold text-gray-800 line-clamp-1">
                                        {p.title}
                                    </h3>
                                    <div className="text-emerald-700 font-bold text-xl mt-1">
                                        ${p.price.toLocaleString()}
                                    </div>

                                    <div className="text-gray-600 mt-2 flex items-center gap-1">
                                        <MapPin size={14} />
                                        <span>{p.location}</span>
                                    </div>

                                    <div className="text-gray-500 text-sm mt-1">
                                        {p.bedrooms} Bedroom{p.bedrooms > 1 ? "s" : ""}
                                    </div>

                                    {/* --- Actions --- */}
                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <Link
                                            to={`/properties/${p.id}`}
                                            className="px-3 py-2 text-sm border border-emerald-600 text-emerald-700 rounded-md hover:bg-emerald-600 hover:text-white transition"
                                        >
                                            View Details
                                        </Link>

                                        <button
                                            onClick={() =>
                                                alert("Save not implemented")
                                            }
                                            className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 flex items-center gap-1 transition"
                                        >
                                            <Heart size={15} /> Save
                                        </button>

                                        {status === "Contacted" && (
                                            <button
                                                onClick={() => handleOpenChat(p.id)}
                                                className="px-3 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 flex items-center gap-1 transition"
                                            >
                                                <MessageSquare size={15} /> Chat
                                            </button>
                                        )}
                                    </div>

                                    {/* --- Enquiry Info --- */}
                                    <div className="mt-3 border-t pt-2 text-sm text-gray-700">
                                        {enquiry ? (
                                            <>
                                                <div>
                                                    <strong>Status:</strong>{" "}
                                                    <span
                                                        className={
                                                            enquiry.status ===
                                                                "Contacted"
                                                                ? "text-green-600"
                                                                : "text-yellow-600"
                                                        }
                                                    >
                                                        {enquiry.status}
                                                    </span>
                                                </div>
                                                <div>
                                                    <strong>Agent:</strong>{" "}
                                                    {enquiry.agent_name}{" "}
                                                    <span className="text-gray-500">
                                                        ({enquiry.agent_email})
                                                    </span>
                                                </div>
                                                <div>
                                                    <strong>Message:</strong>{" "}
                                                    {enquiry.message || "-"}
                                                </div>
                                            </>
                                        ) : (
                                            <span className="text-gray-400">
                                                No enquiry yet
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full text-center text-gray-500">
                        No properties found
                    </div>
                )}
            </div>

            {/* --- Chat Modal --- */}
            {activeChat && (
                <ChatModal
                    enquiry={activeChat}
                    user={user}
                    onClose={() => setActiveChat(null)}
                />
            )}
        </div>
    );
}
