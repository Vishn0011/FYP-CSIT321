import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api";

export default function PublicPropertyPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [property, setProperty] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isLoggedIn, setIsLoggedIn] = useState(false);

    useEffect(() => {
        // Check if user is logged in (from localStorage)
        const storedUser = localStorage.getItem("user");
        if (storedUser) {
            setIsLoggedIn(true);
        } else {
            setIsLoggedIn(false);
            navigate("/login"); // redirect if not logged in
            return;
        }

        // Only fetch property if logged in
        api.get(`/properties/${id}`)
            .then((res) => setProperty(res.data))
            .catch(() => setProperty(null))
            .finally(() => setLoading(false));
    }, [id, navigate]);

    if (!isLoggedIn) {
        return (
            <div className="p-6 text-center">
                Please <Link to="/login" className="text-blue-600">login</Link> to view this property.
            </div>
        );
    }

    if (loading) return <div className="p-6 text-center">Loading property...</div>;
    if (!property) return <div className="p-6 text-center">Property not found</div>;

    return (
        <div className="max-w-5xl mx-auto p-6">
            {/* Property Image */}
            {property.photos && property.photos.length > 0 && (
                <img
                    src={JSON.parse(property.photos)[0]}
                    alt={property.title}
                    className="w-full h-80 object-cover rounded-lg shadow"
                />
            )}

            {/* Title & Price */}
            <div className="mt-6 flex justify-between items-center">
                <h1 className="text-3xl font-bold">{property.title}</h1>
                <span className="text-2xl font-semibold text-emerald-700">
                    SGD {property.price}
                </span>
            </div>

            <p className="text-gray-600 mt-2">{property.location}</p>

            {/* Details */}
            <div className="grid grid-cols-2 gap-6 mt-6">
                <p><strong>Type:</strong> {property.property_type}</p>
                <p><strong>Bedrooms:</strong> {property.bedrooms}</p>
                <p><strong>Bathrooms:</strong> {property.bathrooms}</p>
                <p><strong>Size:</strong> {property.size} sqft</p>
            </div>

            <p className="mt-6 text-gray-700">{property.description}</p>

            {/* Locked AI Insights Section */}
            <div className="mt-10 bg-gray-50 border rounded-lg p-6 text-center">
                <h2 className="text-xl font-semibold mb-2">AI Insights Available</h2>
                <p className="text-gray-600 mb-4">
                    Get advanced AI price predictions, market analysis, and investment insights.
                </p>
                <Link
                    to="/signup"
                    className="inline-block bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-6 py-2 rounded-lg font-semibold"
                >
                    Sign Up for AI Features
                </Link>
            </div>
        </div>
    );
}
