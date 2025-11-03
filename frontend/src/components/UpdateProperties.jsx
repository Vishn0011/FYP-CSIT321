import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Swal from "sweetalert2";
import "./css/addProperties.css";

export default function EditProperty() {
    const navigate = useNavigate();
    const { id } = useParams();

    const [form, setForm] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [aiResult, setAiResult] = useState(null);

    const steps = [
        "Basic Info",
        "Property Details",
        "Location & Map",
        "Media",
        "Review & Submit",
    ];

    const inputRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);

    const [propertyTypes, setPropertyTypes] = useState([]);
    const [furnishings, setFurnishings] = useState([]);
    const [tenures, setTenures] = useState([]);
    const [amenities, setAmenities] = useState([]);

    // === Load dropdown options ===
    useEffect(() => {
        api.get("/options/property_type").then((res) =>
            setPropertyTypes(res.data.options?.filter((o) => o.status === "active") || [])
        );
        api.get("/options/furnishing").then((res) =>
            setFurnishings(res.data.options?.filter((o) => o.status === "active") || [])
        );
        api.get("/options/tenure").then((res) =>
            setTenures(res.data.options?.filter((o) => o.status === "active") || [])
        );
        api.get("/options/amenities").then((res) =>
            setAmenities(res.data.options?.filter((o) => o.status === "active") || [])
        );
    }, []);

    // === Load existing property data ===
    // === Load existing property data ===
    useEffect(() => {
        api.get(`/properties/${id}`)
            .then((res) => {
                const data = res.data;

                const property = {
                    ...data,

                    // ✅ Handle photos (already array or Base64 strings)
                    photos: Array.isArray(data.photos)
                        ? data.photos
                        : typeof data.photos === "string"
                            ? [data.photos]
                            : [],

                    // ✅ Handle amenities (string, JSON, or array)
                    amenities: Array.isArray(data.amenities)
                        ? data.amenities
                        : typeof data.amenities === "string"
                            ? data.amenities
                                .replace(/[\[\]"]/g, "")
                                .split(",")
                                .map((a) => a.trim())
                                .filter(Boolean)
                            : [],
                };

                setForm(property);
            })
            .catch((err) => {
                console.error(err);
                Swal.fire("Error", "Failed to load property.", "error");
            });
    }, [id]);


    // === Google Maps setup ===
    useEffect(() => {
        if (currentStep !== 2 || !form) return;
        if (!window.google) return;

        const mapEl = document.getElementById("map");
        if (!mapEl) return;

        mapRef.current = new window.google.maps.Map(mapEl, {
            center: { lat: form.latitude || 1.3521, lng: form.longitude || 103.8198 },
            zoom: 16,
        });

        markerRef.current = new window.google.maps.Marker({
            position: { lat: form.latitude || 1.3521, lng: form.longitude || 103.8198 },
            map: mapRef.current,
        });

        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "sg" },
            fields: ["formatted_address", "geometry"],
        });

        const onPlaceChanged = () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry) return;
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
        };

        autocomplete.addListener("place_changed", onPlaceChanged);
        return () => window.google.maps.event.clearInstanceListeners(autocomplete);
    }, [currentStep, form]);

    // === Convert uploaded images to base64 ===
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);

        // Convert each file to Base64 (data URL)
        const convertToBase64 = (file) =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });

        const base64Photos = await Promise.all(files.map(convertToBase64));

        setForm((prev) => {
            // ✅ Ensure `photos` is always an array before appending
            const existingPhotos = Array.isArray(prev.photos)
                ? prev.photos
                : prev.photos
                    ? [prev.photos]
                    : [];
            return {
                ...prev,
                photos: [...existingPhotos, ...base64Photos],
            };
        });
    };

    const removePhoto = (idx) =>
        setForm((prev) => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== idx),
        }));

    // === Formatter ===
    const fmt = (num) =>
        typeof num === "number" && !isNaN(num)
            ? num.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "N/A";

    // === Save updated property + trigger AI prediction ===
    async function handleSubmit(e) {
        e.preventDefault();

        const result = await Swal.fire({
            title: "Confirm Save?",
            text: "Do you want to update this property and re-run AI prediction?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10B981",
            cancelButtonColor: "#6B7280",
            confirmButtonText: "Yes, save and analyze",
        });

        if (!result.isConfirmed) return;

        try {
            // --- Step 1️⃣: Update property in database ---
            const payload = {
                ...form,
                photos: JSON.stringify(form.photos),
            };

            const res = await api.patch(`/properties/edit/${id}`, payload);
            const updatedProperty = res.data.property; // ✅ FIX: use .property

            // --- Step 2️⃣: Trigger AI Prediction ---
            const cleanProperty = { ...updatedProperty };

            // ✅ Ensure numeric fields are valid numbers
            const numericKeys = [
                "price", "size", "bedrooms", "bathrooms",
                "remaining_lease", "amenity_score", "health_score",
                "green_score", "business_access_score",
            ];
            numericKeys.forEach((key) => {
                const val = parseFloat(cleanProperty[key]);
                cleanProperty[key] = isNaN(val) ? 0 : val;
            });

            const predictRes = await api.post("/predict/future", {
                ...cleanProperty,
                property_id: cleanProperty.id,
                user_id: cleanProperty.agent_id,
            });

            const data = predictRes.data;
            setAiResult(data);

            await Swal.fire({
                title: "🤖 AI Market Analysis",
                html: `
            <div style="text-align:left; font-size:14px;">
                <p><strong>Predicted Future Price:</strong> $${fmt(data.predicted_total_price)}</p>
                <p><strong>Price per sqm:</strong> $${fmt(data.predicted_price_per_sqm)}</p>
                <p><strong>95% Confidence Range:</strong> $${fmt(data.confidence_low)} – $${fmt(data.confidence_high)}</p>
                <p><strong>AI Confidence Level:</strong> ${data.confidence_score}%</p>
                <p><strong>Market Trend:</strong> ${data.market_trend || "Market steady with potential growth."}</p>
            </div>`,
                icon: "success",
                confirmButtonText: "Done",
                confirmButtonColor: "#10B981",
                width: 520,
            });

            navigate("/properties");
        } catch (err) {
            console.error(err.response?.data || err.message);
            Swal.fire("Error", "Failed to update or analyze property.", "error");
        }

    }

    // === Step Navigation ===
    function canGoNext() {
        if (currentStep === 0) return form.title && form.property_type;
        if (currentStep === 1) return form.price && form.bedrooms && form.bathrooms;
        if (currentStep === 2) return form.location;
        return true;
    }

    const nextStep = () => canGoNext() && setCurrentStep((s) => s + 1);
    const prevStep = () => currentStep > 0 && setCurrentStep((s) => s - 1);

    // === Loading State ===
    if (!form) {
        return (
            <div className="properties-page">
                <h1 className="page-title">Edit Property Listing</h1>
                <div className="card mt-6 p-6 text-center text-gray-500">
                    Loading property details...
                </div>
            </div>
        );
    }

    return (
        <div className="properties-page">
            <h1 className="page-title">Edit Property Listing</h1>

            {/* === Stepper === */}
            <div className="card" style={{ position: "sticky", top: 0, zIndex: 5 }}>
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        {steps.map((label, i) => (
                            <div key={label} className="flex-1 flex items-center">
                                <div
                                    className={`flex flex-col items-center ${i <= currentStep ? "text-emerald-600" : "text-gray-400"
                                        }`}
                                >
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center border ${i <= currentStep
                                            ? "bg-emerald-50 border-emerald-600"
                                            : "bg-gray-100 border-gray-300"
                                            }`}
                                    >
                                        {i + 1}
                                    </div>
                                    <span className="text-sm mt-2">{label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div
                                        className={`h-px flex-1 mx-2 ${i < currentStep ? "bg-emerald-600" : "bg-gray-300"
                                            }`}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* === Form === */}
            <form className="card mt-6" onSubmit={handleSubmit}>
                <div className="card-body">
                    {/* === STEP 1 === */}
                    {currentStep === 0 && (
                        <div className="form-grid">
                            <div className="full">
                                <label className="label">Property Title</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.title || ""}
                                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Property Type</label>
                                <select
                                    className="select"
                                    value={form.property_type || ""}
                                    onChange={(e) => setForm({ ...form, property_type: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {propertyTypes.map((pt) => (
                                        <option key={pt.id} value={pt.name}>
                                            {pt.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="full">
                                <label className="label">Description</label>
                                <textarea
                                    className="input"
                                    rows="3"
                                    value={form.description || ""}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* === STEP 2 === */}
                    {currentStep === 1 && (
                        <div className="form-grid">
                            {[
                                ["price", "Price (SGD)", "number"],
                                ["bedrooms", "Bedrooms", "number"],
                                ["bathrooms", "Bathrooms", "number"],
                                ["size", "Size (sqft)", "number"],
                            ].map(([field, label, type]) => (
                                <div key={field}>
                                    <label className="label">{label}</label>
                                    <input
                                        type={type}
                                        className="input"
                                        value={form[field] || ""}
                                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="label">Furnishing</label>
                                <select
                                    className="select"
                                    value={form.furnishing || ""}
                                    onChange={(e) => setForm({ ...form, furnishing: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {furnishings.map((f) => (
                                        <option key={f.id} value={f.name}>
                                            {f.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Floor Level</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.floor_level || ""}
                                    onChange={(e) => setForm({ ...form, floor_level: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Tenure</label>
                                <select
                                    className="select"
                                    value={form.tenure || ""}
                                    onChange={(e) => setForm({ ...form, tenure: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    {tenures.map((t) => (
                                        <option key={t.id} value={t.name}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label">Remaining Lease (years)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.remaining_lease || ""}
                                    onChange={(e) => setForm({ ...form, remaining_lease: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Region</label>
                                <select
                                    className="select"
                                    value={form.region || ""}
                                    onChange={(e) => setForm({ ...form, region: e.target.value })}
                                >
                                    <option value="">Select</option>
                                    <option value="Central">Central</option>
                                    <option value="East">East</option>
                                    <option value="West">West</option>
                                    <option value="North">North</option>
                                    <option value="North-East">North-East</option>
                                </select>
                            </div>

                            <div className="full">
                                <label className="label">Amenities</label>
                                <div className="flex gap-4 flex-wrap">
                                    {amenities.map((a) => (
                                        <label key={a.id} className="inline-flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={form.amenities.includes(a.name)}
                                                onChange={(e) =>
                                                    setForm((prev) => ({
                                                        ...prev,
                                                        amenities: e.target.checked
                                                            ? [...prev.amenities, a.name]
                                                            : prev.amenities.filter((x) => x !== a.name),
                                                    }))
                                                }
                                            />
                                            {a.name}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* === STEP 3 === */}
                    {currentStep === 2 && (
                        <div className="form-grid">
                            <div className="full">
                                <label className="label">Location</label>
                                <input ref={inputRef} type="text" className="input" defaultValue={form.location || ""} />
                                <p className="text-sm text-gray-500 mt-2">
                                    Lat: {Number(form.latitude) ? Number(form.latitude).toFixed(6) : "—"} |
                                    Lng: {Number(form.longitude) ? Number(form.longitude).toFixed(6) : "—"}
                                </p>
                            </div>
                            <div id="map" className="full" style={{ height: "300px", marginTop: 10 }} />
                            {[
                                ["nearest_mrt_km", "Nearest MRT (km)"],
                                ["nearest_mall_km", "Nearest Mall (km)"],
                                ["nearest_school_km", "Nearest School (km)"],
                                ["nearest_hospital_km", "Nearest Hospital (km)"],
                                ["nearest_park_km", "Nearest Park (km)"],
                                ["nearest_business_km", "Nearest Business Hub (km)"],
                                ["amenity_score", "Amenity Score (0–10)"],
                                ["health_score", "Health Score (0–10)"],
                                ["green_score", "Green Score (0–10)"],
                                ["business_access_score", "Business Access Score (0–10)"],
                            ].map(([field, label]) => (
                                <div key={field}>
                                    <label className="label">{label}</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="input"
                                        value={form[field] || ""}
                                        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* === STEP 4 === */}
                    {currentStep === 3 && (
                        <div className="form-grid">
                            <div className="full">
                                <div className="upload-btn-wrapper">
                                    <button
                                        type="button"
                                        className="upload-btn"
                                        onClick={() => document.getElementById("photoInput").click()}
                                    >
                                        + Upload Photos
                                    </button>
                                    <input
                                        id="photoInput"
                                        type="file"
                                        multiple
                                        accept="image/*"
                                        style={{ display: "none" }}
                                        onChange={handlePhotoUpload}
                                    />
                                </div>
                                <div className="photo-grid">
                                    {form.photos.map((url, idx) => (
                                        <div key={idx} className="photo-card">
                                            <img src={url} alt={`Photo ${idx + 1}`} className="photo-img" />
                                            <button
                                                type="button"
                                                className="delete-btn"
                                                onClick={() => removePhoto(idx)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="full">
                                <label className="label">Floor Plan (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.floor_plan || ""}
                                    onChange={(e) => setForm({ ...form, floor_plan: e.target.value })}
                                />
                            </div>

                            <div className="full">
                                <label className="label">Video URL (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.video_url || ""}
                                    onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* === STEP 5 === */}
                    {currentStep === 4 && (
                        <div className="review-section">
                            <h3 className="text-lg font-semibold mb-3">Review Property Summary</h3>
                            <ul className="summary-list">
                                <li><strong>Title:</strong> {form.title}</li>
                                <li><strong>Type:</strong> {form.property_type}</li>
                                <li><strong>Price:</strong> ${form.price}</li>
                                <li><strong>Bedrooms:</strong> {form.bedrooms}</li>
                                <li><strong>Bathrooms:</strong> {form.bathrooms}</li>
                                <li><strong>Size:</strong> {form.size} sqft</li>
                                <li><strong>Tenure:</strong> {form.tenure}</li>
                                <li><strong>Region:</strong> {form.region}</li>
                                <li><strong>Furnishing:</strong> {form.furnishing}</li>
                                <li><strong>Floor Level:</strong> {form.floor_level}</li>
                                <li><strong>Amenities:</strong> {form.amenities.join(", ")}</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* === Footer Buttons === */}
                <div className="card-body flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={prevStep}
                            disabled={currentStep === 0}
                        >
                            Back
                        </button>

                        {currentStep < steps.length - 1 ? (
                            <button
                                type="button"
                                className={`btn btn-primary ${!canGoNext() ? "opacity-50 cursor-not-allowed" : ""}`}
                                disabled={!canGoNext()}
                                onClick={nextStep}
                            >
                                Next
                            </button>
                        ) : (
                            <button type="submit" className="btn btn-primary">
                                Save Changes
                            </button>
                        )}
                    </div>

                    <p className="text-xs text-gray-500">
                        Click <strong>Save Changes</strong> to update your property.
                    </p>
                </div>
            </form>
        </div>
    );
}
