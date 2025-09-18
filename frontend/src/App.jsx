/*import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App*/

import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RequireAuth from "./components/RequireAuth";

function Dashboard() {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2">Welcome, {user?.name || user?.email || "user"}.</p>
    </div>
  );
}

// function App() {
//   const [status, setStatus] = useState("loading...");

//   useEffect(() => {
//     const api = import.meta.env.VITE_API_URL || "http://localhost:8000";
//     fetch(`${api}/health`)
//       .then((r) => r.json())
//       .then((data) => setStatus(data.status || "unknown"))
//       .catch(() => setStatus("error"));
//   }, []);

//   return (
//     <main style={{ fontFamily: "sans-serif", padding: 24 }}>
//       <h1>FYP Frontend</h1>
//       <p>Backend health: <strong>{status}</strong></p>
//     </main>
//   );
// }
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="*" element={<LoginPage />} />
      </Routes>
    </BrowserRouter>
  );
}