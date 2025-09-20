import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import axios from "axios";
import "./css/PropertiesPage.css";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";


const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

export default function PropertiesPage() {
    const navigate = useNavigate();
    const agentId = 2;
    const [properties, setProperties] = useState([]);
    const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });

    useEffect(() => {
        api.get("/properties", { params: { agent_id: agentId } })
            .then((res) => {
                setProperties(res.data);

                // derive stats
                const total = res.data.length;
                const active = res.data.filter((p) => p.status === "Active").length;
                const pending = res.data.filter((p) => p.status === "Pending").length;
                setStats({ total, active, pending });
            })
            .catch(() => console.error("Failed to fetch properties"));
    }, []);

    function handleDelete(id) {
        Swal.fire({
            title: "Are you sure?",
            text: "This will permanently delete the property.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#00674f", // emerald green
            cancelButtonColor: "#d33",
            confirmButtonText: "Yes, delete it!"
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.delete(`/properties/${id}`);

                    //Update UI instantly: remove from state
                    setProperties((prev) => prev.filter((p) => p.id !== id));

                    Swal.fire("Deleted!", "Property deleted successfully.", "success");
                } catch (err) {
                    console.error(err.response?.data || err.message);
                    Swal.fire("Error", "Failed to delete property.", "error");
                }
            }
        });
    }

    return (
        <div className="properties-page">
            {/* Page header with button */}
            <div className="page-header">
                <h1 className="page-title">Agent Dashboard</h1>
                <Link to="/addproperties" className="btn btn-primary">
                    + New Listing
                </Link>
            </div>
            <p className="muted-text">Welcome back, Alex! This is a overview of your listings and performance.</p>

            {/* Stats cards */}
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

            {/* Listing management */}
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
                                <td>{p.location}, {p.size} sqft</td>
                                <td>
                                    <span
                                        className={`badge ${p.status === "Active" ? "badge-success" :
                                                p.status === "Pending" ? "badge-warning" : "badge-muted"
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
                                <td colSpan="3" className="empty">No properties found</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Smart Insights */}
            <div className="card mt-24">
                <div className="card-body">
                    <h3>Smart Insights</h3>
                    <p>
                        Leverage AI-powered recommendations to optimize your listings and reach the right buyers.
                        Explore insights on pricing, market trends, and property features that resonate with potential clients.
                    </p>
                    <button className="btn btn-primary mt-16">Explore Insights</button>
                </div>
            </div>
        </div>
    );
}
