import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import "./css/addProperties.css";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

export default function EditProperty() {
    const navigate = useNavigate();
    const { id } = useParams(); // get property id from URL
    const [form, setForm] = useState(null);

    // Fetch property by ID
    useEffect(() => {
        api.get(`/properties/${id}`)
            .then((res) => {
                // If photos stored as JSON string, parse them
                const property = {
                    ...res.data,
                    photos: res.data.photos ? JSON.parse(res.data.photos) : [],
                };
                setForm(property);
            })
            .catch((err) => {
                console.error("Failed to load property:", err);
                alert("Could not load property data");
            });
    }, [id]);

    if (!form) {
        return <p style={{ padding: "20px" }}>Loading property...</p>;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                photos: form.photos, // send as array
            };

            await api.patch(`/properties/edit/${id}`, payload);

            alert("Property updated successfully!");
            navigate("/properties");
        } catch (err) {
            console.error(err.response?.data || err.message);
            alert("Failed to update property");
        }
    }


    return (
        <div className="properties-page">
            <h1 className="page-title">Update Listing</h1>
            <form className="card mt-24" onSubmit={handleSubmit}>
                <div className="card-body form-grid">
                    {/* Property Title */}
                    <div className="full">
                        <label className="label">Property Title</label>
                        <input
                            type="text"
                            className="input"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                        />
                    </div>

                    {/* Property Type */}
                    <div>
                        <label className="label">Property Type</label>
                        <select
                            className="select"
                            value={form.property_type}
                            onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                        >
                            <option>HDB</option>
                            <option>Bungalow</option>
                            <option>Condo</option>
                            <option>Studio Apartments</option>
                            <option>2-Room Flexi Flats</option>
                            <option>Executive Condominiums (EC)</option>
                            <option>Heritage Buildings</option>
                            <option>Office Spaces</option>
                            <option>Co-living Spaces</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div className="full">
                        <label className="label">Description</label>
                        <textarea
                            className="input"
                            rows="4"
                            value={form.description}
                            onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="label">Price (SGD)</label>
                        <input
                            type="number"
                            className="input"
                            value={form.price}
                            onChange={(e) => setForm({ ...form, price: e.target.value })}
                        />
                    </div>

                    {/* Bedrooms */}
                    <div>
                        <label className="label">Bedrooms</label>
                        <input
                            type="number"
                            className="input"
                            value={form.bedrooms}
                            onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                        />
                    </div>

                    {/* Bathrooms */}
                    <div>
                        <label className="label">Bathrooms</label>
                        <input
                            type="number"
                            className="input"
                            value={form.bathrooms}
                            onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                        />
                    </div>

                    {/* Square Feet */}
                    <div>
                        <label className="label">Squarefeet (sqft)</label>
                        <input
                            type="number"
                            className="input"
                            value={form.size}
                            onChange={(e) => setForm({ ...form, size: e.target.value })}
                        />
                    </div>

                    {/* Location */}
                    <div className="full">
                        <label className="label">Location</label>
                        <input
                            type="text"
                            className="input"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                    </div>

                    {/* Photos with preview */}
                    <div className="full">
                        <label className="label">Property Photos</label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => {
                                const files = Array.from(e.target.files);
                                files.forEach((file) => {
                                    const reader = new FileReader();
                                    reader.onloadend = () => {
                                        setForm((prev) => ({
                                            ...prev,
                                            photos: [...(prev.photos || []), reader.result],
                                        }));
                                    };
                                    reader.readAsDataURL(file);
                                });
                            }}
                        />

                        {form.photos.length > 0 && (
                            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "10px" }}>
                                {form.photos.map((photo, index) => (
                                    <div key={index} style={{ position: "relative", display: "inline-block" }}>
                                        <img
                                            src={photo}
                                            alt={`Preview ${index}`}
                                            style={{ width: "120px", height: "90px", objectFit: "cover", borderRadius: "8px" }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setForm((prev) => ({
                                                    ...prev,
                                                    photos: prev.photos.filter((_, i) => i !== index),
                                                }));
                                            }}
                                            style={{
                                                position: "absolute",
                                                top: "-6px",
                                                right: "-6px",
                                                background: "#ef4444",
                                                border: "none",
                                                borderRadius: "50%",
                                                color: "#fff",
                                                cursor: "pointer",
                                                width: "22px",
                                                height: "22px",
                                                fontSize: "14px",
                                                lineHeight: "20px",
                                                textAlign: "center",
                                            }}
                                        >
                                            X
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Status */}
                    <div>
                        <label className="label">Status</label>
                        <select
                            className="select"
                            value={form.status}
                            onChange={(e) => setForm({ ...form, status: e.target.value })}
                        >
                            <option value="Active">Active</option>
                            <option value="Pending">Pending</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Footer actions */}
                <div className="card-body flex gap-8 justify-end">
                    <button type="button" className="btn btn-outline" onClick={() => navigate("/properties")}>
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        Save Changes
                    </button>
                </div>
            </form>
        </div>
    );
}
