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
                        <h2 className="price">SGD {Number(property.price).toLocaleString()}</h2>
                        <p className="location">{property.location}</p>
                        <p className="short-desc">{property.description?.substring(0, 100)}...</p>

                        <h3 className="details-title">Property Details</h3>
                        <ul className="details-list">
                            <li><strong>Bedrooms:</strong> {property.bedrooms}</li>
                            <li><strong>Bathrooms:</strong> {property.bathrooms}</li>
                            <li><strong>Sq. Footage:</strong> {property.size} sqft</li>
                            <li><strong>Status:</strong> {property.status}</li>
                            <li><strong>Type:</strong> {property.type}</li>
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
        </div>
    );
}
