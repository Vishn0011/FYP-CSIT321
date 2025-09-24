import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api"; // import shared axios client
import "./css/addProperties.css";

export default function AddProperties() {
    const navigate = useNavigate();
    const [form, setForm] = useState({
        title: "",
        property_type: "House", // match DB column
        description: "",
        price: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        location: "",
        photos: [],
        status: "Pending",
    });

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                photos: JSON.stringify(form.photos),
            };

            await api.post("/properties", payload);

            alert("Property created successfully!");
            navigate("/properties");
        } catch (err) {
            console.error(err.response?.data || err.message);
            alert("Failed to create property");
        }
    }

    return (
        <div className="properties-page">
            <h1 className="page-title">Create New Listing</h1>
            <p className="muted-text">
                Fill in the details below to add a new property to your listings.
            </p>

            <form className="card mt-24" onSubmit={handleSubmit}>
                <div className="card-body form-grid">
                    {/* Property Title */}
                    <div className="full">
                        <label className="label">Property Title</label>
                        <input
                            type="text"
                            className="input"
                            placeholder="e.g., Modern 3-Bedroom House in Willow Creek"
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
                            onChange={(e) =>
                                setForm({ ...form, property_type: e.target.value })
                            }
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
                            placeholder="Describe the property..."
                            value={form.description}
                            onChange={(e) =>
                                setForm({ ...form, description: e.target.value })
                            }
                        />
                    </div>

                    {/* Price */}
                    <div>
                        <label className="label">Price (SGD)</label>
                        <input
                            type="number"
                            className="input"
                            placeholder="500000"
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
                            placeholder="3"
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
                            placeholder="2"
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
                            placeholder="1000"
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
                            placeholder="e.g., 123 Willow Creek, Suburbia"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                    </div>

                    {/* File Upload */}
                    <div className="full">
                        <label className="label">Property Photos</label>
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="input"
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

                        {/* Preview thumbnails with remove option */}
                        {form.photos && form.photos.length > 0 && (
                            <div
                                style={{
                                    display: "flex",
                                    gap: "10px",
                                    flexWrap: "wrap",
                                    marginTop: "10px",
                                }}
                            >
                                {form.photos.map((photo, index) => (
                                    <div
                                        key={index}
                                        style={{
                                            position: "relative",
                                            display: "inline-block",
                                        }}
                                    >
                                        <img
                                            src={photo}
                                            alt={`Preview ${index}`}
                                            style={{
                                                width: "120px",
                                                height: "90px",
                                                objectFit: "cover",
                                                borderRadius: "8px",
                                            }}
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
                </div>

                {/* Footer actions */}
                <div className="card-body flex gap-8 justify-end">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => navigate("/properties")}
                    >
                        Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                        Create Listing
                    </button>
                </div>
            </form>
        </div>
    );
}
