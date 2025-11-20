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
          // mark as read once it has been shown
          try {
            await api.post(`/my/announcements/${first.id}/read`);
          } catch (err) {
            console.error("Failed to mark announcement read", err);
          }
        }
      } catch (err) {
        console.error("Failed to load my announcements", err);
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !announcement) return null;

  const handleClose = () => {
    // just hide for this session; will appear again next login
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
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-xl border border-emerald-100">
        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-emerald-50 px-6 py-4">
          <div>
            <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              Platform announcement
            </div>
            <h3 className="mt-2 text-lg font-semibold text-gray-900">
              {announcement.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* body */}
        <div className="px-6 py-4 text-sm text-gray-700 whitespace-pre-line">
          {announcement.body_md}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-xs text-gray-500">
          <span>
            This notice will keep showing when you log in until you choose{" "}
            <span className="font-semibold">“Don&apos;t remind me again”</span>.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDismissForever}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Don&apos;t remind me again
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}