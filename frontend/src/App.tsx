import { useState, JSX, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import "./App.css";
import VerificationInput from "react-verification-input";
import { Route } from "react-router";
import { Routes } from "react-router";
import { ToastContainer, toast } from "react-toastify";
import { Formik, Field, Form } from "formik";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "./components/ui/input";

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

function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [me] = useAuth();

  useEffect(() => {
    if (!me) {
      if (!location.pathname.includes("/auth")) {
        navigate("/auth/login");
      }
    } else {
      navigate("/office");
    }
  }, [me, navigate, location.pathname]);

  return (
    <>
      <ToastContainer />
      <Routes>
        <Route path="/office" element={<BackOffice />} />
        <Route path="/auth/:form" element={<Auth />} />
      </Routes>
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
                  Addresse email
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
              <div className="mt-12 text-center text-lg">
                <span className="text-gray-300">
                  Code non reçu ? &nbsp;&nbsp;
                </span>
                <Link
                  to="/auth/login"
                  className="font-semibold text-indigo-400 text-center hover:text-indigo-300"
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

const BackOffice = () => {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/logout", {
        method: "post",
        credentials: "include",
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

  return (
    <div>
      <p>Back office</p>
      <button onClick={handleLogout}>logout</button>
      {loading && <Loader />}
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
