import { useEffect, useState } from "react";
import api from "../api";

export default function ManageHomepageVideos() {
    const [videos, setVideos] = useState([]);

    // Load the list from DB
    const loadVideos = () => {
        api.get("/admin/homepage-videos")
            .then(res => setVideos(res.data))
            .catch(err => console.error(err));
    };

    useEffect(() => {
        loadVideos();
    }, []);

    // Handle the Toggle
    const toggleVideo = async (id, currentStatus) => {
        try {
            // Optimistic update (update UI immediately)
            setVideos(prev => prev.map(v =>
                v.id === id ? { ...v, is_active: !currentStatus } : v
            ));

            // Send to backend
            await api.post("/admin/homepage-videos/toggle", {
                id: id,
                is_active: !currentStatus
            });
        } catch (err) {
            console.error("Failed to toggle", err);
            loadVideos(); // Revert on error
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Homepage Video Controls</h2>
            <p className="text-sm text-gray-500 mb-6">
                Turn on the videos you want to display. If multiple are on, they will rotate.
            </p>

            <div className="space-y-4">
                {videos.map((video) => (
                    <div key={video.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                        <div>
                            <h4 className="font-semibold text-gray-800">{video.title}</h4>
                            <p className="text-xs text-gray-500">{video.file_name}</p>
                        </div>

                        <button
                            onClick={() => toggleVideo(video.id, video.is_active)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${video.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                                }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${video.is_active ? 'translate-x-6' : 'translate-x-1'
                                    }`}
                            />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}