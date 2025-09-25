import { useEffect, useState } from "react";
import api from "../api";
import Swal from "sweetalert2";
import "../components/css/AdminDashboard.css";

export default function AdminDashboard() {
    const [pending, setPending] = useState([]);

    useEffect(() => {
        async function loadPending() {
            try {
                const res = await api.get("/properties?status=Pending");
                const data = res.data.map((p) => {
                    let photos = [];
                    try {
                        photos = typeof p.photos === "string" ? JSON.parse(p.photos) : p.photos;
                    } catch {
                        photos = [];
                    }
                    return { ...p, photos };
                });
                setPending(data);
            } catch (err) {
                console.error("Failed to load properties", err);
            }
        }
        loadPending();
    }, []);

    const approve = async (id) => {
        try {
            await api.patch(`/properties/${id}/approve`);
            setPending((prev) => prev.filter((p) => p.id !== id));
            Swal.fire({
                icon: "success",
                title: "Approved!",
                text: "Property has been approved successfully.",
                confirmButtonColor: "#047857",
            });
        } catch (err) {
            Swal.fire("Error", "Failed to approve property.", "error");
        }
    };

    const remove = async (id) => {
        Swal.fire({
            icon: "warning",
            title: "Are you sure?",
            text: "This will remove the property permanently.",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "Yes, remove it!",
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await api.delete(`/properties/${id}`);
                    setPending((prev) => prev.filter((p) => p.id !== id));
                    Swal.fire("Removed!", "The property has been deleted.", "success");
                } catch (err) {
                    Swal.fire("Error", "Failed to remove property.", "error");
                }
            }
        });
    };

    return (
        <div className="dashboard-container">
            <h1 className="dashboard-title">Admin Dashboard</h1>
            <h2 className="dashboard-subtitle">Pending Properties</h2>

            {pending.length === 0 ? (
                <p>No pending properties</p>
            ) : (
                <div className="dashboard-grid">
                    {pending.map((prop) => (
                        <div key={prop.id} className="dashboard-card">
                            {/* Image */}
                            <img
                                src={prop.photos?.[0] || "https://via.placeholder.com/160x120"}
                                alt={prop.title}
                                className="dashboard-img"
                            />

                            {/* Info */}
                            <div className="dashboard-info">
                                <div className="dashboard-header">
                                    <h3 className="dashboard-title-card">{prop.title}</h3>
                                    <span className="status-badge">Pending Approval</span>
                                </div>
                                <p className="dashboard-location">{prop.location}</p>

                                <div className="dashboard-details">
                                    <p><strong>Type:</strong> {prop.property_type}</p>
                                    <p><strong>Price:</strong> ${prop.price}</p>
                                    <p><strong>Bedrooms:</strong> {prop.bedrooms}</p>
                                    <p><strong>Bathrooms:</strong> {prop.bathrooms}</p>
                                    <p><strong>Size:</strong> {prop.size} sqft</p>
                                </div>

                                <div className="dashboard-actions">
                                    <button onClick={() => approve(prop.id)} className="btn-approve">
                                        Approve
                                    </button>
                                    <button onClick={() => remove(prop.id)} className="btn-remove">
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
