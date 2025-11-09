import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import "./css/ViewIndividualProperties.css";
import api from "../api";
import { useAuth } from "../AuthContext";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";

const COMPARE_LIST_LIMIT = 50;

const priceHistory = [
    { month: "Jan", price: 950000 },
    { month: "Feb", price: 970000 },
    { month: "Mar", price: 960000 },
    { month: "Apr", price: 980000 },
    { month: "May", price: 995000 },
    { month: "Jun", price: 1005000 },
];

const FALLBACK = "N/A";

export default function PropertyDetails() {
    const { id } = useParams();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { user } = useAuth();
    const isHomeowner = user?.role === "homeowner";

    const [isSaved, setIsSaved] = useState(false);
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveMessage, setSaveMessage] = useState("");
    const [saveError, setSaveError] = useState("");

    const [compareOptions, setCompareOptions] = useState([]);
    const [compareId, setCompareId] = useState("");
    const [compareProperty, setCompareProperty] = useState(null);
    const [compareBusy, setCompareBusy] = useState(false);
    const [compareError, setCompareError] = useState("");

    const formatCurrency = useMemo(
        () => (value) =>
            typeof value === "number"
                ? `SGD ${value.toLocaleString("en-SG")}`
                : FALLBACK,
        []
    );

    useEffect(() => {
        let ignore = false;
        async function loadProperty() {
            setLoading(true);
            setError("");
            setSaveMessage("");
            setSaveError("");
            setCompareProperty(null);
            setCompareId("");
            try {
                const { data } = await api.get(`/properties/${id}`);
                if (ignore) return;
                setProperty(data);
            } catch (err) {
                if (ignore) return;
                setError(
                    err?.response?.data?.error ||
                        "Failed to fetch property details"
                );
            } finally {
                if (!ignore) {
                    setLoading(false);
                }
            }
        }
        loadProperty();
        return () => {
            ignore = true;
        };
    }, [id]);

    useEffect(() => {
        let ignore = false;
        async function hydrateHomeownerState() {
            if (!isHomeowner) {
                setIsSaved(false);
                setCompareOptions([]);
                return;
            }

            try {
                const [savedRes, listRes] = await Promise.allSettled([
                    api.get("/homeowner/saved"),
                    api.get("/homeowner/properties", {
                        params: { limit: COMPARE_LIST_LIMIT },
                    }),
                ]);

                if (ignore) return;

                if (savedRes.status === "fulfilled") {
                    const savedList = savedRes.value?.data?.items || [];
                    setIsSaved(savedList.some((item) => `${item.id}` === `${id}`));
                }

                if (listRes.status === "fulfilled") {
                    const items = listRes.value?.data?.items || [];
                    const filtered = items.filter(
                        (item) => `${item.id}` !== `${id}`
                    );
                    setCompareOptions(filtered);
                } else {
                    setCompareOptions([]);
                }
            } catch (_) {
                if (!ignore) {
                    setCompareOptions([]);
                }
            }
        }

        hydrateHomeownerState();
        return () => {
            ignore = true;
        };
    }, [id, isHomeowner]);

    async function toggleSave() {
        if (!isHomeowner) {
            return;
        }
        setSaveBusy(true);
        setSaveError("");
        setSaveMessage("");
        try {
            if (isSaved) {
                await api.delete(`/homeowner/saved/${id}`);
                setIsSaved(false);
                setSaveMessage("Removed from your saved properties.");
                window.dispatchEvent(new Event("saved-properties:refresh"));
            } else {
                await api.post(`/homeowner/saved/${id}`);
                setIsSaved(true);
                setSaveMessage("Saved! Find this listing in your dashboard.");
                window.dispatchEvent(new Event("saved-properties:refresh"));
            }
        } catch (err) {
            setSaveError(
                err?.response?.data?.error ||
                    "Unable to update saved properties"
            );
        } finally {
            setSaveBusy(false);
        }
    }

    async function loadCompareProperty(targetId) {
        if (!targetId) {
            setCompareProperty(null);
            return;
        }
        setCompareBusy(true);
        setCompareError("");
        try {
            const { data } = await api.get(`/properties/${targetId}`);
            setCompareProperty(data);
        } catch (err) {
            setCompareError(
                err?.response?.data?.error ||
                    "Failed to load property to compare"
            );
            setCompareProperty(null);
        } finally {
            setCompareBusy(false);
        }
    }

    function handleCompareChange(event) {
        const target = event.target.value;
        setCompareId(target);
        if (target) {
            loadCompareProperty(target);
        } else {
            setCompareProperty(null);
        }
    }

    if (loading) {
        return <p style={{ padding: "20px" }}>Loading property details...</p>;
    }

    if (error) {
        return <p style={{ padding: "20px", color: "#dc2626" }}>{error}</p>;
    }

    if (!property) {
        return <p style={{ padding: "20px" }}>Property not found.</p>;
    }

    const photos = property.photos ? JSON.parse(property.photos) : [];

    const comparisonRows = compareProperty
        ? [
              {
                  label: "Price",
                  current: formatCurrency(property.price),
                  other: formatCurrency(compareProperty.price),
              },
              {
                  label: "Bedrooms",
                  current: property.bedrooms ?? FALLBACK,
                  other: compareProperty.bedrooms ?? FALLBACK,
              },
              {
                  label: "Bathrooms",
                  current: property.bathrooms ?? FALLBACK,
                  other: compareProperty.bathrooms ?? FALLBACK,
              },
              {
                  label: "Size",
                  current: property.size ? `${property.size} sqft` : FALLBACK,
                  other: compareProperty.size
                      ? `${compareProperty.size} sqft`
                      : FALLBACK,
              },
              {
                  label: "Property Type",
                  current: property.property_type || FALLBACK,
                  other: compareProperty.property_type || FALLBACK,
              },
              {
                  label: "Tenure",
                  current: property.tenure || FALLBACK,
                  other: compareProperty.tenure || FALLBACK,
              },
              {
                  label: "Location",
                  current: property.location || FALLBACK,
                  other: compareProperty.location || FALLBACK,
              },
          ]
        : [];

    return (
        <div className="property-details-page">
            <div className="breadcrumb">
                <span>My Listings</span> &gt; <strong>{property.title}</strong>
            </div>

            <div className="property-details-grid">
                <div className="photo-gallery">
                    {photos.length === 0 ? (
                        <div className="photo-placeholder">No photos uploaded.</div>
                    ) : (
                        photos.map((src, index) => (
                            <img key={index} src={src} alt={`Photo ${index + 1}`} />
                        ))
                    )}
                </div>

                <div className="property-info card">
                    <div className="card-body">
                        <h2 className="price">{formatCurrency(property.price)}</h2>
                        <p className="location">{property.location}</p>
                        <p className="short-desc">
                            {property.description?.substring(0, 100)}...
                        </p>

                        <h3 className="details-title">Property Details</h3>
                        <ul className="details-list">
                            <li>
                                <strong>Bedrooms:</strong> {property.bedrooms}
                            </li>
                            <li>
                                <strong>Bathrooms:</strong> {property.bathrooms}
                            </li>
                            <li>
                                <strong>Sq. Footage:</strong> {property.size} sqft
                            </li>
                            <li>
                                <strong>Status:</strong> {property.status}
                            </li>
                            <li>
                                <strong>Type:</strong> {property.property_type}
                            </li>
                        </ul>

                        {isHomeowner && (
                            <div className="homeowner-actions">
                                <button
                                    type="button"
                                    className={`btn ${isSaved ? "btn-secondary" : "btn-primary"}`}
                                    disabled={saveBusy}
                                    onClick={toggleSave}
                                >
                                    {saveBusy
                                        ? "Updating..."
                                        : isSaved
                                        ? "Saved to Dashboard"
                                        : "Save to Dashboard"}
                                </button>

                                <div className="compare-select">
                                    <label htmlFor="compare-select">
                                        Compare with another listing
                                    </label>
                                    <select
                                        id="compare-select"
                                        className="compare-dropdown"
                                        value={compareId}
                                        onChange={handleCompareChange}
                                    >
                                        <option value="">Select a property</option>
                                        {compareOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.title} - {formatCurrency(option.price)}
                                            </option>
                                        ))}
                                    </select>
                                    {compareBusy && (
                                        <p className="compare-status">Loading comparison...</p>
                                    )}
                                </div>
                            </div>
                        )}

                        {(saveMessage || saveError) && (
                            <div
                                className={`alert ${
                                    saveError ? "alert-error" : "alert-success"
                                }`}
                            >
                                {saveError || saveMessage}
                            </div>
                        )}

                        {compareError && (
                            <div className="alert alert-error">{compareError}</div>
                        )}

                        <div className="actions">
                            <button className="btn btn-primary">Contact Agent</button>
                            <button className="btn btn-outline">Schedule a Tour</button>
                        </div>
                    </div>
                </div>
            </div>

            {compareProperty && (
                <div className="card mt-24">
                    <div className="card-body">
                        <h3 className="compare-title">Comparison</h3>
                        <p className="compare-subtitle">
                            Reviewing <strong>{property.title}</strong> alongside{" "}
                            <strong>{compareProperty.title}</strong>
                        </p>

                        <div className="compare-table">
                            <div className="compare-header">
                                <div className="compare-label">Criteria</div>
                                <div className="compare-col">Current listing</div>
                                <div className="compare-col">Selected listing</div>
                            </div>
                            {comparisonRows.map((row) => (
                                <div key={row.label} className="compare-row">
                                    <div className="compare-label">{row.label}</div>
                                    <div className="compare-col">{row.current}</div>
                                    <div className="compare-col">{row.other}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="card mt-24">
                <div className="card-body">
                    <h3>Description</h3>
                    <p>{property.description}</p>
                </div>
            </div>

            <div className="card mt-24">
                <div className="card-body">
                    <h3>Price History & AI Insights</h3>

                    <div className="price-history">
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={priceHistory}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis domain={["auto", "auto"]} />
                                <Tooltip />
                                <Line
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#4F46E5"
                                    strokeWidth={3}
                                    dot={{ r: 4 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="ai-section ai-price">
                        <h4>AI Price Prediction</h4>
                        <p>
                            Our AI model analyses recent market data and forecasts this
                            listing to appreciate between 3% and 5% over the next year.
                        </p>
                        <div className="ai-grid">
                            <div className="ai-card">
                                <p className="label">Confidence level</p>
                                <p className="value">92%</p>
                            </div>
                            <div className="ai-card">
                                <p className="label">Market score</p>
                                <p className="value">8.7 / 10</p>
                            </div>
                        </div>
                    </div>

                    <div className="ai-section ai-market">
                        <h4>AI Market Analysis</h4>
                        <ul>
                            <li>High demand neighbourhood with 12% price lift vs city.</li>
                            <li>Limited inventory is driving competitive bidding.</li>
                            <li>School district ratings continue to improve.</li>
                            <li>Transport upgrades planned for the next 18 months.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}





