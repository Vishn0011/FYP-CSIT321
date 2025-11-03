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
    Filter, // ✅ Corrected icon name
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
    const [aiInsights, setAiInsights] = useState(null);
    const [history, setHistory] = useState([]); // ✅ Added state for history
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null); // State for edit messages
    const [form, setForm] = useState({
        buyer_name: "",
        buyer_email: "",
        buyer_phone: "",
        message: "",
    });

    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userRole = user?.role || "guest";
    const galleryRef = useRef(null);

    // --- State for displayed photos ---
    const [displayPhotos, setDisplayPhotos] = useState([]);

    // --- Scroll gallery ---
    function scrollGallery(direction) {
        if (galleryRef.current) {
            const scrollAmount = galleryRef.current.clientWidth * 0.8;
            galleryRef.current.scrollBy({
                left: direction * scrollAmount,
                behavior: "smooth",
            });
        }
    }

    // --- Fetch property details ---
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
                            // Already a valid array
                            fetchedPhotos = rawPhotos;
                        } else if (typeof rawPhotos === "string") {
                            let cleaned = rawPhotos.trim();

                            // ✅ Handle invalid "[data:image...]" (not real JSON)
                            if (cleaned.startsWith("[data:image")) {
                                // Remove [ ] and split on commas between data URLs
                                cleaned = cleaned.slice(1, -1);
                                fetchedPhotos = cleaned.split("data:image").map((p, i) => {
                                    if (!p.trim()) return null;
                                    return `data:image${p.trim().startsWith(",") ? p : "," + p.trim()}`;
                                }).filter(Boolean);
                            }

                            // ✅ Handle valid JSON-encoded arrays
                            else if (cleaned.startsWith("[")) {
                                fetchedPhotos = JSON.parse(cleaned);
                            }

                            // ✅ Handle single data:image strings
                            else if (cleaned.startsWith("data:image")) {
                                fetchedPhotos = [cleaned];
                            }

                            // ✅ Handle comma-separated plain URLs
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


    // --- Fetch AI insights (from predictions table) ---
    useEffect(() => {
        if (!property || !id) return;

        console.log("🧠 Fetching AI insights from prediction table for property ID:", id);

        const fetchAIInsights = async () => {
            try {
                const res = await api.get(`/predictions/property/${id}`); // ✅ new API route
                if (res.data && res.data.length > 0) {
                    const latestPrediction = res.data[res.data.length - 1]; // ✅ get most recent
                    setAiInsights(latestPrediction);
                    console.log("✅ Loaded AI insights from DB:", latestPrediction);
                } else {
                    console.log("⚠️ No AI prediction found for this property.");
                    setAiInsights({ error: true });
                }
            } catch (err) {
                console.error("❌ Error fetching AI insights:", err);
                setAiInsights({ error: true });
            }
        };

        fetchAIInsights();
    }, [property, id]);




    // ✅ Fetch Location-Based Prediction History
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

    // Use the mutable state for photos array in rendering
    const photos = displayPhotos;

    // --- Activity bar width helper ---
    const getActivityWidth = (activity) => {
        if (activity === "Highly responsive") return "100%";
        if (activity === "Active this week") return "70%";
        if (activity === "Occasionally active") return "40%";
        return "20%";
    };

    // --- Share listing ---
    const handleShare = (platform) => {
        const url = window.location.href;
        // 🚨 Null check added here for property.title
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

    return (
        <div className="property-details-page fade-in">
            {/* Breadcrumb */}
            <div className="breadcrumb">
                {/* 🚨 Optional chaining added here */}
                <span>Properties</span> &gt; <strong>{property?.title || 'Loading...'}</strong>
            </div>

            {/* --- Editing Message Banner --- */}
            {editingMessage && (
                <div className="editing-banner">
                    <Filter className="w-5 h-5 animate-spin" /> {editingMessage}
                </div>
            )}

            <div className="property-details-grid">
                {/* --- Photo Gallery --- */}
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




                {/* --- Property Info --- */}
                <div className="property-info card">
                    <div className="card-body">
                        <h2 className="price">
                            SGD {Number(property.price).toLocaleString()}
                        </h2>
                        <p className="location flex items-center">
                            <MapPin className="w-4 h-4 mr-1 text-emerald-700" />
                            {/* 🚨 Optional chaining added here */}
                            {property?.location}
                        </p>
                        <p className="short-desc">
                            {/* 🚨 Optional chaining added here */}
                            {property?.description?.substring(0, 100)}...
                        </p>

                        {/* --- Agent Info --- */}
                        {/* 🚨 Null check added here */}
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
                                    {/* 🚨 Optional chaining added here */}
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

                        <h3 className="details-title">Property Details</h3>
                        <ul className="details-list">
                            {/* 🚨 Optional chaining added here */}
                            <li><strong>Bedrooms:</strong> {property.bedrooms}</li>
                            <li><strong>Bathrooms:</strong> {property.bathrooms}</li>
                            <li><strong>Sq. Footage:</strong> {property.size} sqft</li>
                            <li><strong>Status:</strong> {property.status}</li>
                            <li><strong>Type:</strong> {property.property_type}</li>
                        </ul>

                        {/* --- Share Listing (No changes needed) --- */}
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

                        {/* --- Homeowner actions (No changes needed) --- */}
                        {userRole === "homeowner" && (
                            <div className="actions">
                                <button
                                    className="btn btn-primary flex items-center gap-2"
                                    onClick={() => setShowModal(true)}
                                >
                                    <Mail className="w-4 h-4" /> Contact Agent
                                </button>
                                <button className="btn btn-outline flex items-center gap-2">
                                    <Calendar className="w-4 h-4" /> Schedule a Tour
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* --- AI Insights Section --- */}
            {aiInsights && !aiInsights.error ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
                    <h4 className="text-green-700 font-semibold mb-2 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> AI Market Analysis
                    </h4>

                    <ul className="text-gray-700 list-disc list-inside space-y-1">
                        {/* --- Predicted Future Price --- */}
                        <li>
                            Predicted Future Price:{" "}
                            <strong>
                                $
                                {aiInsights.predicted_total_price
                                    ? aiInsights.predicted_total_price.toLocaleString()
                                    : aiInsights.predicted_price
                                        ? aiInsights.predicted_price.toLocaleString()
                                        : "N/A"}
                            </strong>
                        </li>

                        {/* --- Price per sqm (calculated if missing) --- */}
                        <li>
                            Price per sqm:{" "}
                            <strong>
                                $
                                {(() => {
                                    if (aiInsights.predicted_price_per_sqm)
                                        return aiInsights.predicted_price_per_sqm.toLocaleString();

                                    const price =
                                        aiInsights.predicted_total_price ||
                                        aiInsights.predicted_price;
                                    const area =
                                        property?.floor_area_sqm ||
                                        (property?.size ? property.size * 0.092903 : 0);

                                    if (price && area > 0) {
                                        const perSqm = price / area;
                                        return perSqm.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        });
                                    }
                                    return "N/A";
                                })()}
                            </strong>
                        </li>

                        {/* --- Confidence Range --- */}
                        {aiInsights.confidence_low && aiInsights.confidence_high && (
                            <li>
                                95% Confidence Range:{" "}
                                <strong>
                                    ${aiInsights.confidence_low.toLocaleString()} – $
                                    {aiInsights.confidence_high.toLocaleString()}
                                </strong>
                            </li>
                        )}

                        {/* --- Confidence Score --- */}
                        {aiInsights.confidence_score && (
                            <li>
                                AI Confidence Level:{" "}
                                <strong>
                                    {(
                                        aiInsights.confidence_score > 1
                                            ? aiInsights.confidence_score
                                            : aiInsights.confidence_score * 100
                                    ).toFixed(1)}
                                    %
                                </strong>{" "}
                            </li>
                        )}
                    </ul>
                </div>
            ) : (
                <div className="text-gray-500 italic mt-4">
                    {aiInsights?.error
                        ? "AI Insights unavailable for this property."
                        : "Fetching AI Insights..."}
                </div>
            )}



            {/* ✅ Prediction History Section (Collapsible - No changes needed) */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6 shadow-sm">
                <details className="group">
                    <summary className="flex items-center gap-2 text-emerald-700 font-semibold cursor-pointer">
                        <History className="w-4 h-4" />
                        Prediction History
                        <span className="ml-auto text-gray-500 text-sm group-open:hidden">▼</span>
                        <span className="ml-auto text-gray-500 text-sm hidden group-open:inline">▲</span>
                    </summary>

                    {history.length > 0 ? (
                        <div className="mt-4 overflow-x-auto">
                            <table className="min-w-full border border-gray-200 rounded-md text-sm">
                                <thead className="bg-emerald-50">
                                    <tr>
                                        <th className="py-2 px-4 text-left">Date</th>
                                        <th className="py-2 px-4 text-left">Model</th>
                                        <th className="py-2 px-4 text-left">Predicted Price</th>
                                        <th className="py-2 px-4 text-left">95% Confidence Range</th>
                                        <th className="py-2 px-4 text-left">AI Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((h) => (
                                        <tr key={h.id} className="hover:bg-emerald-50">
                                            <td className="py-2 px-4 border-t">{h.created_at}</td>
                                            <td className="py-2 px-4 border-t">{h.model_type}</td>
                                            <td className="py-2 px-4 border-t">{h.predicted_price}</td>
                                            <td className="py-2 px-4 border-t">{h.confidence_range}</td>
                                            <td className="py-2 px-4 border-t">{h.ai_confidence}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-gray-500 italic mt-4">
                            No prediction history yet. Try generating a forecast first.
                        </p>
                    )}
                </details>
            </div>


            {/* --- Contact Modal (Homeowner only) --- */}
            {userRole === "homeowner" && showModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3 className="modal-title flex items-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-700" /> Contact Agent
                        </h3>

                        {/* 🚨 Optional chaining added here */}
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
        </div>
    );
}
