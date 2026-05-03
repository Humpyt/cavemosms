import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App.tsx";
import "./index.css";

if (Capacitor.isNativePlatform() && "serviceWorker" in navigator) {
  // Native shells should always load bundled assets directly, not stale SW cache.
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .catch(() => undefined);
}

createRoot(document.getElementById("root")!).render(<App />);
