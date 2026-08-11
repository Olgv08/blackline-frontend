import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import logo from "../assets/logo.png";
import heroImage from "../assets/hero-tattoo.jpg";
import "./Login.css";

export default function Login() {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.name || (data.user && data.user.name) || "Usuario");

      setAuth(data.token);

      nav("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Correo o contraseña incorrectos"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">

        <div className="auth-panel-content">
          <div className="brand">
            <img src={logo} alt="Black Line Studio" className="logo-img" />
            <h1>Panel Administrativo</h1>
            <p className="muted">
              Sistema interno para la gestión operativa de Black Line.
            </p>
          </div>

          <form className="form" onSubmit={onSubmit}>

            <label htmlFor="email">Correo electrónico</label>
            <div className="input-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v11A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-11Z" />
                <path d="m4 6.5 8 6 8-6" />
              </svg>
              <input
                id="email"
                type="email"
                placeholder="nombre@blacklinestudio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <label htmlFor="password">Contraseña</label>
            <div className="input-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
                <path d="M7.5 10.5V7.75a4.5 4.5 0 0 1 9 0v2.75" />
              </svg>
              <input
                id="password"
                type={show ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="ghost-toggle"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {show ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            <div className="row-between">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Recordar sesión
              </label>
              <Link to="/forgot-password" className="link">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {error && <div className="alert" role="alert">{error}</div>}

            <button
              type="submit"
              className="btn primary"
              disabled={loading}
            >
              {loading ? "Iniciando sesión..." : "Iniciar sesión"}
            </button>

          </form>

          <div className="footer-links" style={{ marginTop: 18, textAlign: "center" }}>
            <span className="muted">¿No tienes cuenta? </span>
            <Link to="/register" className="link">Regístrate aquí</Link>
          </div>

          <div className="access-badge">
            <svg className="icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="4.5" y="10.5" width="15" height="9.5" rx="2" />
              <path d="M7.5 10.5V7.75a4.5 4.5 0 0 1 9 0v2.75" />
            </svg>
            Acceso exclusivo para personal autorizado
          </div>
        </div>

        <p className="copyright">© 2026 Black Line Studio. All rights reserved.</p>
      </div>

      <div className="auth-hero" style={{ backgroundImage: `url(${heroImage})` }}>
        <div className="auth-hero-overlay" />
        <div className="auth-hero-content">
          <span className="hero-divider" />
          <h2>Administra tu estudio de forma profesional.</h2>
          <p>La precisión del arte, ahora aplicada a tu flujo de trabajo administrativo.</p>
        </div>
      </div>
    </div>
  );
}