import { useState, JSX, useEffect, createContext } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  BrowserRouter,
} from "react-router";
import "./App.css";
import VerificationInput from "react-verification-input";
import { Route } from "react-router";
import { Routes } from "react-router";
import { ToastContainer, toast } from "react-toastify";
import { Formik, Field, Form } from "formik";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "./components/ui/input";
import { getTranslations, Language, Translations } from "./i18n";
import MapView from "./components/core/MapView";
import WeatherGrid from "./components/core/WeatherGrid";

type User = {
  email: string;
};

const useAuth = (): (User | null)[] => {
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch("/api/me", {
          credentials: "include",
        });

        if (!resp.ok) {
          throw resp;
        }

        const me = await resp.json();
        setMe(me);
      } catch {
        setMe(null);
      }
    })();
  }, []);

  return [me];
};

export type UnitSystem = "knots-celsius" | "mph-fahrenheit";

export const ThemeContext = createContext<"light" | "dark">("light");
export const LanguageContext = createContext<{
  lang: Language;
  t: Translations;
}>({
  lang: "fr",
  t: getTranslations("fr"),
});
export const UnitContext = createContext<{
  units: UnitSystem;
  setUnits: (units: UnitSystem) => void;
}>({
  units: "knots-celsius",
  setUnits: () => { },
});

function SunIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      <circle cx="12" cy="12" r="4" />
      <g>
        <line x1="12" y1="2" x2="12" y2="4" />
        <line x1="12" y1="20" x2="12" y2="22" />
        <line x1="4.93" y1="4.93" x2="6.34" y2="6.34" />
        <line x1="17.66" y1="17.66" x2="19.07" y2="19.07" />
        <line x1="2" y1="12" x2="4" y2="12" />
        <line x1="20" y1="12" x2="22" y2="12" />
        <line x1="4.93" y1="19.07" x2="6.34" y2="17.66" />
        <line x1="17.66" y1="6.34" x2="19.07" y2="4.93" />
      </g>
    </svg>
  );
}

function MoonIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function LanguageIcon(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.className}
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function AppHeader({
  theme,
  toggleTheme,
  toggleLanguage,
  toggleUnits,
  lang,
  t,
  units,
}: {
  theme: "light" | "dark";
  toggleTheme: () => void;
  toggleLanguage: () => void;
  toggleUnits: () => void;
  lang: Language;
  t: Translations;
  units: UnitSystem;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleCreateClick = () => {
    navigate("/plan?create=true");
  };

  return (
    <header className="app-header">
      <h1>
        <SunIcon className="app-title-icon" />
        Weather App
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          onClick={handleCreateClick}
          className="theme-toggle"
          style={{
            backgroundColor: "var(--brand)",
            color: "white",
            fontWeight: "600",
          }}
          title="Créer un itinéraire"
          aria-label="Créer un itinéraire"
        >
          <span className="theme-label">+ Créer</span>
        </button>
        <button
          onClick={toggleLanguage}
          className="theme-toggle"
          title={t.languageAria}
          aria-label={t.languageAria}
        >
          <span className="theme-icon" aria-hidden>
            <LanguageIcon />
          </span>
          <span className="theme-label">{lang.toUpperCase()}</span>
        </button>
        <button
          aria-pressed={theme === "dark"}
          onClick={toggleTheme}
          className="theme-toggle"
          title={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
          aria-label={theme === "dark" ? t.themeDarkAria : t.themeLightAria}
        >
          <span className="theme-icon" aria-hidden>
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </span>
          <span className="theme-label">
            {theme === "dark" ? t.themeDark : t.themeLight}
          </span>
        </button>
        <button
          onClick={toggleUnits}
          className="theme-toggle"
          title={t.unitsAria}
          aria-label={t.unitsAria}
        >
          <span className="theme-label">
            {units === "knots-celsius"
              ? t.unitsKnotsCelsius
              : t.unitsMphFahrenheit}
          </span>
        </button>
      </div>
    </header>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);

  // Theme: 'light' | 'dark'
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Language: 'fr' | 'en'
  const [lang, setLang] = useState<Language>("fr");
  const t = getTranslations(lang);

  // Units: 'knots-celsius' | 'mph-fahrenheit'
  const [units, setUnits] = useState<UnitSystem>("knots-celsius");

  const [me] = useAuth();

  useEffect(() => {
    if (!me) {
      if (!location.pathname.includes("/auth")) {
        navigate("/auth/login");
      }
    } else {
      navigate("/plan?create=true");
    }
  }, [me, navigate, location.pathname]);

  useEffect(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | null;
    if (saved === "light" || saved === "dark") {
      setTheme(saved);
      document.documentElement.setAttribute("data-theme", saved);
    } else {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial = prefersDark ? "dark" : "light";
      setTheme(initial);
      document.documentElement.setAttribute("data-theme", initial);
    }
  }, []);

  // Initialize language from localStorage or browser preference
  useEffect(() => {
    const saved = localStorage.getItem("language") as Language | null;
    if (saved === "fr" || saved === "en") {
      setLang(saved);
    } else {
      const browserLang = navigator.language.toLowerCase();
      const initial: Language = browserLang.startsWith("fr") ? "fr" : "en";
      setLang(initial);
    }
  }, []);

  // Keep document attribute and localStorage in sync when theme changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Keep localStorage in sync when language changes
  useEffect(() => {
    localStorage.setItem("language", lang);
    document.documentElement.setAttribute("lang", lang);
  }, [lang]);

  // Initialize units from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("units") as UnitSystem | null;
    if (saved === "knots-celsius" || saved === "mph-fahrenheit") {
      setUnits(saved);
    }
  }, []);

  // Keep localStorage in sync when units change
  useEffect(() => {
    localStorage.setItem("units", units);
  }, [units]);

  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  function toggleLanguage() {
    setLang((l) => (l === "fr" ? "en" : "fr"));
  }

  function toggleUnits() {
    setUnits((u) =>
      u === "knots-celsius" ? "mph-fahrenheit" : "knots-celsius",
    );
  }

  return (
    <>
      <LanguageContext.Provider value={{ lang, t }}>
        <UnitContext.Provider value={{ units, setUnits }}>
          <ThemeContext.Provider value={theme}>
            <div className="welcome-wallpaper-background" data-theme={theme} />
            <div className="welcome-gradient-background" />
            <ToastContainer />
            <AppHeader
              theme={theme}
              toggleTheme={toggleTheme}
              toggleLanguage={toggleLanguage}
              toggleUnits={toggleUnits}
              lang={lang}
              t={t}
              units={units}
            />
            <Routes>
              <Route path="/auth/:form" element={<Auth />} />
              <Route
                path="/"
                element={<Navigate to="/auth/register" replace />}
              />
              <Route
                path="/weather"
                element={
                  <div className="container">
                    <h2 style={{ marginTop: 0 }}>{t.forecastByCity}</h2>

                    {error && (
                      <div className="error">
                        {t.errorPrefix}
                        {error}
                      </div>
                    )}

                    {/* Composant avec données en dur pour les 5 villes */}
                    <WeatherGrid />
                  </div>
                }
              />
              <Route path="/plan" element={<MapView />} />
            </Routes>
          </ThemeContext.Provider>
        </UnitContext.Provider>
      </LanguageContext.Provider>
    </>
  );
}

export default App;

const FormPaths = {
  Login: "/auth/login",
  Code: "/auth/code",
  Register: "/auth/register",
};

export function Auth() {
  const [form, setForm] = useState(FormPaths.Login);
  const [loading, setLoading] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const handleLogin = async (value: string) => {
    setLoading(true);
    try {
      const response = await fetch("/api/login", {
        method: "post",
        credentials: "include",
        body: JSON.stringify({
          one_time_code: +value,
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw response;
      }

      window.location.reload();
    } catch (error) {
      setLoading(false);
      handleErrorMessage(error as Response);
    }
  };

  useEffect(() => {
    const path = location.pathname;
    console.log("Current path:", path);
    console.log("FormPaths.Register:", FormPaths.Register);
    switch (path) {
      case FormPaths.Code:
        setForm(FormPaths.Code);
        break;
      case FormPaths.Register:
        setForm(FormPaths.Register);
        break;
      case FormPaths.Login:
        setForm(FormPaths.Login);
        break;
    }
  }, [location.pathname]);

  useEffect(() => {
    // Load the GSI script dynamically
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;

    document.body.appendChild(script);
    return () => {
      // Cleanup if needed (e.g., when navigating away)
      document.body.removeChild(script);
    };
  }, []);

  switch (form) {
    case FormPaths.Login:
      return (
        <FormWrapper>
          <div className="flex flex-col justify-center px-12 py-6">
            <div className="pb-4">
              <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-white">
                Connect with One Time Code
              </h2>
            </div>
            <Formik
              initialValues={{
                email: "",
              }}
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  const response = await fetch("/api/otc", {
                    method: "post",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      email: values.email,
                    }),
                  });

                  if (!response.ok) {
                    throw response;
                  }

                  setLoading(false);
                  navigate("/auth/code");
                } catch (error) {
                  setLoading(false);
                  handleErrorMessage(error as Response);
                }
              }}
            >
              <Form>
                <Label htmlFor="email" className="text-md text-indigo-100 pb-2">
                  Adresse email
                </Label>
                <Field
                  as={Input}
                  id="email"
                  name="email"
                  type="email"
                  className="p-5 text-white"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="text-md w-full mt-3 font-semibold py-6 cursor-pointer"
                >
                  Obtenir un code de connexion
                </Button>
              </Form>
            </Formik>
            {/*
            <div style={{ marginTop: "1rem" }}>
              <div
                id="g_id_onload"
                data-client_id="326900198732-htapqcicj1rchj7s49rl8931pbfl4o1u.apps.googleusercontent.com"
                data-login_uri={`${import.meta.env.VITE_GOOGLE_AUTH_CALLBACK}/oauth/gsi`}
                data-auto_prompt="true"
                data-ux_mode="redirect"
                data-context="signin"
                data-state={window.location.href}
                data-itp_support="true"
                data-width="300"
              />
              <div
                className="g_id_signin"
                data-type="standard"
                data-shape="rectangular"
                data-theme="outline"
                data-text="signin_with"
                data-size="large"
                data-state={window.location.href}
                data-logo_alignment="left"
                data-width="300"
              />
            </div>
          */}
            <div className="mt-3">
              <div className="block">
                <Link
                  to="/auth/register"
                  className="font-semibold text-md block text-indigo-400 text-center hover:text-indigo-300"
                >
                  Créer mon compte
                </Link>
              </div>
            </div>
            <div className="flex justify-center py-10 text-center">
              {loading && <Loader />}
            </div>
          </div>
        </FormWrapper>
      );

    case FormPaths.Code:
      return (
        <FormWrapper>
          <div className="flex flex-col justify-center px-12 py-6">
            <div className="">
              <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-white">
                Vérifiez vos emails pour un code
              </h2>
              <p className="mt-3 text-center tracking-tight text-xl text-gray-300">
                Nous vous avons envoyé un code à 6 chiffres. Ce code expire
                bientôt, merci de le saisir rapidement.
              </p>
            </div>
            <div className="mt-10">
              <div className="mb-6 flex justify-center">
                <VerificationInput
                  length={6}
                  validChars="0-9"
                  inputProps={{ inputMode: "numeric" }}
                  placeholder=""
                  autoFocus={true}
                  onComplete={handleLogin}
                  classNames={{
                    container: "code-input-container",
                    character: "code-input-character",
                    characterInactive: "code-input-character--inactive",
                    characterSelected: "code-input-character--selected",
                    characterFilled: "code-input-character--filled",
                  }}
                />
              </div>
            </div>
            <div className="block">
              <div className="mt-12 flex flex-col text-center text-lg">
                <span className="text-gray-300">Code non reçu ?</span>
                <Link
                  to="/auth/login"
                  className="block font-semibold text-indigo-400 text-center hover:text-indigo-300"
                >
                  Demander un nouveau code
                </Link>
              </div>
            </div>
            <div className="block ml-auto mr-auto pt-10">
              {loading && <Loader />}
            </div>
          </div>
        </FormWrapper>
      );

    case FormPaths.Register:
      return (
        <FormWrapper>
          <div className="flex flex-col justify-center px-12 py-6">
            <div className="pb-4">
              <h2 className="mt-3 text-center text-3xl font-bold tracking-tight text-white">
                Créer un compte
              </h2>
            </div>
            <Formik
              initialValues={{
                name: "",
                email: "",
              }}
              onSubmit={async (values) => {
                setLoading(true);
                try {
                  const response = await fetch("/api/register", {
                    method: "post",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      name: values.name,
                      email: values.email,
                    }),
                  });

                  if (!response.ok) {
                    throw response;
                  }

                  setLoading(false);
                  navigate("/auth/code");
                } catch (error) {
                  setLoading(false);
                  handleErrorMessage(error as Response);
                }
              }}
            >
              <Form>
                <Label htmlFor="name" className="text-md text-indigo-100 pb-2">
                  Nom complet
                </Label>
                <Field
                  as={Input}
                  id="name"
                  name="name"
                  type="text"
                  className="p-5 text-white mb-3"
                />
                <Label htmlFor="email" className="text-md text-indigo-100 pb-2">
                  Adresse email
                </Label>
                <Field
                  as={Input}
                  id="email"
                  name="email"
                  type="email"
                  className="p-5 text-white"
                />
                <Button
                  type="submit"
                  size="lg"
                  className="text-md w-full mt-3 font-semibold py-6 cursor-pointer"
                >
                  Créer mon compte
                </Button>
              </Form>
            </Formik>
            <div className="mt-3">
              <div className="block">
                <Link
                  to="/auth/login"
                  className="font-semibold text-md text-indigo-400 text-center block hover:text-indigo-300"
                >
                  J'ai déjà un compte
                </Link>
              </div>
            </div>
            <div className="flex justify-center py-10 text-center">
              {loading && <Loader />}
            </div>
          </div>
        </FormWrapper>
      );

    default:
      return null;
  }
}

const FormWrapper = ({ children }: { children: JSX.Element }) => {
  return (
    <div
      className="m-auto w-full flex flex-col max-w-xl rounded-2xl"
      style={{
        backdropFilter: "blur(28px) brightness(0.9)",
        maxWidth: "400px",
      }}
    >
      <div>{children}</div>
    </div>
  );
};

const Loader = () => {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-600"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
};

const handleErrorMessage = (error: Error | Response) => {
  (error as Response).json().then((resp) => {
    toast.error(resp.message, {
      theme: "dark",
    });
  });
};
