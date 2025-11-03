import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Swal from "sweetalert2";
import "./css/addProperties.css";

export default function AddProperties() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const agentId = user?.id;

    const [form, setForm] = useState({
        title: "",
        property_type: "",
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
        status: "Pending",

        // --- AI-related fields ---
        region: "",
        remaining_lease: "",
        nearest_mrt_km: "",
        nearest_mall_km: "",
        nearest_school_km: "",
        nearest_hospital_km: "",
        nearest_park_km: "",
        nearest_business_km: "",
        amenity_score: "",
        health_score: "",
        green_score: "",
        business_access_score: "",
    });

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

    // === Google Maps Setup ===
    useEffect(() => {
        if (currentStep !== 2) return;
        if (!window.google) return;

        const mapEl = document.getElementById("map");
        if (!mapEl) return;

        mapRef.current = new window.google.maps.Map(mapEl, {
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

        const onPlaceChanged = async () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry) return;

            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            // --- Update Map + Form ---
            setForm((prev) => ({
                ...prev,
                location: place.formatted_address,
                latitude: lat,
                longitude: lng,
            }));
            mapRef.current.setCenter({ lat, lng });
            markerRef.current.setPosition({ lat, lng });

            // --- Trigger Geo Analysis ---
            try {
                const res = await api.post("/geo/analyze", { latitude: lat, longitude: lng });
                const data = res.data;

                setForm((prev) => ({
                    ...prev,
                    ...data, // auto fills all distances + scores + names
                }));

                Swal.fire({
                    title: "📍 Location Analysis Completed",
                    html: `
                    <div style="text-align:left; font-size:14px;">
                        <p><b>Nearest MRT:</b> ${data.nearest_mrt_name || "—"} (${data.nearest_mrt_km ?? "—"} km)</p>
                        <p><b>Nearest Mall:</b> ${data.nearest_mall_name || "—"} (${data.nearest_mall_km ?? "—"} km)</p>
                        <p><b>Nearest School:</b> ${data.nearest_school_name || "—"} (${data.nearest_school_km ?? "—"} km)</p>
                        <p><b>Nearest Hospital:</b> ${data.nearest_hospital_name || "—"} (${data.nearest_hospital_km ?? "—"} km)</p>
                        <p><b>Nearest Park:</b> ${data.nearest_park_name || "—"} (${data.nearest_park_km ?? "—"} km)</p>
                        <p><b>Nearest Business Hub:</b> ${data.nearest_business_name || "—"} (${data.nearest_business_km ?? "—"} km)</p>
                        <hr/>
                        <p><b>Amenity Score:</b> ${data.amenity_score}/10</p>
                        <p><b>Health Score:</b> ${data.health_score}/10</p>
                        <p><b>Green Score:</b> ${data.green_score}/10</p>
                        <p><b>Business Access Score:</b> ${data.business_access_score}/10</p>
                    </div>`,
                    confirmButtonColor: "#00674f",
                });
            } catch (err) {
                console.error("Geo Analysis Error:", err);
                Swal.fire({
                    icon: "error",
                    title: "⚠️ Failed to analyze location",
                    text: err.response?.data?.error || "Please try again later.",
                });
            }
        };

        autocomplete.addListener("place_changed", onPlaceChanged);
        return () => {
            window.google.maps.event.clearInstanceListeners(autocomplete);
        };
    }, [currentStep, form.latitude, form.longitude]);


    // === Photo Upload ===
    // Convert each uploaded photo into base64 before saving
    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files);

        const convertToBase64 = (file) =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = (error) => reject(error);
            });

        const base64Photos = await Promise.all(files.map(convertToBase64));

        setForm((prev) => ({
            ...prev,
            photos: [...prev.photos, ...base64Photos],
        }));
    };

    const removePhoto = (idx) => {
        setForm((prev) => ({
            ...prev,
            photos: prev.photos.filter((_, i) => i !== idx),
        }));
    };

    // === Safe number formatter ===
    const fmt = (num) =>
        typeof num === "number" && !isNaN(num)
            ? num.toLocaleString("en-SG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : "N/A";

    // === Handle Submit ===
    async function handleSubmit(e, saveAsDraft = false) {
        e.preventDefault();
        // Assuming 'form', 'agentId', 'api', 'Swal', 'navigate', and 'fmt' are available in scope.
        try {
            // Step 1️⃣: Prepare payload for saving the property to the database
            const payload = {
                ...form,
                agent_id: agentId,
                // Note: Photos is JSON.stringified for the database save, as per original logic.
                photos: JSON.stringify(form.photos),
                status: saveAsDraft ? "Draft" : "Pending",
            };

            // 1A: Save property to the backend/database
            const res = await api.post("/properties", payload);
            const { property_id } = res.data;

            if (saveAsDraft) {
                Swal.fire({
                    icon: "info",
                    title: "Draft Saved",
                    text: "Your property draft has been saved successfully.",
                    confirmButtonColor: "#00674f",
                });
                return;
            }

            // Step 2️⃣: Trigger AI prediction (Only if not saving as draft)
            if (property_id) {
                // ✅ FIX APPLIED: Spread the original property data ({...form}) into the prediction payload.
                // This ensures 'price', 'size', 'tenure', etc. are sent to the Flask API.
                const predictRes = await api.post("/predict/future", {
                    ...form,
                    property_id,
                    user_id: agentId,
                });

                const data = predictRes.data;
                setAiResult(data);

                Swal.fire({
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
                    confirmButtonColor: "#00674f",
                    width: 520,
                }).then(() => navigate("/properties"));
            } else {
                navigate("/properties");
            }
        } catch (err) {
            console.error(err.response?.data || err.message);
            Swal.fire({
                icon: "error",
                title: "Error",
                text: err.response?.data?.error || "Failed to create property. Please try again.",
                confirmButtonColor: "#d33",
            });
        }
    }

    // === Step Validation ===
    function canGoNext() {
        if (currentStep === 0) {
            return form.title.trim() !== "" && form.property_type.trim() !== "";
        }
        if (currentStep === 1) {
            return form.price && form.bedrooms && form.bathrooms && form.size;
        }
        if (currentStep === 2) {
            return form.location.trim() !== "";
        }
        return true;
    }

    function nextStep() {
        if (currentStep < steps.length - 1 && canGoNext()) {
            setCurrentStep((s) => s + 1);
        }
    }

    function prevStep() {
        if (currentStep > 0) setCurrentStep((s) => s - 1);
    }

    return (
        <div className="properties-page">
            <h1 className="page-title">Create New Listing</h1>

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

            {/* === Main Form === */}
            <form className="card mt-6" onSubmit={(e) => handleSubmit(e, false)}>
                <div className="card-body">

                    {/* STEP 1: BASIC INFO */}
                    {currentStep === 0 && (
                        <div className="form-grid">
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

                            <div>
                                <label className="label">Property Type</label>
                                <select
                                    className="select"
                                    value={form.property_type}
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
                                    rows="4"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Describe this property..."
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PROPERTY DETAILS */}
                    {currentStep === 1 && (
                        <div className="form-grid">
                            <div>
                                <label className="label">Price (SGD)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.price}
                                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Bedrooms</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.bedrooms}
                                    onChange={(e) => setForm({ ...form, bedrooms: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Bathrooms</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.bathrooms}
                                    onChange={(e) => setForm({ ...form, bathrooms: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="label">Size (sqft)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.size}
                                    onChange={(e) => setForm({ ...form, size: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Furnishing</label>
                                <select
                                    className="select"
                                    value={form.furnishing}
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
                                    value={form.floor_level}
                                    onChange={(e) => setForm({ ...form, floor_level: e.target.value })}
                                    placeholder="High / Mid / Low Floor"
                                />
                            </div>

                            <div>
                                <label className="label">Tenure</label>
                                <select
                                    className="select"
                                    value={form.tenure}
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

                            {/* --- AI fields --- */}
                            <div>
                                <label className="label">Remaining Lease (years)</label>
                                <input
                                    type="number"
                                    className="input"
                                    value={form.remaining_lease}
                                    onChange={(e) => setForm({ ...form, remaining_lease: e.target.value })}
                                    placeholder="e.g., 75"
                                />
                            </div>

                            <div>
                                <label className="label">Region</label>
                                <select
                                    className="select"
                                    value={form.region}
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
                    {/* STEP 3: LOCATION & SCORES */}
                    {currentStep === 2 && (
                        <div className="form-grid">
                            {/* --- Location Input --- */}
                            <div className="full">
                                <label className="label">Location</label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="input"
                                    defaultValue={form.location}
                                    placeholder="Search block, street, or postal code"
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    Lat: {form.latitude.toFixed(6)} | Lng: {form.longitude.toFixed(6)}
                                </p>
                            </div>

                            {/* --- Google Map --- */}
                            <div id="map" className="full" style={{ height: "300px", marginTop: "10px" }} />

                            {/* --- Proximity & Scores --- */}
                            <div>
                                <label className="label">Nearest MRT</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_mrt_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_mrt_name || "—"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Nearest Mall</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_mall_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_mall_name || "—"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Nearest School</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_school_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_school_name || "—"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Nearest Polyclinic</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_hospital_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_hospital_name || "—"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Nearest Park</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_park_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_park_name || "—"}
                                    </span>
                                </div>
                            </div>

                            <div>
                                <label className="label">Nearest Business Hub</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form.nearest_business_km}
                                        readOnly
                                    />
                                    <span className="text-sm text-gray-500">
                                        {form.nearest_business_name || "—"}
                                    </span>
                                </div>
                            </div>

                            {/* --- AI Scores --- */}
                            <div>
                                <label className="label">Amenity Score (0–10)</label>
                                <input
                                    type="number"
                                    className="input bg-gray-100 cursor-not-allowed"
                                    step="0.1"
                                    value={form.amenity_score}
                                    readOnly
                                />
                            </div>

                            <div>
                                <label className="label">Health Score (0–10)</label>
                                <input
                                    type="number"
                                    className="input bg-gray-100 cursor-not-allowed"
                                    step="0.1"
                                    value={form.health_score}
                                    readOnly
                                />
                            </div>

                            <div>
                                <label className="label">Green Score (0–10)</label>
                                <input
                                    type="number"
                                    className="input bg-gray-100 cursor-not-allowed"
                                    step="0.1"
                                    value={form.green_score}
                                    readOnly
                                />
                            </div>

                            <div>
                                <label className="label">Business Access Score (0–10)</label>
                                <input
                                    type="number"
                                    className="input bg-gray-100 cursor-not-allowed"
                                    step="0.1"
                                    value={form.business_access_score}
                                    readOnly
                                />
                            </div>
                        </div>
                    )}



                    {/* STEP 4: MEDIA */}
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
                                    placeholder="Floor plan URL"
                                    value={form.floor_plan}
                                    onChange={(e) => setForm({ ...form, floor_plan: e.target.value })}
                                />
                            </div>

                            <div className="full">
                                <label className="label">Video URL (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="https://youtube.com/..."
                                    value={form.video_url}
                                    onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 5: REVIEW */}
                    {currentStep === 4 && (
                        <div className="review-section">
                            <h3 className="text-lg font-semibold mb-3">Review Property Summary</h3>
                            <ul className="summary-list">
                                <li><strong>Title:</strong> {form.title}</li>
                                <li><strong>Type:</strong> {form.property_type}</li>
                                <li><strong>Price:</strong> ${form.price}</li>
                                <li><strong>Bedrooms:</strong> {form.bedrooms} | <strong>Bathrooms:</strong> {form.bathrooms}</li>
                                <li><strong>Size:</strong> {form.size} sqft</li>
                                <li><strong>Region:</strong> {form.region}</li>
                                <li><strong>Tenure:</strong> {form.tenure}</li>
                                <li><strong>Remaining Lease:</strong> {form.remaining_lease}</li>
                                <li><strong>Furnishing:</strong> {form.furnishing}</li>
                                <li><strong>Floor Level:</strong> {form.floor_level}</li>
                                <li><strong>Nearest MRT:</strong> {form.nearest_mrt_km} km</li>
                                <li><strong>Nearest Mall:</strong> {form.nearest_mall_km} km</li>
                                <li><strong>Nearest School:</strong> {form.nearest_school_km} km</li>
                                <li><strong>Nearest Polyclinic:</strong> {form.nearest_hospital_km} km</li>
                                <li><strong>Nearest Park:</strong> {form.nearest_park_km} km</li>
                                <li><strong>Nearest Business Hub:</strong> {form.nearest_business_km} km</li>
                                <li><strong>Amenity Score:</strong> {form.amenity_score}</li>
                                <li><strong>Health Score:</strong> {form.health_score}</li>
                                <li><strong>Green Score:</strong> {form.green_score}</li>
                                <li><strong>Business Access Score:</strong> {form.business_access_score}</li>
                                <li><strong>Location:</strong> {form.location}</li>
                                <li><strong>Amenities:</strong> {form.amenities.join(", ")}</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* === Wizard Footer === */}
                <div className="card-body flex flex-col md:flex-row md:items-center gap-4 md:gap-8 justify-between">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            className="btn btn-outline"
                            disabled={currentStep === 0}
                            onClick={prevStep}
                        >
                            Back
                        </button>
                        {currentStep < steps.length - 1 ? (
                            <button
                                type="button"
                                className={`btn btn-primary ${!canGoNext() ? "opacity-60 cursor-not-allowed" : ""}`}
                                onClick={nextStep}
                                disabled={!canGoNext()}
                            >
                                Next
                            </button>
                        ) : (
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    className="btn btn-outline"
                                    onClick={(e) => handleSubmit(e, true)}
                                >
                                    Save Draft
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Submit for Approval
                                </button>
                            </div>
                        )}
                    </div>
                    <p className="text-xs text-gray-500">
                        Your data is saved only when you click{" "}
                        <strong>Save Draft</strong> or{" "}
                        <strong>Submit for Approval</strong>.
                    </p>
                </div>
            </form>
        </div>
    );
}

