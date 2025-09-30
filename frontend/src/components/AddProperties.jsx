import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./css/addProperties.css";

export default function AddProperties() {
    const navigate = useNavigate();

    // get logged in user from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const agentId = user?.id;

    const [form, setForm] = useState({
        title: "",
        property_type: "House",
        description: "",
        price: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        location: "",
        latitude: 1.3521,
        longitude: 103.8198,
        photos: [],
        furnishing: "",
        floor_level: "",
        tenure: "",
        amenities: [],
        floor_plan: "",
        video_url: "",
        status: "Pending", // default
    });

    const inputRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    // Setup Google Places Autocomplete + Map
    useEffect(() => {
        if (!window.google || !inputRef.current) return;

        mapRef.current = new window.google.maps.Map(document.getElementById("map"), {
            center: { lat: form.latitude, lng: form.longitude },
            zoom: 16,
        });

        markerRef.current = new window.google.maps.Marker({
            position: { lat: form.latitude, lng: form.longitude },
            map: mapRef.current,
        });

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "sg" },
            fields: ["formatted_address", "geometry"],
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            setForm((prev) => ({
                ...prev,
                location: place.formatted_address,
                latitude: lat,
                longitude: lng,
            }));

            mapRef.current.setCenter({ lat, lng });
            markerRef.current.setPosition({ lat, lng });
        });
    }, []);

    // submit property
    async function handleSubmit(e, saveAsDraft = false) {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                agent_id: agentId, // send agent id along with form
                photos: JSON.stringify(form.photos),
                status: saveAsDraft ? "Draft" : "Pending",
            };

            await api.post("/properties", payload);
            alert(saveAsDraft ? "Draft saved!" : "Property created successfully!");
            navigate("/properties");
        } catch (err) {
            console.error(err.response?.data || err.message);
            alert(err.response?.data?.error || "Failed to create property");
        }
    }

    return (
        <div className="properties-page">
            <h1 className="page-title">Create New Listing</h1>

            <form className="card mt-24" onSubmit={(e) => handleSubmit(e, false)}>
                <div className="card-body form-grid">
                    {/* Title */}
                    <div className="full">
                        <label className="label">Property Title</label>
                        <input
                            type="text"
                            className="input"
                            value={form.title}
                            onChange={(e) => setForm({ ...form, title: e.target.value })}
                            placeholder="e.g., Spacious 3BR Condo"
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
                            <option>Condo</option>
                            <option>Bungalow</option>
                            <option>Studio Apartment</option>
                            <option>Executive Condo (EC)</option>
                        </select>
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

                    {/* Size */}
                    <div>
                        <label className="label">Size (sqft)</label>
                        <input
                            type="number"
                            className="input"
                            value={form.size}
                            onChange={(e) => setForm({ ...form, size: e.target.value })}
                        />
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

                    {/* Furnishing */}
                    <div>
                        <label className="label">Furnishing</label>
                        <select
                            className="select"
                            value={form.furnishing}
                            onChange={(e) => setForm({ ...form, furnishing: e.target.value })}
                        >
                            <option value="">Select</option>
                            <option>Unfurnished</option>
                            <option>Partially Furnished</option>
                            <option>Fully Furnished</option>
                        </select>
                    </div>

                    {/* Floor Level */}
                    <div>
                        <label className="label">Floor Level</label>
                        <input
                            type="text"
                            className="input"
                            value={form.floor_level}
                            onChange={(e) => setForm({ ...form, floor_level: e.target.value })}
                            placeholder="High / Mid / Low Floor"
                        />
                    </div>

                    {/* Tenure */}
                    <div>
                        <label className="label">Tenure</label>
                        <select
                            className="select"
                            value={form.tenure}
                            onChange={(e) => setForm({ ...form, tenure: e.target.value })}
                        >
                            <option value="">Select</option>
                            <option>Freehold</option>
                            <option>99 years</option>
                            <option>999 years</option>
                        </select>
                    </div>

                    {/* Amenities */}
                    <div className="full">
                        <label className="label">Amenities</label>
                        <div className="flex gap-4 flex-wrap">
                            {["Pool", "Gym", "Parking", "Playground"].map((a) => (
                                <label key={a}>
                                    <input
                                        type="checkbox"
                                        checked={form.amenities.includes(a)}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                amenities: e.target.checked
                                                    ? [...prev.amenities, a]
                                                    : prev.amenities.filter((x) => x !== a),
                                            }))
                                        }
                                    />
                                    {a}
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Floor Plan */}
                    <div className="full">
                        <label className="label">Floor Plan</label>
                        <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={(e) => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                    setForm({ ...form, floor_plan: reader.result });
                                };
                                reader.readAsDataURL(file);
                            }}
                        />
                    </div>

                    {/* Video URL */}
                    <div className="full">
                        <label className="label">Video URL</label>
                        <input
                            type="url"
                            className="input"
                            value={form.video_url}
                            onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                            placeholder="https://youtube.com/..."
                        />
                    </div>

                    {/* Location */}
                    <div className="full">
                        <label className="label">Location</label>
                        <input
                            ref={inputRef}
                            type="text"
                            className="input"
                            defaultValue={form.location}
                            placeholder="Search block, street, or postal code"
                        />
                    </div>

                    {/* Google Map */}
                    <div id="map" className="full" style={{ height: "300px", marginTop: "10px" }}></div>

                    {/* Photos */}
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
                            <div className="photo-preview">
                                {form.photos.map((p, i) => (
                                    <img key={i} src={p} alt="Preview" width="120" />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="card-body flex gap-8 justify-end">
                    <button
                        type="button"
                        className="btn btn-outline"
                        onClick={(e) => handleSubmit(e, true)} // Save Draft
                    >
                        Save Draft
                    </button>
                    <button type="submit" className="btn btn-primary">
                        Submit for Approval
                    </button>
                </div>
            </form>
        </div>
    );
}
