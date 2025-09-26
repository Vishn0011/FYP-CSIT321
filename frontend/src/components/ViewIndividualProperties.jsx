import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import "./css/ViewIndividualProperties.css";

const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
});

export default function PropertyDetails() {
    const { id } = useParams();
    const [property, setProperty] = useState(null);

    useEffect(() => {
        api.get(`/properties/${id}`)
            .then((res) => setProperty(res.data))
            .catch(() => console.error("Failed to fetch property details"));
    }, [id]);

    if (!property) {
        return <p style={{ padding: "20px" }}>Loading property details...</p>;
    }
    const photos = property.photos ? JSON.parse(property.photos) : [];

    return (
        <div className="property-details-page">
            {/* Breadcrumb */}
            <div className="breadcrumb">
                <span>My Listings</span> &gt; <strong>{property.title}</strong>
            </div>

            <div className="property-details-grid">
                {/* Photo gallery */}
                <div className="photo-gallery">
                    {photos.map((src, i) => (
                        <img key={i} src={src} alt={`Photo ${i}`} />
                    ))}
                </div>

                {/* Right: Property info */}
                <div className="property-info card">
                    <div className="card-body">
                        <h2 className="price">
                            SGD {Number(property.price).toLocaleString()}
                        </h2>
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

                        <div className="actions">
                            <button className="btn btn-primary">Contact Agent</button>
                            <button className="btn btn-outline">Schedule a Tour</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Description */}
            <div className="card mt-24">
                <div className="card-body">
                    <h3>Description</h3>
                    <p>{property.description}</p>
                </div>
            </div>

            {/* --- Hardcoded AI Insights Section --- */}
            <div className="card mt-24">
                <div className="card-body">
                    <h3>Price History & AI Insights</h3>

                    {/* Mock chart placeholder */}
                    <div className="bg-gray-100 rounded-lg p-6 my-4 text-center text-gray-500">
                        📈 [Price History Chart Placeholder]
                    </div>

                    {/* AI Price Prediction */}
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 mb-6">
                        <h4 className="text-purple-700 font-semibold mb-2">
                            🧠 AI Price Prediction
                        </h4>
                        <p className="text-gray-700 mb-4">
                            Our advanced AI model analyzes 47 market factors to predict this
                            property will appreciate <strong>3–5% over the next 12 months</strong>.
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-white rounded border">
                                <p className="text-gray-600">Confidence Level</p>
                                <p className="font-semibold text-purple-700">92%</p>
                            </div>
                            <div className="p-3 bg-white rounded border">
                                <p className="text-gray-600">Market Score</p>
                                <p className="font-semibold text-purple-700">8.7 / 10</p>
                            </div>
                        </div>
                    </div>

                    {/* AI Market Analysis */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                        <h4 className="text-green-700 font-semibold mb-2">
                            AI Market Analysis
                        </h4>
                        <ul className="text-gray-700 list-disc list-inside">
                            <li>Strong demand in this neighborhood (+12% vs city avg)</li>
                            <li>Limited inventory driving competitive pricing</li>
                            <li>School district ratings improving (AI confidence: 89%)</li>
                            <li>Transportation developments planned nearby</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
}
