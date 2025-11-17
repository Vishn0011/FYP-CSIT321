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


    // === GOOGLE MAPS + AUTOCOMPLETE + GEO ANALYSIS ===
    useEffect(() => {
        if (currentStep !== 2) return;
        if (!form) return;
        if (!window.google) return;

        const mapEl = document.getElementById("map");
        if (!mapEl) return;

        // ===== INITIAL MAP LOAD WITH EXISTING COORDINATES =====
        mapRef.current = new window.google.maps.Map(mapEl, {
            center: { lat: form.latitude || 1.3521, lng: form.longitude || 103.8198 },
            zoom: 16,
        });

        markerRef.current = new window.google.maps.Marker({
            position: { lat: form.latitude || 1.3521, lng: form.longitude || 103.8198 },
            map: mapRef.current,
        });

        // === AUTOCOMPLETE FOR ADDRESS SEARCH ===
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
            componentRestrictions: { country: "sg" },
            fields: ["formatted_address", "geometry"],
        });

        const onPlaceChanged = async () => {
            const place = autocomplete.getPlace();
            if (!place?.geometry) return;

            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();

            // Update form location + coords
            setForm((prev) => ({
                ...prev,
                location: place.formatted_address,
                latitude: lat,
                longitude: lng,
            }));

            // Move map + marker
            mapRef.current.setCenter({ lat, lng });
            markerRef.current.setPosition({ lat, lng });

            // ==========================
            // RUN GEO / AMENITY ANALYSIS
            // ==========================
            try {
                const res = await api.post("/geo/analyze", {
                    latitude: lat,
                    longitude: lng,
                });

                const data = res.data;

                setForm((prev) => ({
                    ...prev,
                    ...data, // auto-fill all distances + names + scores
                }));

                Swal.fire({
                    title: "📍 Location Re-Analysed",
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
                        </div>
                    `,
                    confirmButtonColor: "#10B981",
                });
            } catch (err) {
                console.error("Geo Analysis Error:", err);
                Swal.fire({
                    icon: "error",
                    title: "⚠️ Failed to analyze new location",
                    text: err.response?.data?.error || "Please try again later.",
                });
            }
        };

        autocomplete.addListener("place_changed", onPlaceChanged);

        // Cleanup listeners
        return () => {
            if (autocomplete) {
                window.google.maps.event.clearInstanceListeners(autocomplete);
            }
        };
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
            title: "Confirm Update?",
            text: "Do you want to save this property and re-run AI price analysis?",
            icon: "question",
            showCancelButton: true,
            confirmButtonColor: "#10B981",
            cancelButtonColor: "#6B7280",
            confirmButtonText: "Yes, update & analyze",
        });

        if (!result.isConfirmed) return;

        try {
            // -----------------------------
            // 1️⃣ UPDATE PROPERTY IN DATABASE
            // -----------------------------
            const payload = {
                ...form,
                photos: JSON.stringify(form.photos),
            };

            const res = await api.patch(`/properties/edit/${id}`, payload);
            const updated = res.data.property;

            // Prepare cleaned property for prediction
            const cleanProp = { ...updated };

            // Fix numeric fields
            const numericKeys = [
                "price", "size", "bedrooms", "bathrooms", "remaining_lease",
                "amenity_score", "health_score", "green_score", "business_access_score"
            ];
            numericKeys.forEach((key) => {
                const val = parseFloat(cleanProp[key]);
                cleanProp[key] = isNaN(val) ? 0 : val;
            });

            // -----------------------------------
            // 2️⃣ RUN CURRENT MARKET PRICE (AVM)
            // -----------------------------------
            let aiCurrent = null;
            let insightText = "";
            let currentRes = null;  

            try {
                currentRes = await api.post("/predict/current", {
                    ...cleanProp,
                    property_id: cleanProp.id,
                    user_id: cleanProp.agent_id,
                });

                aiCurrent = currentRes.data.predicted_total_price;

                const actual = parseFloat(cleanProp.price || 0);
                const diff = ((actual - aiCurrent) / aiCurrent) * 100;

                if (isNaN(actual)) {
                    insightText = "⚠️ No listed price provided.";
                } else if (Math.abs(diff) <= 5) {
                    insightText = "✅ Fairly Priced — aligned with market average.";
                } else if (diff > 5) {
                    insightText = "🔴 Above Market — consider adjusting your price downward.";
                } else {
                    insightText = "🟢 Below Market — your listing may attract more buyers.";
                }
            } catch (err) {
                console.warn("Current AVM error:", err);
                insightText = "⚠️ Unable to fetch current market prediction.";
            }

            // -----------------------------
            // 3️⃣ RUN FUTURE RESALE FORECAST
            // -----------------------------
            let futureForecast = null;

            try {
                const predictRes = await api.post("/predict/future", {
                    ...cleanProp,
                    property_id: cleanProp.id,
                    user_id: cleanProp.agent_id,
                });
                futureForecast = predictRes.data;
                setAiResult(futureForecast);
            } catch (err) {
                console.warn("Future prediction error:", err);
            }

            // -----------------------------
            // 4️⃣ DISPLAY COMBINED AI INSIGHTS
            // -----------------------------
            const listedPrice = parseFloat(cleanProp.price || 0);

            let htmlContent = `
            <div style="text-align:left; font-size:14px; line-height:1.6;">
                <h4 style="color:#047857;">🏠 AI Current Price Evaluation</h4>
                <p><strong>Your Listed Price:</strong> $${fmt(listedPrice)}</p>
                <p><strong>Predicted Market Price:</strong> $${fmt(aiCurrent)}</p>
                <p><strong>Confidence Range:</strong> $${fmt(currentRes.data.confidence_low)} – $${fmt(currentRes.data.confidence_high)}</p>
                <p><strong>AI Confidence Level:</strong> ${currentRes.data.confidence_score}%</p>
                <p style="margin-top:6px;">${insightText}</p>
        `;

            if (futureForecast) {
                htmlContent += `
            <hr style="margin:10px 0;"/>
            <h4 style="color:#0f766e;">📈 Future Resale Forecast (${futureForecast.years_forward})</h4>
            <p><strong>Predicted Future Price:</strong> $${fmt(futureForecast.predicted_total_price)}</p>
            <p><strong>Price per sqm:</strong> $${fmt(futureForecast.predicted_price_per_sqm)}</p>
            <p><strong>Confidence Range:</strong> $${fmt(futureForecast.confidence_low)} – $${fmt(futureForecast.confidence_high)}</p>
            <p><strong>AI Confidence Level:</strong> ${futureForecast.confidence_score}%</p>
            <p><strong>Market Trend:</strong> ${futureForecast.market_trend}</p>
        `;
            }

            htmlContent += "</div>";

            await Swal.fire({
                title: "🤖 AI Market Insights",
                html: htmlContent,
                icon: "success",
                confirmButtonText: "Done",
                confirmButtonColor: "#16a34a",
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

            {/* === STEPPER === */}
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

            {/* === FORM CONTAINER === */}
            <form className="card mt-6" onSubmit={handleSubmit}>
                <div className="card-body">

                    {/* =======================
                        STEP 1 — BASIC INFO
                    ======================== */}
                    {currentStep === 0 && (
                        <div className="form-grid">
                            <div className="full">
                                <label className="label">Property Title</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.title || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, title: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="label">Property Type</label>
                                <select
                                    className="select"
                                    value={form.property_type || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, property_type: e.target.value })
                                    }
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
                                    onChange={(e) =>
                                        setForm({ ...form, description: e.target.value })
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* =======================
                        STEP 2 — PROPERTY DETAILS
                    ======================== */}
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
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                [field]: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            ))}

                            <div>
                                <label className="label">Furnishing</label>
                                <select
                                    className="select"
                                    value={form.furnishing || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, furnishing: e.target.value })
                                    }
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
                                    onChange={(e) =>
                                        setForm({ ...form, floor_level: e.target.value })
                                    }
                                />
                            </div>

                            <div>
                                <label className="label">Tenure</label>
                                <select
                                    className="select"
                                    value={form.tenure || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, tenure: e.target.value })
                                    }
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
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            remaining_lease: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <div>
                                <label className="label">Region</label>
                                <select
                                    className="select"
                                    value={form.region || ""}
                                    onChange={(e) =>
                                        setForm({ ...form, region: e.target.value })
                                    }
                                >
                                    <option value="">Select</option>
                                    <option value="Central">Central</option>
                                    <option value="East">East</option>
                                    <option value="West">West</option>
                                    <option value="North">North</option>
                                    <option value="North-East">North-East</option>
                                </select>
                            </div>

                            {/* Amenities — same logic as AddProperty */}
                            {form.property_type === "Condominium" && (
                                <div className="full">
                                    <label className="label">Amenities</label>
                                    <div className="flex gap-4 flex-wrap">
                                        {amenities.map((a) => (
                                            <label
                                                key={a.id}
                                                className="inline-flex items-center gap-2"
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.amenities.includes(a.name)}
                                                    onChange={(e) =>
                                                        setForm((prev) => ({
                                                            ...prev,
                                                            amenities: e.target.checked
                                                                ? [...prev.amenities, a.name]
                                                                : prev.amenities.filter(
                                                                    (x) => x !== a.name
                                                                ),
                                                        }))
                                                    }
                                                />
                                                {a.name}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ===========================
                        STEP 3 — LOCATION + GEO DATA
                    ============================ */}
                    {currentStep === 2 && (
                        <div className="form-grid">

                            {/* LOCATION INPUT */}
                            <div className="full">
                                <label className="label">Location</label>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="input"
                                    defaultValue={form.location || ""}
                                />
                                <p className="text-sm text-gray-500 mt-2">
                                    Lat: {Number(form.latitude)?.toFixed(6) || "—"} |
                                    Lng: {Number(form.longitude)?.toFixed(6) || "—"}
                                </p>
                            </div>

                            {/* GOOGLE MAP */}
                            <div
                                id="map"
                                className="full"
                                style={{ height: "300px", marginTop: 10 }}
                            />

                            {/* PROXIMITY METRICS & SCORES */}
                            {[
                                ["nearest_mrt_km", "Nearest MRT (km)", "nearest_mrt_name"],
                                ["nearest_mall_km", "Nearest Mall (km)", "nearest_mall_name"],
                                ["nearest_school_km", "Nearest School (km)", "nearest_school_name"],
                                ["nearest_hospital_km", "Nearest Polyclinic/Hospital (km)", "nearest_hospital_name"],
                                ["nearest_park_km", "Nearest Park (km)", "nearest_park_name"],
                                ["nearest_business_km", "Nearest Business Hub (km)", "nearest_business_name"],
                            ].map(([field, label, nameField]) => (
                                <div key={field}>
                                    <label className="label">{label}</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            className="input bg-gray-100 cursor-not-allowed"
                                            value={form[field] || ""}
                                            readOnly
                                        />
                                        <span className="text-sm text-gray-500">
                                            {form[nameField] || "—"}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {/* SCORES */}
                            {[
                                ["amenity_score", "Amenity Score (0–10)"],
                                ["health_score", "Health Score (0–10)"],
                                ["green_score", "Green Score (0–10)"],
                                ["business_access_score", "Business Access Score (0–10)"],
                            ].map(([field, label]) => (
                                <div key={field}>
                                    <label className="label">{label}</label>
                                    <input
                                        type="number"
                                        className="input bg-gray-100 cursor-not-allowed"
                                        value={form[field] || ""}
                                        readOnly
                                    />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* =======================
                        STEP 4 — MEDIA UPLOAD
                    ======================== */}
                    {currentStep === 3 && (
                        <div className="form-grid">

                            {/* PHOTO UPLOAD */}
                            <div className="full">
                                <div className="upload-btn-wrapper">
                                    <button
                                        type="button"
                                        className="upload-btn"
                                        onClick={() =>
                                            document.getElementById("photoInput").click()
                                        }
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
                                            <img
                                                src={url}
                                                alt={`Photo ${idx + 1}`}
                                                className="photo-img"
                                            />
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

                            {/* FLOOR PLAN */}
                            <div className="full">
                                <label className="label">Floor Plan (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.floor_plan || ""}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            floor_plan: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            {/* VIDEO URL */}
                            <div className="full">
                                <label className="label">Video URL (optional)</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={form.video_url || ""}
                                    onChange={(e) =>
                                        setForm({
                                            ...form,
                                            video_url: e.target.value,
                                        })
                                    }
                                />
                            </div>
                        </div>
                    )}

                    {/* =======================
                        STEP 5 — REVIEW SUMMARY
                    ======================== */}
                    {currentStep === 4 && (
                        <div className="review-section">
                            <h3 className="text-lg font-semibold mb-3">
                                Review Property Summary
                            </h3>
                            <ul className="summary-list">
                                <li><strong>Title:</strong> {form.title}</li>
                                <li><strong>Type:</strong> {form.property_type}</li>
                                <li><strong>Price:</strong> ${form.price}</li>
                                <li><strong>Bedrooms:</strong> {form.bedrooms}</li>
                                <li><strong>Bathrooms:</strong> {form.bathrooms}</li>
                                <li><strong>Size:</strong> {form.size} sqft</li>
                                <li><strong>Tenure:</strong> {form.tenure}</li>
                                <li><strong>Region:</strong> {form.region}</li>
                                <li><strong>Remaining Lease:</strong> {form.remaining_lease}</li>
                                <li><strong>Furnishing:</strong> {form.furnishing}</li>
                                <li><strong>Floor Level:</strong> {form.floor_level}</li>
                                <li><strong>Amenities:</strong> {form.amenities.join(", ")}</li>
                                <li><strong>Location:</strong> {form.location}</li>
                            </ul>
                        </div>
                    )}
                </div>

                {/* === FOOTER BUTTONS === */}
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
                                className={`btn btn-primary ${!canGoNext() ? "opacity-50 cursor-not-allowed" : ""
                                    }`}
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
