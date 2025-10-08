import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import Swal from "sweetalert2";
import {
    MapPin,
    Mail,
    Calendar,
    TrendingUp,
    CheckCircle,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
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

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

const priceHistory = [
    { month: "Jan", price: 950000 },
    { month: "Feb", price: 970000 },
    { month: "Mar", price: 960000 },
    { month: "Apr", price: 980000 },
    { month: "May", price: 995000 },
    { month: "Jun", price: 1005000 },
];

export default function PropertyDetails() {
    const { id } = useParams();
    const [property, setProperty] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({
        buyer_name: "",
        buyer_email: "",
        buyer_phone: "",
        message: "",
    });

    // 🔒 user role check
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const userRole = user?.role || "guest";

    const galleryRef = useRef(null);

    function scrollGallery(direction) {
        if (galleryRef.current) {
            const scrollAmount = galleryRef.current.clientWidth * 0.8;
            galleryRef.current.scrollBy({
                left: direction * scrollAmount,
                behavior: "smooth",
            });
        }
    }

    useEffect(() => {
        api
            .get(`/properties/${id}`)
            .then((res) => setProperty(res.data))
            .catch(() => console.error("Failed to fetch property details"));
    }, [id]);

    if (!property) {
        return <p style={{ padding: "20px" }}>Loading property details...</p>;
    }

    const photos = property.photos ? JSON.parse(property.photos) : [];

    // Helper for responsive bar width
    const getActivityWidth = (activity) => {
        if (activity === "Highly responsive") return "100%";
        if (activity === "Active this week") return "70%";
        if (activity === "Occasionally active") return "40%";
        return "20%";
    };

    return (
        <div className="property-details-page fade-in">
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <span>Properties</span> &gt;{" "}
                <strong>{property.title}</strong>
            </div>

            <div className="property-details-grid">
                {/* --- Photo Gallery with Arrows --- */}
                <div className="photo-gallery-wrapper">
                    <div className="photo-gallery" ref={galleryRef}>
                        {photos.map((src, i) => (
                            <img key={i} src={src} alt={`Photo ${i + 1}`} />
                        ))}
                    </div>

                    {photos.length > 1 && (
                        <>
                            <button
                                className="gallery-nav left"
                                onClick={() => scrollGallery(-1)}
                            >
                                <ChevronLeft className="w-5 h-5 text-emerald-700" />
                            </button>
                            <button
                                className="gallery-nav right"
                                onClick={() => scrollGallery(1)}
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
                            {property.location}
                        </p>
                        <p className="short-desc">
                            {property.description?.substring(0, 100)}...
                        </p>

                        {/* --- Agent Info Section --- */}
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
                                            {new Date(
                                                property.agent.last_active
                                            ).toLocaleString("en-SG", {
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
                            <li><strong>Bedrooms:</strong> {property.bedrooms}</li>
                            <li><strong>Bathrooms:</strong> {property.bathrooms}</li>
                            <li><strong>Sq. Footage:</strong> {property.size} sqft</li>
                            <li><strong>Status:</strong> {property.status}</li>
                            <li><strong>Type:</strong> {property.property_type}</li>
                        </ul>

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

                        {userRole === "agent" && (
                            <p className="text-sm text-gray-500 mt-4 italic">
                                (You’re viewing this as an agent — enquiries are hidden.)
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* --- AI Insights Section --- */}
            <div className="card mt-24">
                <div className="card-body">
                    <h3 className="mb-3 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-700" />
                        Price History & AI Insights
                    </h3>

                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={priceHistory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip />
                            <Line
                                type="monotone"
                                dataKey="price"
                                stroke="#16a34a"
                                strokeWidth={3}
                                dot={{ r: 4 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mt-6">
                        <h4 className="text-green-700 font-semibold mb-2 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4" /> AI Market Analysis
                        </h4>
                        <ul className="text-gray-700 list-disc list-inside">
                            <li>Strong demand in this neighborhood (+12% vs city avg)</li>
                            <li>Limited inventory driving competitive pricing</li>
                            <li>School district ratings improving (AI confidence: 89%)</li>
                            <li>Transportation developments planned nearby</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* --- Contact Modal (Homeowner only) --- */}
            {userRole === "homeowner" && showModal && (
                <div className="modal-backdrop">
                    <div className="modal-box">
                        <h3 className="modal-title flex items-center gap-2">
                            <Mail className="w-5 h-5 text-emerald-700" /> Contact Agent
                        </h3>

                        {/* --- Agent Info in Modal --- */}
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
                                            {new Date(
                                                property.agent.last_active
                                            ).toLocaleString("en-SG", {
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
                            onChange={(e) =>
                                setForm({ ...form, buyer_name: e.target.value })
                            }
                            placeholder="Enter your name"
                        />

                        <label>Email</label>
                        <input
                            type="email"
                            value={form.buyer_email}
                            onChange={(e) =>
                                setForm({ ...form, buyer_email: e.target.value })
                            }
                            placeholder="Enter your email"
                        />

                        <label>Phone (optional)</label>
                        <input
                            type="tel"
                            value={form.buyer_phone}
                            onChange={(e) =>
                                setForm({ ...form, buyer_phone: e.target.value })
                            }
                            placeholder="Enter your phone"
                        />

                        <label>Message</label>
                        <textarea
                            rows="3"
                            value={form.message}
                            onChange={(e) =>
                                setForm({ ...form, message: e.target.value })
                            }
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
                                                text:
                                                    res.data.error ||
                                                    "Failed to send enquiry. Please try again.",
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
