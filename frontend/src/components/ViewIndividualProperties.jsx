import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import {
    MapPin,
    Mail,
    Calendar,
    CheckCircle,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Share2,
    Facebook,
    Twitter,
    Instagram,
    MessageCircle,
    Send,
    History,
    Filter,
    Train,
    ShoppingCart,
    School,
    Hospital,
    Trees,
    Briefcase,
    LineChart as LineChartIcon, // Renamed to avoid conflict
} from "lucide-react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import "./css/ViewIndividualProperties.css";

// ✅ Centralized Axios instance (auto uses /api)
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

export default function PropertyDetails() {
    const { id } = useParams();
    console.log("🧭 Property ID from URL:", id);

    const [property, setProperty] = useState(null);
    // --- 🚀 MODIFIED STATE ---
    // We now store two separate insights: one for current, one for future.
    const [aiCurrentInsight, setAiCurrentInsight] = useState(null);
    const [aiFutureInsight, setAiFutureInsight] = useState(null);
    // --------------------------
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [form, setForm] = useState({
        buyer_name: "",
        buyer_email: "",
        buyer_phone: "",
        message: "",
    });

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userRole = user?.role || "guest";
    const galleryRef = useRef(null);
    const [displayPhotos, setDisplayPhotos] = useState([]);
    const [showTourModal, setShowTourModal] = useState(false);
    const [tourForm, setTourForm] = useState({
        preferred_date: "",
        preferred_time: "",
        tour_type: "In-Person",
        message: "",
    });


    function scrollGallery(direction) {
        if (galleryRef.current) {
            const scrollAmount = galleryRef.current.clientWidth * 0.8;
            galleryRef.current.scrollBy({
                left: direction * scrollAmount,
                behavior: "smooth",
            });
        }
    }

    // --- Fetch property details (Unchanged) ---
    useEffect(() => {
        api
            .get(`/properties/${id}`)
            .then((res) => {
                setProperty(res.data);
                let fetchedPhotos = [];
                const rawPhotos = res.data.photos;
                try {
                    if (rawPhotos) {
                        if (Array.isArray(rawPhotos)) {
                            fetchedPhotos = rawPhotos;
                        } else if (typeof rawPhotos === "string") {
                            let cleaned = rawPhotos.trim();
                            if (cleaned.startsWith("[data:image")) {
                                cleaned = cleaned.slice(1, -1);
                                fetchedPhotos = cleaned.split("data:image").map((p, i) => {
                                    if (!p.trim()) return null;
                                    return `data:image${p.trim().startsWith(",") ? p : "," + p.trim()}`;
                                }).filter(Boolean);
                            }
                            else if (cleaned.startsWith("[")) {
                                fetchedPhotos = JSON.parse(cleaned);
                            }
                            else if (cleaned.startsWith("data:image")) {
                                fetchedPhotos = [cleaned];
                            }
                            else {
                                fetchedPhotos = cleaned.split(",").map((x) => x.trim());
                            }
                        }
                    }
                } catch (err) {
                    console.warn("⚠️ Failed to parse photos field:", err);
                    fetchedPhotos = [];
                }
                console.log("🖼️ Parsed Photos:", fetchedPhotos);
                setDisplayPhotos(fetchedPhotos);
            })
            .catch(() => console.error("Failed to fetch property details"))
            .finally(() => setLoading(false));
    }, [id]);


    // --- 🚀 MODIFIED: Fetch AI insights (from predictions table) ---
    useEffect(() => {
        if (!property || !id) return;

        console.log("🧠 Fetching AI insights from prediction table for property ID:", id);

        const fetchAIInsights = async () => {
            try {
                const res = await api.get(`/predictions/property/${id}`);

                if (res.data && res.data.length > 0) {
                    // --- NEW LOGIC ---
                    // Find the most recent "current" price prediction
                    const current = [...res.data].reverse().find(p =>
                        p.model_type && p.model_type.includes("current")
                    );
                    // Find the most recent "future" price prediction
                    const future = [...res.data].reverse().find(p =>
                        p.model_type && p.model_type.includes("future")
                    );

                    if (current) {
                        setAiCurrentInsight(current);
                        console.log("✅ Loaded CURRENT AI insight from DB:", current);
                    } else {
                        console.log("⚠️ No CURRENT AI prediction found.");
                        setAiCurrentInsight({ error: true });
                    }

                    if (future) {
                        setAiFutureInsight(future);
                        console.log("✅ Loaded FUTURE AI insight from DB:", future);
                    } else {
                        console.log("⚠️ No FUTURE AI prediction found.");
                        setAiFutureInsight({ error: true });
                    }
                    // --- END NEW LOGIC ---

                } else {
                    console.log("⚠️ No AI predictions found for this property.");
                    setAiCurrentInsight({ error: true });
                    setAiFutureInsight({ error: true });
                }
            } catch (err) {
                console.error("❌ Error fetching AI insights:", err);
                setAiCurrentInsight({ error: true });
                setAiFutureInsight({ error: true });
            }
        };

        fetchAIInsights();
    }, [property, id]);
    // -----------------------------------------------------------------


    // ✅ Fetch Location-Based Prediction History (Unchanged)
    useEffect(() => {
        if (!property?.latitude || !property?.longitude) return;

        const fetchNearbyPredictions = async () => {
            try {
                const res = await api.post("/predict/history/nearby", {
                    latitude: property.latitude,
                    longitude: property.longitude,
                });

                if (res.data.history) {
                    setHistory(res.data.history);
                    console.log("📊 Nearby Prediction History:", res.data.history);
                }
            } catch (err) {
                console.error("❌ Error fetching nearby prediction history:", err);
            }
        };

        fetchNearbyPredictions();
    }, [property]);


    if (loading) {
        return <p style={{ padding: "20px" }}>Loading property details...</p>;
    }

    if (!property) {
        return <p style={{ padding: "20px" }}>Property not found.</p>;
    }

    const photos = displayPhotos;

    const getActivityWidth = (activity) => {
        if (activity === "Highly responsive") return "100%";
        if (activity === "Active this week") return "70%";
        if (activity === "Occasionally active") return "40%";
        return "20%";
    };

    const handleShare = (platform) => {
        const url = window.location.href;
        const text = `Check out this property on Aspect Real Estate: ${property?.title || 'Unknown Property'} at ${property?.location || 'Unknown Location'}`;
        let shareUrl = "";

        switch (platform) {
            case "facebook":
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
                break;
            case "twitter":
                shareUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case "whatsapp":
                shareUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + url)}`;
                break;
            case "telegram":
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
                break;
            case "instagram":
                Swal.fire({
                    icon: "info",
                    title: "Instagram Sharing",
                    text: "Instagram does not support direct URL sharing. You can copy the link instead.",
                    showCancelButton: true,
                    confirmButtonText: "Copy Link",
                    cancelButtonText: "Cancel",
                    confirmButtonColor: "#00674f",
                }).then((res) => {
                    if (res.isConfirmed) {
                        navigator.clipboard.writeText(url);
                        Swal.fire({
                            icon: "success",
                            title: "Link Copied!",
                            text: "You can paste it directly into your Instagram bio or story.",
                            timer: 2000,
                            showConfirmButton: false,
                        });
                    }
                });
                return;
            default:
                return;
        }

        window.open(shareUrl, "_blank");
    };

    const ProximityItem = ({ icon, label, name, distance }) => {
        if (!distance) return null;
        const Icon = icon;
        return (
            <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 text-emerald-600 mt-1" />
                <div>
                    <span className="font-semibold text-gray-800">{label}</span>
                    <p className="text-gray-600 text-sm">{name || "N/A"} ({distance} km)</p>
                </div>
            </div>
        );
    };

    // --- 🚀 NEW: Re-create insight logic for display (with User/Agent check) ---
    let insightText = "⚠️ AI analysis pending.";
    let insightColorClass = "text-gray-500";

    // First, check if the AI insight exists and is valid
    if (aiCurrentInsight && !aiCurrentInsight.error && property) {
        const actual = parseFloat(property.price || 0);
        const aiPrice = parseFloat(aiCurrentInsight.predicted_current || 0);

        if (aiPrice > 0 && actual > 0) {
            const diff = ((actual - aiPrice) / aiPrice) * 100;

            // --- ✅ NEW LOGIC HERE ---
            // Check the user's role and set the phrasing
            if (userRole === "agent") {
                // --- AGENT PHRASING ---
                if (Math.abs(diff) <= 5) {
                    insightText = "✅ Market Aligned — Your listing price is in line with the AI's current market prediction. This is a solid, well-justified pricing strategy.";
                    insightColorClass = "text-green-700 font-semibold";
                } else if (diff > 5) {
                    insightText = "🔴 Above Market — Your listing is priced significantly above the AI's prediction. This may result in fewer viewings. Consider reviewing your comparable properties.";
                    insightColorClass = "text-red-700 font-semibold";
                } else {
                    insightText = "🟢 Competitive Price — Your listing is priced below the AI's predicted value. This strategy may attract more buyers and lead to a faster sale.";
                    insightColorClass = "text-emerald-700 font-semibold";
                }
            } else {
                // --- USER (HOMEBUYER) PHRASING ---
                if (Math.abs(diff) <= 5) {
                    insightText = "✅ Fair Price — This property is aligned with its estimated market value.";
                    insightColorClass = "text-green-700 font-semibold";
                } else if (diff > 5) {
                    insightText = "🔴 Above Market — This property is listed higher than its estimated market value. There may be room for negotiation.";
                    insightColorClass = "text-red-700 font-semibold";
                } else {
                    insightText = "🟢 Good Price — This property is listed below its estimated market value.";
                    insightColorClass = "text-emerald-700 font-semibold";
                }
            }
            // --- ✅ END NEW LOGIC ---

        } else if (actual === 0) {
            insightText = "⚠️ No listed price entered for comparison.";
        }
    }
    // ----------------------------------------------------

    return (
        <div className="property-details-page fade-in">
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <span>Properties</span> &gt; <strong>{property?.title || 'Loading...'}</strong>
            </div>

            {/* --- Editing Message Banner --- */}
            {editingMessage && (
                <div className="editing-banner">
                    <Filter className="w-5 h-5 animate-spin" /> {editingMessage}
                </div>
            )}

            {/* --- Gallery (Unchanged) --- */}
            <div className="photo-gallery-wrapper">
                <div className="photo-gallery" ref={galleryRef}>
                    {displayPhotos && displayPhotos.length > 0 ? (
                        displayPhotos.map((src, i) => (
                            <div key={`${src}-${i}`} className="gallery-slide">
                                <img
                                    src={
                                        src.startsWith("data:image") || src.startsWith("blob:")
                                            ? src
                                            : src.startsWith("http")
                                                ? src
                                                : `${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}${src}`
                                    }
                                    alt={`Photo ${i + 1}`}
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "/placeholder.jpg"; // 🖼️ fallback image
                                        e.target.style.opacity = 0.7;
                                    }}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="gallery-slide">
                            <p className="text-gray-500">No photos available</p>
                        </div>
                    )}
                </div>

                {displayPhotos.length > 1 && (
                    <>
                        <button
                            className="gallery-nav left"
                            onClick={() => scrollGallery(-1)}
                            aria-label="Previous image"
                        >
                            <ChevronLeft className="w-5 h-5 text-emerald-700" />
                        </button>
                        <button
                            className="gallery-nav right"
                            onClick={() => scrollGallery(1)}
                            aria-label="Next image"
                        >
                            <ChevronRight className="w-5 h-5 text-emerald-700" />
                        </button>
                    </>
                )}
            </div>

            {/* --- Content Grid (Unchanged Layout) --- */}
            <div className="property-content-grid">

                {/* --- Main Details Column (Left) --- */}
                <div className="property-main-details">

                    {/* --- Price & Info Header Card (Unchanged) --- */}
                    <div className="card">
                        <div className="card-body">
                            <h2 className="price">
                                SGD {Number(property.price).toLocaleString()}
                            </h2>
                            <p className="location flex items-center">
                                <MapPin className="w-4 h-4 mr-1 text-emerald-700" />
                                {property?.location}
                            </p>

                            <h3 className="details-title">Property Details</h3>
                            <ul className="details-list">
                                <li><strong>Bedrooms:</strong> {property.bedrooms}</li>
                                <li><strong>Bathrooms:</strong> {property.bathrooms}</li>
                                <li><strong>Sq. Footage:</strong> {property.size} sqft</li>
                                <li><strong>Status:</strong> {property.status}</li>
                                <li><strong>Type:</strong> {property.property_type}</li>
                            </ul>

                            <p className="short-desc mt-4">
                                {property?.description}
                            </p>
                        </div>
                    </div>

                    {/* --- Location & Proximity Card (Unchanged) --- */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-emerald-700 font-semibold mb-6 flex items-center gap-2">
                                <MapPin className="w-5 h-5" /> Location & Proximity
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <ProximityItem
                                    icon={Train}
                                    label="Nearest MRT"
                                    name={property.nearest_mrt_name}
                                    distance={property.nearest_mrt_km}
                                />
                                <ProximityItem
                                    icon={ShoppingCart}
                                    label="Nearest Mall"
                                    name={property.nearest_mall_name}
                                    distance={property.nearest_mall_km}
                                />
                                <ProximityItem
                                    icon={School}
                                    label="Nearest School"
                                    name={property.nearest_school_name}
                                    distance={property.nearest_school_km}
                                />
                                <ProximityItem
                                    icon={Hospital}
                                    label="Nearest Polyclinic"
                                    name={property.nearest_hospital_name}
                                    distance={property.nearest_hospital_km}
                                />
                                <ProximityItem
                                    icon={Trees}
                                    label="Nearest Park"
                                    name={property.nearest_park_name}
                                    distance={property.nearest_park_km}
                                />
                                <ProximityItem
                                    icon={Briefcase}
                                    label="Nearest Business Hub"
                                    name={property.nearest_business_name}
                                    distance={property.nearest_business_km}
                                />
                            </div>
                        </div>
                    </div>


                    {/* --- 🚀 NEW: AI Current Price Evaluation Card --- */}
                    <div className="card">
                        <div className="card-body">
                            <h3 className="text-emerald-700 font-semibold mb-6 flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" /> AI Current Price Evaluation
                            </h3>
                            {aiCurrentInsight && !aiCurrentInsight.error ? (
                                <>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                        {/* Your Listed Price */}
                                        <div>
                                            <span className="text-sm text-gray-600">Your Listed Price</span>
                                            <p className="text-2xl font-bold text-gray-900">
                                                ${Number(property.price).toLocaleString()}
                                            </p>
                                        </div>
                                        {/* Predicted Market Price */}
                                        <div>
                                            <span className="text-sm text-gray-600">Predicted Market Price</span>
                                            <p className="text-2xl font-bold text-emerald-700">
                                                ${aiCurrentInsight.predicted_current
                                                    ? Number(aiCurrentInsight.predicted_current).toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                    : "N/A"
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    {/* Insight Text */}
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <p className={`text-sm ${insightColorClass}`}>
                                            {insightText}
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <div className="text-gray-500 italic">
                                    {aiCurrentInsight?.error
                                        ? "Current price analysis unavailable for this property."
                                        : "Fetching current price analysis..."}
                                </div>
                            )}
                        </div>
                    </div>
                    {/* ------------------------------------------------ */}


                    {/* --- 🚀 MODIFIED: AI Future Forecast Card --- */}
                    {aiFutureInsight && !aiFutureInsight.error ? (
                        <div className="card bg-green-50 border border-green-200">
                            <div className="card-body">
                                <h4 className="text-green-700 font-semibold mb-6 flex items-center gap-2">
                                    <LineChartIcon className="w-4 h-4" /> 📈 AI Future Forecast
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                                    {/* Predicted Future Price */}
                                    <div>
                                        <span className="text-sm text-gray-600">Predicted Future Price</span>
                                        <p className="text-2xl font-bold text-gray-900">
                                            $
                                            {aiFutureInsight.predicted_total_price
                                                ? aiFutureInsight.predicted_total_price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                : aiFutureInsight.predicted_price
                                                    ? aiFutureInsight.predicted_price.toLocaleString(undefined, { maximumFractionDigits: 0 })
                                                    : "N/A"}
                                        </p>
                                    </div>

                                    {/* 95% Confidence Range */}
                                    {aiFutureInsight.confidence_low && aiFutureInsight.confidence_high && (
                                        <div>
                                            <span className="text-sm text-gray-600">95% Confidence Range</span>
                                            <p className="text-lg font-semibold text-gray-800">
                                                ${aiFutureInsight.confidence_low.toLocaleString(undefined, { maximumFractionDigits: 0 })} – $
                                                {aiFutureInsight.confidence_high.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </p>
                                        </div>
                                    )}

                                    {/* Price per sqm */}
                                    <div>
                                        <span className="text-sm text-gray-600">Price per sqm</span>
                                        <p className="text-lg font-semibold text-gray-800">
                                            $
                                            {(() => {
                                                if (aiFutureInsight.predicted_price_per_sqm)
                                                    return aiFutureInsight.predicted_price_per_sqm.toLocaleString(undefined, { maximumFractionDigits: 2 });

                                                const price = aiFutureInsight.predicted_total_price || aiFutureInsight.predicted_price;
                                                const area = property?.floor_area_sqm || (property?.size ? property.size * 0.092903 : 0);

                                                if (price && area > 0) {
                                                    const perSqm = price / area;
                                                    return perSqm.toLocaleString(undefined, {
                                                        minimumFractionDigits: 2,
                                                        maximumFractionDigits: 2,
                                                    });
                                                }
                                                return "N/A";
                                            })()}
                                        </p>
                                    </div>

                                    {/* AI Confidence Level */}
                                    {aiFutureInsight.confidence_score && (
                                        <div>
                                            <span className="text-sm text-gray-600">AI Confidence Level</span>
                                            <p className="text-lg font-semibold text-gray-800">
                                                {(
                                                    aiFutureInsight.confidence_score > 1
                                                        ? aiFutureInsight.confidence_score
                                                        : aiFutureInsight.confidence_score * 100
                                                ).toFixed(1)}
                                                %
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-gray-500 italic mt-4">
                            {aiFutureInsight?.error
                                ? "AI Future Forecast unavailable for this property."
                                : "Fetching AI Future Forecast..."}
                        </div>
                    )}
                    {/* ------------------------------------------------ */}


                    {/* --- ✅ MODIFIED: Prediction History Card --- */}
                    <div className="card">
                        <div className="card-body">
                            <details className="group" open> {/* Default to open */}
                                <summary className="flex items-center gap-2 text-emerald-700 font-semibold cursor-pointer">
                                    <History className="w-4 h-4" />
                                    Nearby Prediction History (1km)
                                    <span className="ml-auto text-gray-500 text-sm group-open:hidden">▼</span>
                                    <span className="ml-auto text-gray-500 text-sm hidden group-open:inline">▲</span>
                                </summary>

                                {history.length > 0 ? (
                                    <div className="mt-4 overflow-x-auto">
                                        <table className="min-w-full border border-gray-200 rounded-md text-sm">
                                            <thead className="bg-emerald-50">
                                                <tr>
                                                    {/* --- ✅ MODIFIED HEADERS --- */}
                                                    <th className="py-2 px-4 text-left">Date</th>
                                                    <th className="py-2 px-4 text-left">Listed Price</th>
                                                    <th className="py-2 px-4 text-left">AI Predicted Price</th>
                                                    <th className="py-2 px-4 text-left">Dist (km)</th>
                                                    <th className="py-2 px-4 text-left">AI Confidence</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {history.map((h) => (
                                                    // --- ✅ MODIFIED KEY AND COLUMNS ---
                                                    <tr key={h.property_id + h.created_at} className="hover:bg-emerald-50">
                                                        <td className="py-2 px-4 border-t">{h.created_at}</td>
                                                        <td className="py-2 px-4 border-t font-semibold">{h.listed_price}</td>
                                                        <td className="py-2 px-4 border-t font-semibold text-emerald-700">{h.predicted_price}</td>
                                                        <td className="py-2 px-4 border-t">{h.distance_km}</td>
                                                        <td className="py-2 px-4 border-t">{h.ai_confidence}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-gray-500 italic mt-4">
                                        {/* ✅ MODIFIED Message */}
                                        No other predictions found within 1km of this property.
                                    </p>
                                )}
                            </details>
                        </div>
                    </div>
                </div>

                {/* --- Sticky Sidebar Column (Right) (Unchanged) --- */}
                <div className="property-sidebar">
                    <div className="property-info card sticky top-5 self-start">
                        <div className="card-body">
                            {/* --- Agent Info --- */}
                            {property.agent && (
                                <div className="agent-info">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-800">
                                            Agent: {property.agent.name}
                                        </span>
                                        {property.agent.verified && (
                                            <span className="verified-badge">✔ Verified</span>
                                        )}
                                    </div>
                                    <p className="agent-activity">
                                        {property.agent.activity}
                                        {property.agent.last_active && (
                                            <span className="ml-1 text-gray-500">
                                                (Last active:{" "}
                                                {new Date(property.agent.last_active).toLocaleString("en-SG", {
                                                    dateStyle: "medium",
                                                    timeStyle: "short",
                                                })}
                                                )
                                            </span>
                                        )}
                                    </p>
                                    <div className="agent-activity-bar">
                                        <div
                                            className="agent-activity-fill"
                                            style={{
                                                width: getActivityWidth(property.agent.activity),
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* --- Homeowner actions --- */}
                            {userRole === "homeowner" && (
                                <div className="actions">
                                    <button
                                        className="btn btn-primary flex items-center gap-2"
                                        onClick={() => setShowModal(true)}
                                    >
                                        <Mail className="w-4 h-4" /> Contact Agent
                                    </button>
                                    <button
                                        className="btn btn-outline flex items-center gap-2"
                                        onClick={() => setShowTourModal(true)}
                                    >
                                        <Calendar className="w-4 h-4" /> Schedule a Tour
                                    </button>
                                </div>
                            )}

                            {/* --- Share Listing --- */}
                            <div className="share-listing mt-6">
                                <h4 className="text-gray-700 font-semibold flex items-center gap-2 mb-2">
                                    <Share2 className="w-4 h-4 text-emerald-700" /> Share this Listing
                                </h4>
                                <div className="share-icons">
                                    <button onClick={() => handleShare("facebook")} className="share-btn facebook">
                                        <Facebook className="w-4 h-4" /> Facebook
                                    </button>
                                    <button onClick={() => handleShare("twitter")} className="share-btn twitter">
                                        <Twitter className="w-4 h-4" /> Twitter
                                    </button>
                                    <button onClick={() => handleShare("whatsapp")} className="share-btn whatsapp">
                                        <MessageCircle className="w-4 h-4" /> WhatsApp
                                    </button>
                                    <button onClick={() => handleShare("telegram")} className="share-btn telegram">
                                        <Send className="w-4 h-4" /> Telegram
                                    </button>
                                    <button onClick={() => handleShare("instagram")} className="share-btn instagram">
                                        <Instagram className="w-4 h-4" /> Instagram
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div> {/* <-- END OF property-content-grid --> */}


            {/* --- Contact Modal (Homeowner only)--- */}
            {userRole === "homeowner" && showModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3 className="modal-title flex items-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-700" /> Contact Agent
                        </h3>

                        {property.agent && (
                            <div className="agent-modal-info mb-4">
                                <h4 className="font-semibold text-emerald-700 flex items-center gap-2">
                                    <ShieldCheck className="w-4 h-4" />
                                    Contacting {property.agent.name}{" "}
                                    {property.agent.verified && (
                                        <span className="verified-badge">✔ Verified</span>
                                    )}
                                </h4>
                                <p className="text-sm text-gray-700">
                                    {property.agent.activity}
                                    {property.agent.last_active && (
                                        <> — Last active{" "}
                                            {new Date(property.agent.last_active).toLocaleString("en-SG", {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            })}
                                        </>
                                    )}
                                </p>
                                <div className="agent-activity-bar mt-2">
                                    <div
                                        className="agent-activity-fill"
                                        style={{
                                            width: getActivityWidth(property.agent.activity),
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        <label>Your Name</label>
                        <input
                            type="text"
                            value={form.buyer_name}
                            onChange={(e) => setForm({ ...form, buyer_name: e.target.value })}
                            placeholder="Enter your name"
                        />

                        <label>Email</label>
                        <input
                            type="email"
                            value={form.buyer_email}
                            onChange={(e) => setForm({ ...form, buyer_email: e.target.value })}
                            placeholder="Enter your email"
                        />

                        <label>Phone (optional)</label>
                        <input
                            type="tel"
                            value={form.buyer_phone}
                            onChange={(e) => setForm({ ...form, buyer_phone: e.target.value })}
                            placeholder="Enter your phone"
                        />

                        <label>Message</label>
                        <textarea
                            rows="3"
                            value={form.message}
                            onChange={(e) => setForm({ ...form, message: e.target.value })}
                            placeholder="Hi, I’m interested in this property..."
                        ></textarea>

                        <div className="modal-actions">
                            <button
                                onClick={() => setShowModal(false)}
                                className="btn btn-outline"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await api.post("/enquiries", {
                                            property_id: property.id,
                                            agent_id: property.agent_id,
                                            buyer_name: form.buyer_name,
                                            buyer_email: form.buyer_email,
                                            buyer_phone: form.buyer_phone,
                                            message: form.message,
                                        });

                                        if (res.data.ok) {
                                            Swal.fire({
                                                icon: "success",
                                                title: "Enquiry Sent!",
                                                text: "Your message has been sent successfully.",
                                                confirmButtonColor: "#00674f",
                                                timer: 2000,
                                            });
                                            setShowModal(false);
                                            setForm({
                                                buyer_name: "",
                                                buyer_email: "",
                                                buyer_phone: "",
                                                message: "",
                                            });
                                        } else {
                                            Swal.fire({
                                                icon: "error",
                                                title: "Failed to Send",
                                                text: res.data.error || "Failed to send enquiry. Please try again.",
                                            });
                                        }
                                    } catch (err) {
                                        Swal.fire({
                                            icon: "error",
                                            title: "Server Error",
                                            text: "Something went wrong while sending your enquiry.",
                                        });
                                    }
                                }}
                                className="btn btn-primary flex items-center gap-2"
                            >
                                <CheckCircle className="w-4 h-4" /> Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* --- Schedule a tour Modal (Homeowner only)--- */}
            {userRole === "homeowner" && showTourModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3 className="modal-title flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-emerald-700" /> Schedule a Property Tour
                        </h3>

                        <label>Date</label>
                        <input
                            type="date"
                            value={tourForm.preferred_date}
                            onChange={(e) => setTourForm({ ...tourForm, preferred_date: e.target.value })}
                        />

                        <label>Time</label>
                        <input
                            type="time"
                            value={tourForm.preferred_time}
                            onChange={(e) => setTourForm({ ...tourForm, preferred_time: e.target.value })}
                        />

                        <label>Tour Type</label>
                        <select
                            value={tourForm.tour_type}
                            onChange={(e) => setTourForm({ ...tourForm, tour_type: e.target.value })}
                        >
                            <option>In-Person</option>
                            <option>Virtual</option>
                        </select>

                        <label>Message (Optional)</label>
                        <textarea
                            rows="2"
                            value={tourForm.message}
                            onChange={(e) => setTourForm({ ...tourForm, message: e.target.value })}
                            placeholder="Any notes or preferences..."
                        />

                        <div className="modal-actions">
                            <button className="btn btn-outline" onClick={() => setShowTourModal(false)}>
                                Cancel
                            </button>

                            <button
                                className="btn btn-primary flex items-center gap-2"
                                onClick={async () => {
                                    try {
                                        const res = await api.post("/tours", {
                                            property_id: property.id,
                                            agent_id: property.agent_id,
                                            user_id: user.id,
                                            ...tourForm,
                                        });

                                        if (res.data.ok) {
                                            Swal.fire({
                                                icon: "success",
                                                title: "Tour Request Sent!",
                                                text: "The agent has been notified.",
                                                confirmButtonColor: "#00674f",
                                            });
                                            setShowTourModal(false);
                                        }
                                    } catch (err) {
                                        Swal.fire("Error", "Unable to schedule tour.", "error");
                                    }
                                }}
                            >
                                <CheckCircle className="w-4 h-4" /> Request Tour
                            </button>
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}