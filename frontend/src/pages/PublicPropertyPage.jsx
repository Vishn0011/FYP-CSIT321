import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import Swal from "sweetalert2";
import {
    MapPin, Mail, Calendar, CheckCircle, ShieldCheck,
    History, Train, ShoppingCart, School, Hospital,
    Trees, Briefcase, Lock
} from "lucide-react";
import api from "../api";
import "../components/css/ViewIndividualProperties.css";

export default function PublicPropertyPage() {
    const { id } = useParams();

    const [property, setProperty] = useState(null);
    const [aiInsights, setAiInsights] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    const [form, setForm] = useState({
        buyer_name: "",
        buyer_email: "",
        buyer_phone: "",
        message: ""
    });

    const handleFormChange = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const storedUser = localStorage.getItem("user");
    const user = storedUser ? JSON.parse(storedUser) : null;
    const userRole = user?.role || "unauthenticated";
    const isAuthenticated = !!user;

    const galleryRef = useRef(null);
    const [displayPhotos, setDisplayPhotos] = useState([]);

    // --- Helper: safely parse photos field ---
    const parsePhotos = (raw) => {
        if (!raw) return [];
        try {
            if (Array.isArray(raw)) return raw;
            if (typeof raw === "string") {
                const cleaned = raw.trim();
                if (cleaned.startsWith("[")) return JSON.parse(cleaned);
                if (cleaned.startsWith("data:image")) return [cleaned];
                if (cleaned.includes(",")) return cleaned.split(",").map((s) => s.trim());
            }
        } catch (e) {
            console.warn("⚠️ Failed to parse photos:", e);
        }
        return [];
    };

    // --- 1️⃣ Fetch property details (public endpoint) ---
    useEffect(() => {
        if (!id) return setLoading(false);

        api.get(`/explore/properties/${id}`)
            .then((res) => {
                setProperty(res.data || {});
                setDisplayPhotos(parsePhotos(res.data?.photos));
            })
            .catch(() => setProperty(null))
            .finally(() => setLoading(false));
    }, [id]);

    // --- 2️⃣ Fetch AI insights (only for logged-in users) ---
    useEffect(() => {
        if (!property || !id) return;
        if (!isAuthenticated) return;

        const fetchAIInsights = async () => {
            try {
                const res = await api.get(`/predictions/property/${id}`);
                const latest = res.data?.[res.data.length - 1];
                setAiInsights(latest || { error: true });
            } catch {
                setAiInsights({ error: true });
            }
        };
        fetchAIInsights();
    }, [property, id, isAuthenticated]);

    // --- 3️⃣ Fetch Prediction History (only for logged-in users) ---
    useEffect(() => {
        if (!property?.latitude || !property?.longitude) return;
        if (!isAuthenticated) return;

        const fetchHistory = async () => {
            try {
                const res = await api.post("/predict/history/nearby", {
                    latitude: property.latitude,
                    longitude: property.longitude,
                });
                setHistory(res.data?.history || []);
            } catch (err) {
                console.error("❌ Error fetching nearby prediction history:", err);
            }
        };
        fetchHistory();
    }, [property, isAuthenticated]);

    // --- Helper: scroll gallery ---
    function scrollGallery(direction) {
        if (galleryRef.current) {
            const scrollAmount = galleryRef.current.clientWidth * 0.8;
            galleryRef.current.scrollBy({ left: direction * scrollAmount, behavior: "smooth" });
        }
    }

    // --- Enquiry Submit Handler ---
    const handleEnquirySubmit = async () => {
        if (!form.buyer_name || !form.buyer_email || !form.message) {
            Swal.fire({
                icon: "warning",
                title: "Missing Information",
                text: "Please fill in your name, email, and message.",
                confirmButtonColor: "#00674f",
            });
            return;
        }

        try {
            const res = await api.post("/enquiries", {
                property_id: property.id,
                agent_id: property.agent_id,
                buyer_name: form.buyer_name,
                buyer_email: form.buyer_email,
                buyer_phone: form.buyer_phone,
                message: form.message,
                is_authenticated: isAuthenticated,
            });

            if (res.data.ok) {
                Swal.fire({
                    icon: "success",
                    title: "Enquiry Sent!",
                    text: "Your message has been sent successfully. The agent will be in touch.",
                    confirmButtonColor: "#00674f",
                    timer: 3000,
                });
                setShowModal(false);
                setForm({ buyer_name: "", buyer_email: "", buyer_phone: "", message: "" });
            } else {
                Swal.fire({
                    icon: "error",
                    title: "Failed to Send",
                    text: res.data.error || "Failed to send enquiry. Please try again.",
                });
            }
        } catch {
            Swal.fire({
                icon: "error",
                title: "Server Error",
                text: "Something went wrong while sending your enquiry.",
            });
        }
    };

    // --- Rendering ---
    if (loading) return <p style={{ padding: "20px" }}>Loading property details...</p>;
    if (!property) return <p style={{ padding: "20px" }}>Property not found.</p>;

    return (
        <div className="property-details-page fade-in">
            {/* --- Breadcrumb --- */}
            <div className="breadcrumb">
                <span>Properties</span> &gt; <strong>{property?.title || "Loading..."}</strong>
            </div>

            {/* --- Photo Gallery --- */}
            <div className="photo-gallery-wrapper">
                <div className="photo-gallery" ref={galleryRef}>
                    {displayPhotos.length > 0 ? (
                        displayPhotos.map((src, i) => (
                            <div key={`${src}-${i}`} className="gallery-slide">
                                <img
                                    src={src}
                                    alt={`Photo ${i + 1}`}
                                    className="w-full h-96 object-cover"
                                    onError={(e) => {
                                        e.target.src = "/placeholder.jpg";
                                        e.target.style.opacity = 0.7;
                                    }}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="gallery-slide text-center text-gray-500">No photos available</div>
                    )}
                </div>
            </div>

            {/* --- Main Content --- */}
            <div className="property-content-grid">
                <div className="property-main-details">
                    {/* --- Price Card --- */}
                    <div className="card">
                        <div className="card-body">
                            <h2 className="price">
                                SGD {Number(property.price).toLocaleString()}
                            </h2>
                            <p className="text-gray-600">{property.location}</p>
                        </div>
                    </div>

                    {/* --- Location & Proximity --- */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-emerald-700 font-semibold mb-6 flex items-center gap-2">
                                <MapPin className="w-5 h-5" /> Location & Proximity
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ProximityItem icon={Train} label="Nearest MRT" name={property.nearest_mrt_name} distance={property.nearest_mrt_km} />
                                <ProximityItem icon={ShoppingCart} label="Nearest Mall" name={property.nearest_mall_name} distance={property.nearest_mall_km} />
                                <ProximityItem icon={School} label="Nearest School" name={property.nearest_school_name} distance={property.nearest_school_km} />
                                <ProximityItem icon={Hospital} label="Nearest Polyclinic" name={property.nearest_hospital_name} distance={property.nearest_hospital_km} />
                                <ProximityItem icon={Trees} label="Nearest Park" name={property.nearest_park_name} distance={property.nearest_park_km} />
                                <ProximityItem icon={Briefcase} label="Nearest Business Hub" name={property.nearest_business_name} distance={property.nearest_business_km} />
                            </div>
                        </div>
                    </div>

                    {/* --- 🔒 AI Insights Section --- */}
                    {!isAuthenticated ? (
                        <div className="card bg-gray-50 border border-gray-200 mb-6 text-center p-8">
                            <Lock className="w-10 h-10 text-gray-400 mx-auto mb-4" />
                            <h4 className="text-emerald-700 font-semibold mb-2">
                                Unlock Premium Market Insights
                            </h4>
                            <p className="text-gray-600 mb-6">
                                Create an account to view AI price predictions and detailed market history for this property.
                            </p>
                            <Link to="/signup" className="btn btn-primary inline-flex items-center gap-2">
                                Sign Up Now
                            </Link>
                        </div>
                    ) : (
                        <>
                            {/* --- AI Insights --- */}
                            {aiInsights && !aiInsights.error ? (
                                <div className="card bg-green-50 border border-green-200 mb-6">
                                    <div className="card-body">
                                        <h4 className="text-green-700 font-semibold mb-6 flex items-center gap-2">
                                            <ShieldCheck className="w-4 h-4" /> AI Market Analysis
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                            <div>
                                                <span className="text-sm text-gray-600">Predicted Future Price</span>
                                                <p className="text-2xl font-bold text-gray-900">
                                                    ${aiInsights.predicted_total_price?.toLocaleString() || "N/A"}
                                                </p>
                                            </div>
                                            {aiInsights.confidence_low && aiInsights.confidence_high && (
                                                <div>
                                                    <span className="text-sm text-gray-600">95% Confidence Range</span>
                                                    <p className="text-lg font-semibold text-gray-800">
                                                        ${aiInsights.confidence_low.toLocaleString()} – ${aiInsights.confidence_high.toLocaleString()}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-sm text-gray-600">AI Confidence Level</span>
                                                <p className="text-lg font-semibold text-gray-800">
                                                    {(aiInsights.confidence_score * 100).toFixed(1)}%
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic mt-4 mb-6">
                                    {aiInsights?.error ? "AI Insights unavailable." : "Fetching AI Insights..."}
                                </p>
                            )}

                            {/* --- Prediction History --- */}
                            <div className="card">
                                <div className="card-body">
                                    <details className="group">
                                        <summary className="flex items-center gap-2 text-emerald-700 font-semibold cursor-pointer">
                                            <History className="w-4 h-4" /> Prediction History
                                        </summary>
                                        {history.length > 0 ? (
                                            <div className="mt-4 overflow-x-auto">
                                                <table className="min-w-full border border-gray-200 rounded-md text-sm">
                                                    <tbody>
                                                        {history.map((h) => (
                                                            <tr key={h.id} className="hover:bg-emerald-50">
                                                                <td className="py-2 px-4 border-t">{h.created_at}</td>
                                                                <td className="py-2 px-4 border-t">{h.model_type}</td>
                                                                <td className="py-2 px-4 border-t">{h.predicted_price}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic mt-4">
                                                No prediction history yet.
                                            </p>
                                        )}
                                    </details>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- Sidebar --- */}
                <div className="property-sidebar">
                    <div className="property-info card sticky top-5 self-start">
                        <div className="card-body">
                            {property.agent && (
                                <div className="agent-info mb-4">
                                    <h4 className="font-semibold text-emerald-700">
                                        <ShieldCheck className="w-4 h-4 inline mr-1" />
                                        {property.agent.name} {property.agent.verified && "✔"}
                                    </h4>
                                    <p className="text-sm text-gray-600">{property.agent.email}</p>
                                </div>
                            )}

                            {/* Contact Agent – available to everyone */}
                            <div className="actions flex flex-col gap-2">
                                <button
                                    className="btn btn-primary flex items-center gap-2"
                                    onClick={() => setShowModal(true)}
                                >
                                    <Mail className="w-4 h-4" /> Contact Agent
                                </button>

                                {isAuthenticated && (
                                    <button className="btn btn-outline flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Schedule a Tour
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- Contact Modal --- */}
            {showModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3 className="modal-title flex items-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-700" /> Contact Agent
                        </h3>

                        <label>Your Name</label>
                        <input
                            name="buyer_name"
                            value={form.buyer_name}
                            onChange={handleFormChange}
                            placeholder="Enter your name"
                        />

                        <label>Email</label>
                        <input
                            name="buyer_email"
                            type="email"
                            value={form.buyer_email}
                            onChange={handleFormChange}
                            placeholder="Enter your email"
                        />

                        <label>Phone</label>
                        <input
                            name="buyer_phone"
                            type="tel"
                            value={form.buyer_phone}
                            onChange={handleFormChange}
                            placeholder="Enter your phone"
                        />

                        <label>Message</label>
                        <textarea
                            rows="3"
                            name="message"
                            value={form.message}
                            onChange={handleFormChange}
                            placeholder="Hi, I’m interested in this property..."
                        />

                        <div className="modal-actions">
                            <button onClick={() => setShowModal(false)} className="btn btn-outline">
                                Cancel
                            </button>
                            <button
                                onClick={handleEnquirySubmit}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Subcomponent: ProximityItem ---
function ProximityItem({ icon, label, name, distance }) {
    if (!distance) return null;
    const Icon = icon;
    return (
        <div className="flex items-start gap-3">
            <Icon className="w-5 h-5 text-emerald-600 mt-1" />
            <div>
                <span className="font-semibold text-gray-800">{label}</span>
                <p className="text-gray-600 text-sm">
                    {name || "N/A"} ({distance} km)
                </p>
            </div>
        </div>
    );
}
