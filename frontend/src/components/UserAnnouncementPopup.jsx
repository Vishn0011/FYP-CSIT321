import { useEffect, useState } from "react";
import api from "../api";

export default function UserAnnouncementPopup() {
    const [announcement, setAnnouncement] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            try {
                const res = await api.get("/my/announcements");
                const list = Array.isArray(res.data) ? res.data : [];
                const first = list[0] || null;

                if (!cancelled) {
                    setAnnouncement(first);
                    setLoading(false);
                }

                if (first) {
                    // mark as read when shown
                    try {
                        await api.post(`/my/announcements/${first.id}/read`);
                    } catch (err) {
                        console.error("Failed to mark announcement read", err);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setLoading(false);
                }
                console.error("Failed to load my announcements", err);
            }
        }

        load();
        return () => {
            cancelled = true;
        };
    }, []);


    if (loading || !announcement) return null;

    const handleClose = () => {
        // Just hide now. Will pop again next login.
        setAnnouncement(null);
    };

    const handleDismissForever = async () => {
        try {
            await api.post(`/my/announcements/${announcement.id}/dismiss`);
        } catch (err) {
            console.error("Failed to dismiss announcement", err);
        } finally {
            setAnnouncement(null);
        }
    };

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
            <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                {/* Close (X) */}
                <button
                    type="button"
                    onClick={handleClose}
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
                    aria-label="Close"
                >
                    ✕
                </button>

                <h3 className="mb-3 text-lg font-semibold text-gray-900">
                    {announcement.title}
                </h3>

                <div className="prose prose-sm max-w-none text-gray-700">
                    {/* body_md is plain text/markdown for now */}
                    <p>{announcement.body_md}</p>
                </div>

                <div className="mt-6 flex items-center justify-between text-xs text-gray-500">
                    <span>
                        This message will continue to show until you choose{" "}
                        <strong>“Don&apos;t remind me again”</strong>.
                    </span>
                    <button
                        type="button"
                        onClick={handleDismissForever}
                        className="
    rounded-lg
    bg-rose-100
    text-rose-700
    px-4
    py-1.5
    text-xs
    font-semibold
    shadow-sm
    border
    border-rose-200
    transition-all
    hover:bg-rose-200
    hover:border-rose-300
    hover:shadow
    active:scale-95
    active:bg-rose-300
  "
                    >
                        Don&apos;t remind me again
                    </button>

                </div>
            </div>
        </div>
    );
}
