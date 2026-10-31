import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// No <StrictMode>: the 2FA setup creates a factor on mount, and a development double mount would create two.
createRoot(document.getElementById("root")!).render(<App />);
