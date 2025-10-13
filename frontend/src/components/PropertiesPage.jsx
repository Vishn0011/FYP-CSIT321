import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import "./css/PropertiesPage.css";
import { Link, useNavigate } from "react-router-dom";
import ChatModal from "../components/ChatModel";


const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

export default function PropertiesPage() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const agentId = user?.id;

    const [properties, setProperties] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });
    const [enquiries, setEnquiries] = useState([]);
    const [showAll, setShowAll] = useState(false);
    const [statusFilter, setStatusFilter] = useState("All");
    const [activeChat, setActiveChat] = useState(null);


    // Fetch properties + enquiries
    useEffect(() => {
        api.get("/properties", { params: { agent_id: agentId } })
            .then((res) => {
                setProperties(res.data);
                const total = res.data.length;
                const active = res.data.filter((p) => p.status === "Active").length;
                const pending = res.data.filter((p) => p.status === "Pending").length;
                setStats({ total, active, pending });
            })
            .catch(() => console.error("Failed to fetch properties"));
    }, []);

    // Fetch enquiries when filter changes
    useEffect(() => {
        fetchEnquiries();
    }, [statusFilter]);

    async function fetchEnquiries() {
        try {
            const res = await api.get(`/enquiries/agent/${agentId}`, {
                params: { status: statusFilter },
            });
            if (res.data.ok) setEnquiries(res.data.enquiries);
        } catch (err) {
            console.error("Failed to fetch enquiries");
        }
    }

    // Delete property
    function handleDelete(id) {
        Swal.fire({
            title: "Are you sure?",
            text: "This will permanently delete the property.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#00674f",
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.delete(`/properties/${id}`);
                    setProperties((prev) => prev.filter((p) => p.id !== id));
                    Swal.fire("Deleted!", "Property deleted successfully.", "success");
                } catch (err) {
                    console.error(err.response?.data || err.message);
                    Swal.fire("Error", "Failed to delete property.", "error");
                }
            }
        });
    }

    // === Update enquiry status & open chat if marked "Contacted" ===
    async function handleStatusUpdate(enquiry) {
        const nextStatus = enquiry.status === "Pending" ? "Contacted" : "Closed";

        Swal.fire({
            title: `Mark as ${nextStatus}?`,
            text:
                nextStatus === "Contacted"
                    ? "This will mark the enquiry as contacted, notify the buyer by email, and open a chat window."
                    : "This will mark the enquiry as closed.",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#00674f",
            cancelButtonColor: "#d33",
            confirmButtonText: `Yes, mark ${nextStatus}`,
        }).then(async (result) => {
            if (!result.isConfirmed) return;

            try {
                const res = await api.put(`/enquiries/${enquiry.id}/status`, {
                    status: nextStatus,
                });

                if (res.data.ok) {
                    setEnquiries((prev) =>
                        prev.map((e) =>
                            e.id === enquiry.id
                                ? { ...e, status: res.data.enquiry.status }
                                : e
                        )
                    );

                    Swal.fire({
                        icon: "success",
                        title: "Status Updated",
                        text:
                            nextStatus === "Contacted"
                                ? "Enquiry Marked as Contacted. You can now start chatting with the buyer."
                                : "Enquiry marked as Closed.",
                        confirmButtonColor: "#00674f",
                    }).then(() => {
                        if (nextStatus === "Contacted") {
                            setActiveChat(enquiry); // 🟢 open chat immediately
                        }
                    });
                } else {
                    Swal.fire({
                        icon: "error",
                        title: "Update Failed",
                        text: res.data.error || "Could not update status.",
                        confirmButtonColor: "#00674f",
                    });
                }
            } catch (err) {
                console.error(err);
                Swal.fire({
                    icon: "error",
                    title: "Error",
                    text: "Something went wrong updating the enquiry status.",
                    confirmButtonColor: "#00674f",
                });
            }
        });
    }

    return (
        <div className="properties-page">
            {/* Header */}
            <div className="page-header">
                <h1 className="page-title">Agent Dashboard</h1>
                <Link to="/addproperties" className="btn btn-primary">
                    + New Listing
                </Link>
            </div>

            <p className="muted-text">
                Welcome back, {user.name}! Here’s an overview of your listings and enquiries.
            </p>

            {/* Stats */}
            <div className="stats-grid mt-24">
                <div className="card stat-card">
                    <div className="stat-value">{stats.total}</div>
                    <div className="stat-label">Total Listings</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">{stats.active}</div>
                    <div className="stat-label">Active Listings</div>
                </div>
                <div className="card stat-card">
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-label">Pending Listings</div>
                </div>
            </div>

            {/* Listings */}
            <h2 className="section-title mt-24">Listing Management</h2>
            <div className="table-wrap">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {properties.map((p) => (
                            <tr key={p.id}>
                                <td>
                                    {p.location}, {p.size} sqft
                                </td>
                                <td>
                                    <span
                                        className={`badge ${p.status === "Active"
                                            ? "badge-success"
                                            : p.status === "Pending"
                                                ? "badge-warning"
                                                : "badge-muted"
                                            }`}
                                    >
                                        {p.status}
                                    </span>
                                </td>
                                <td className="flex gap-8">
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => navigate(`/properties/${p.id}`)}
                                    >
                                        View
                                    </button>
                                    <button
                                        className="btn btn-outline"
                                        onClick={() => navigate(`/properties/edit/${p.id}`)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(p.id)}
                                        className="btn btn-danger"
                                    >
                                        Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {properties.length === 0 && (
                            <tr>
                                <td colSpan="3" className="empty">
                                    No properties found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Buyer Enquiries */}
            <div className="card mt-24">
                <div className="card-body">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Buyer Enquiries</h3>

                        {/* 🔽 Simple Filter Dropdown */}
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white shadow-sm hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                        >
                            <option value="All">All</option>
                            <option value="Pending">Pending</option>
                            <option value="Contacted">Contacted</option>
                            <option value="Closed">Closed</option>
                        </select>
                    </div>

                    {enquiries.length === 0 ? (
                        <p className="text-gray-600">No enquiries received yet.</p>
                    ) : (
                        <>
                            <div className="table-wrap">
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Buyer</th>
                                            <th>Contact</th>
                                            <th>Property</th>
                                            <th>Message</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(showAll ? enquiries : enquiries.slice(0, 5)).map((e) => (
                                            <tr key={e.id}>
                                                <td>{e.created_at}</td>
                                                <td>{e.buyer_name}</td>
                                                <td>
                                                    <div>{e.buyer_email}</div>
                                                    <div className="text-sm text-gray-500">
                                                        {e.buyer_phone}
                                                    </div>
                                                </td>
                                                <td>{e.property_title}</td>
                                                <td>{e.message}</td>
                                                <td>
                                                    <span
                                                        className={`badge ${e.status === "Pending"
                                                            ? "badge-warning"
                                                            : e.status === "Contacted"
                                                                ? "badge-success"
                                                                : "badge-muted"
                                                            }`}
                                                    >
                                                        {e.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    {e.status !== "Closed" && (
                                                        <button
                                                            className="btn btn-outline text-xs"
                                                            onClick={() => handleStatusUpdate(e)}
                                                        >
                                                            {e.status === "Pending"
                                                                ? "Mark Contacted"
                                                                : "Mark Closed"}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* View More / View Less Button */}
                            {enquiries.length > 5 && (
                                <div className="flex justify-center mt-4">
                                    <button
                                        onClick={() => setShowAll(!showAll)}
                                        className="btn btn-outline"
                                    >
                                        {showAll ? "View Less" : "View More"}
                                    </button>
                                    </div>
                               //chat modal
                                )}
                                {activeChat && (
                                    <ChatModal
                                        enquiry={activeChat}
                                        user={user}
                                        onClose={() => setActiveChat(null)}
                                    />
                                )}
                        </>
                    )}
                </div>
            </div>

            {/* Smart Insights */}
            <div className="card mt-24">
                <div className="card-body">
                    <h3>Smart Insights</h3>
                    <p>
                        Leverage AI-powered recommendations to optimize your listings and reach the right buyers.
                    </p>
                    <button className="btn btn-primary mt-16">
                        Explore Insights
                    </button>
                </div>
            </div>
        </div>
    );
}
