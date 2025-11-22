import { useEffect, useState } from "react";
import api from "../api";
import "../components/css/WelcomeVideoBackground.css"; // Your CSS file

export default function WelcomeVideo() {
    const [videos, setVideos] = useState([]);
    const [index, setIndex] = useState(0);

    // 1. Fetch the list of active filenames
    useEffect(() => {
        api.get("/homepage-videos")
            .then(res => setVideos(res.data || []))
            .catch(err => console.error("Failed to load videos", err));
    }, []);

    // 2. Rotation Logic (Kept exactly as you requested)
    useEffect(() => {
        if (videos.length <= 1) return;

        const timer = setInterval(() => {
            setIndex(prev => (prev + 1) % videos.length);
        }, 12000); // 12 Seconds

        return () => clearInterval(timer);
    }, [videos]);

    // If no videos are active, don't render anything
    if (videos.length === 0) return null;

    // --- FIX EXPLANATION ---
    // The API returns: ["welcome-agent.mp4", "welcome-homeowner.mp4"]
    // So 'current' is already the string. We don't need .file_name here.
    const currentEntry = videos[index];
    const current = typeof currentEntry === "string" ? currentEntry : currentEntry?.file_name;
    if (!current) return null;
    const src = `/media/${current}`;

    return (
        <div className="welcome-bg">
            <video
                key={src} // Forces React to re-mount the video when source changes
                className="welcome-bg-video" // Applies your blur & brightness CSS
                src={src}
                autoPlay
                muted
                loop
                playsInline // Essential for iPhones/Macs to autoplay
            />
            {/* Your overlay CSS handles the gradient */}
            <div className="welcome-bg-overlay" />
        </div>
    );
}