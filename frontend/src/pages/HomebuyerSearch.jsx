import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquare, Heart, Search } from "lucide-react";
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
    const [enquiries, setEnquiries] = useState([]); // buyer enquiries
    const [activeChat, setActiveChat] = useState(null); // chat modal

    const user = JSON.parse(localStorage.getItem("user") || "{}");

    // === Fetch properties ===
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
            if (data?.success) {
                setItems(data.items || []);
            } else {
                setMsg(data?.error || "Search failed");
            }
        } catch (e) {
            setMsg("Network error");
        } finally {
            setLoading(false);
        }
    }

    // === Fetch buyer enquiries ===
    async function fetchEnquiries() {
        try {
            const res = await api.get(`/enquiries/buyer/${user.id}`);
            if (res.data.ok) {
                // Keep only enquiries where status = "Contacted"
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // === Get enquiry info for a property ===
    function getEnquiry(propertyId) {
        return enquiries.find(
            (e) => String(e.property_id).trim() === String(propertyId).trim()
        );
    }

    // === Open chat if contacted ===
    function handleOpenChat(propertyId) {
        const enquiry = getEnquiry(propertyId);
        if (enquiry && enquiry.status === "Contacted") {
            setActiveChat(enquiry);
        }
    }

    return (
        <div className="properties-page">
            <h2 className="page-title">Homebuyer: Dashboard</h2>

            {/* --- Search Form --- */}
            <div className="card mb-12">
                <div className="card-body">
                    <div className="form-grid">
                        <div>
                            <label className="label">Search (title/location)</label>
                            <input
                                className="input"
                                placeholder="e.g. Orchard condo"
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Location</label>
                            <input
                                className="input"
                                placeholder="Exact location"
                                value={location}
                                onChange={(e) => setLocation(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Min price</label>
                            <input
                                type="number"
                                className="input"
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Max price</label>
                            <input
                                type="number"
                                className="input"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Bedrooms</label>
                            <input
                                type="number"
                                className="input"
                                value={bedrooms}
                                onChange={(e) => setBedrooms(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="mt-16 flex justify-end">
                        <button
                            onClick={search}
                            disabled={loading}
                            className="btn btn-primary flex items-center gap-2"
                        >
                            <Search size={16} />
                            {loading ? "Searching…" : "Search"}
                        </button>
                    </div>

                    {msg && (
                        <div className="mt-16">
                            <p className="muted-text">{msg}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* --- Results Table --- */}
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Price</th>
                            <th>Bedrooms</th>
                            <th>Location</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(items || []).length > 0 ? (
                            items.map((p) => {
                                const enquiry = getEnquiry(p.id);
                                const status = enquiry ? enquiry.status : null;

                                return (
                                    <tr key={p.id}>
                                        <td>{p.id}</td>
                                        <td>
                                            <Link to={`/properties/${p.id}`}>{p.title}</Link>
                                        </td>
                                        <td>${p.price}</td>
                                        <td>{p.bedrooms}</td>
                                        <td>{p.location}</td>
                                        <td className="flex flex-col gap-2 items-start">
                                            <div className="flex gap-3 items-center">
                                                <Link
                                                    to={`/properties/${p.id}`}
                                                    className="btn btn-outline"
                                                >
                                                    View
                                                </Link>

                                                <button
                                                    onClick={() => alert("Save not implemented")}
                                                    className="btn btn-primary flex items-center gap-1"
                                                >
                                                    <Heart size={16} />
                                                    Save
                                                </button>

                                                {status === "Contacted" && (
                                                    <button
                                                        onClick={() => handleOpenChat(p.id)}
                                                        className="btn btn-outline flex items-center gap-1"
                                                    >
                                                        <MessageSquare size={16} />
                                                        Chat
                                                    </button>
                                                )}
                                            </div>

                                            {/* === Enquiry Info Display === */}
                                            {enquiry ? (
                                                <div className="text-sm text-gray-700 mt-1">
                                                    <div>
                                                        <strong>Status:</strong>{" "}
                                                        <span
                                                            className={
                                                                enquiry.status === "Contacted"
                                                                    ? "text-green-600"
                                                                    : "text-yellow-600"
                                                            }
                                                        >
                                                            {enquiry.status}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <strong>Agent:</strong>{" "}
                                                        {enquiry.agent_name} (
                                                        <span className="text-gray-500">
                                                            {enquiry.agent_email}
                                                        </span>
                                                        )
                                                    </div>
                                                    <div>
                                                        <strong>Message:</strong>{" "}
                                                        {enquiry.message || "-"}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm">
                                                    No enquiry yet
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan="6" className="empty">
                                    No properties found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
