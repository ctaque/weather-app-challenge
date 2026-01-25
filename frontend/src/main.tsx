import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./styles.scss";
import "./App.css";
import { CookiesProvider } from "react-cookie";
import { BrowserRouter } from "react-router";

createRoot(document.getElementById("root")!).render(
  <CookiesProvider>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </CookiesProvider>,
);
