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
        status: "Pending", // default
    });

    const [currentStep, setCurrentStep] = useState(0);
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

    // dropdown options state
    const [propertyTypes, setPropertyTypes] = useState([]);
    const [furnishings, setFurnishings] = useState([]);
    const [tenures, setTenures] = useState([]);
    const [amenities, setAmenities] = useState([]);

    // fetch dropdowns from backend
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

    // Setup Google Places Autocomplete + Map when Location step is active
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

        if (!inputRef.current) return;
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
        return () => {
            window.google.maps.event.clearInstanceListeners(autocomplete);
        };
    }, [currentStep, form.latitude, form.longitude]);

    // Submit property
    async function handleSubmit(e, saveAsDraft = false) {
        e.preventDefault();
        try {
            const payload = {
                ...form,
                agent_id: agentId,
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

    function canGoNext() {
        if (currentStep === 0) {
            return form.title.trim() !== "" && form.property_type.trim() !== "";
        }
        if (currentStep === 1) {
            return (
                String(form.price).trim() !== "" &&
                String(form.bedrooms).trim() !== "" &&
                String(form.bathrooms).trim() !== "" &&
                String(form.size).trim() !== ""
            );
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

            {/* Stepper */}
            <div className="card" style={{ position: "sticky", top: 0, zIndex: 5 }}>
                <div className="card-body">
                    <div className="flex items-center justify-between">
                        {steps.map((label, i) => (
                            <div key={label} className="flex-1 flex items-center">
                                <div className={`flex flex-col items-center text-center ${i <= currentStep ? "text-emerald-600" : "text-gray-400"}`}>
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center border ${i <= currentStep ? "bg-emerald-50 border-emerald-600" : "bg-gray-100 border-gray-300"
                                            }`}
                                        title={label}
                                    >
                                        {i + 1}
                                    </div>
                                    <span className="text-sm mt-2">{label}</span>
                                </div>
                                {i < steps.length - 1 && (
                                    <div className={`h-px flex-1 mx-2 ${i < currentStep ? "bg-emerald-600" : "bg-gray-300"}`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <form className="card mt-6" onSubmit={(e) => handleSubmit(e, false)}>
                <div className="card-body">
                    {/* STEP 1: Basic Info */}
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
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Property Details */}
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

                    {/* STEP 3: Location & Map */}
                    {currentStep === 2 && (
                        <div className="form-grid">
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
                                    Lat: {form.latitude.toFixed(6)} &nbsp; | &nbsp; Lng: {form.longitude.toFixed(6)}
                                </p>
                            </div>

                            <div id="map" className="full" style={{ height: "300px", marginTop: "10px" }} />
                        </div>
                    )}

                    {/* STEP 4: Media */}
                    {/* (unchanged code for photos, floor plan, video url) */}

                    {/* STEP 5: Review & Submit */}
                    {/* (unchanged code for summary + preview) */}
                </div>

                {/* Wizard Footer (unchanged) */}
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
                        Your data is saved to the server only when you click <strong>Save Draft</strong> or <strong>Submit for Approval</strong>.
                    </p>
                </div>
            </form>
        </div>
    );
}
