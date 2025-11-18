import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import "../components/css/PropertiesPage.css";

const VIDEO_SOURCES = {
  agent: "/media/welcome-agent.mp4", // TODO: replace with real agent video path
  homeowner: "/media/welcome-homeowner.mp4", // TODO: replace with real homeowner video path
};

const getSeenKey = (role) => `welcome_seen:${role || "unknown"}`;

export default function WelcomeVideo() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const role = user?.role || "unknown";
  const from = location.state?.from;

  const targetPath = useMemo(() => {
    if (from) return from;
    if (role === "agent") return "/properties";
    if (role === "homeowner") return "/homeowner/search";
    return "/dashboard";
  }, [from, role]);

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
      return;
    }
    const seen = sessionStorage.getItem(getSeenKey(role)) === "1";
    if (seen) {
      navigate(targetPath, { replace: true });
    }
  }, [navigate, role, targetPath, user]);

  if (!user) return null;

  const markSeenAndContinue = () => {
    sessionStorage.setItem(getSeenKey(role), "1");
    navigate(targetPath, { replace: true });
  };

  const src = VIDEO_SOURCES[role] || VIDEO_SOURCES.homeowner;

  return (
    <div className="welcome-video">
      <div className="welcome-video__card">
        <div className="welcome-video__header">
          <div>
            <p className="welcome-video__eyebrow">Welcome back</p>
            <h1 className="welcome-video__title">
              {role === "agent"
                ? "A quick intro for agents"
                : "A quick intro for homebuyers"}
            </h1>
            <p className="welcome-video__subtitle">
              Watch this short clip to learn what’s new. You can skip anytime.
            </p>
          </div>
          <button type="button" className="welcome-video__skip" onClick={markSeenAndContinue}>
            Skip
          </button>
        </div>

        <div className="welcome-video__player">
          <video
            src={src}
            controls
            autoPlay
            onEnded={markSeenAndContinue}
            style={{ width: "100%", borderRadius: 16, background: "#000" }}
          >
            Your browser does not support the video tag.
          </video>
        </div>

        <div className="welcome-video__actions">
          <button type="button" className="welcome-video__primary" onClick={markSeenAndContinue}>
            Continue to dashboard
          </button>
          <button type="button" className="welcome-video__secondary" onClick={markSeenAndContinue}>
            Skip video
          </button>
        </div>
      </div>
    </div>
  );
}
