import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, setAuth } from "../api";
import logo from "../assets/logo.png";
import heroImage from "../assets/hero-tattoo.jpg";
import "./Login.css";

type ModoRegistro = "personal" | "crear" | "unirse";

export default function Register() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [modo, setModo] = useState<ModoRegistro>("personal");
  const [estudioNombre, setEstudioNombre] = useState("");
  const [codigoInvitacion, setCodigoInvitacion] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const payload: Record<string, string> = { name, email, password };

      if (modo === "personal") {
        payload.estudioNombre = `${name || "Mi espacio"} (Personal)`;
      } else if (modo === "crear") {
        payload.estudioNombre = estudioNombre;
      } else {
        payload.codigoInvitacion = codigoInvitacion.trim().toUpperCase();
      }

      const { data } = await api.post("/auth/register", payload);

      localStorage.setItem("token", data.token);
      localStorage.setItem("userName", data.name || (data.user && data.user.name) || "Usuario");

      setAuth(data.token);

      nav("/dashboard");
    } catch (err: any) {
      setError(
        err.response?.data?.message || "Error al crear la cuenta"
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
            {logo ? (
              <img src={logo} alt="Black Line Studio" className="logo-img" />
            ) : (
              <div className="logo-fallback">BLACK LINE STUDIO</div>
            )}
            <h1>Crear cuenta</h1>
            <p className="muted">
              Elige cómo quieres usar la plataforma.
            </p>
          </div>

          <div className="estudio-toggle estudio-toggle-3">
            <button
              type="button"
              className={`estudio-toggle-btn${modo === "personal" ? " active" : ""}`}
              onClick={() => setModo("personal")}
            >
              👤 Uso personal
            </button>
            <button
              type="button"
              className={`estudio-toggle-btn${modo === "crear" ? " active" : ""}`}
              onClick={() => setModo("crear")}
            >
              🏢 Crear estudio
            </button>
            <button
              type="button"
              className={`estudio-toggle-btn${modo === "unirse" ? " active" : ""}`}
              onClick={() => setModo("unirse")}
            >
              🔑 Unirme con código
            </button>
          </div>

          <p className="modo-explicacion">
            {modo === "personal" &&
              "Tendrás tu propio espacio privado, solo para ti. Nadie más podrá ver ni modificar tu información."}
            {modo === "crear" &&
              "Crearás un estudio compartido. Podrás invitar a tu equipo con un código para que todos vean y editen la misma información."}
            {modo === "unirse" &&
              "Te unirás a un estudio que ya existe usando el código de invitación que te compartió tu compañero."}
          </p>

          <form className="form" onSubmit={onSubmit}>

            {modo === "crear" && (
              <>
                <label htmlFor="estudioNombre">Nombre del estudio</label>
                <div className="input-icon">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M3 21V8l9-5 9 5v13" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                  <input
                    id="estudioNombre"
                    type="text"
                    placeholder="Ej. Black Line Studio"
                    value={estudioNombre}
                    onChange={(e) => setEstudioNombre(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            {modo === "unirse" && (
              <>
                <label htmlFor="codigoInvitacion">Código de invitación</label>
                <div className="input-icon">
                  <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="M3 8h18" />
                  </svg>
                  <input
                    id="codigoInvitacion"
                    type="text"
                    placeholder="Ej. A3F9K2"
                    value={codigoInvitacion}
                    onChange={(e) => setCodigoInvitacion(e.target.value.toUpperCase())}
                    maxLength={6}
                    required
                    style={{ textTransform: "uppercase", letterSpacing: "0.1em" }}
                  />
                </div>
                <p className="muted" style={{ fontSize: 12.5, marginTop: -6 }}>
                  Pídele el código a quien ya administra el estudio.
                </p>
              </>
            )}

            <label htmlFor="name">Nombre completo</label>
            <div className="input-icon">
              <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="8" r="3.5" />
                <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" />
              </svg>
              <input
                id="name"
                type="text"
                placeholder="Nombre del tatuador"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
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

            {error && <div className="alert" role="alert">{error}</div>}

            <button
              type="submit"
              className="btn primary"
              disabled={loading}
            >
              {loading ? "Creando cuenta..." : "Crear cuenta"}
            </button>

          </form>

          <div className="footer-links" style={{ marginTop: 18, textAlign: "center" }}>
            <span className="muted">¿Ya tienes cuenta? </span>
            <Link to="/" className="link">Inicia sesión</Link>
          </div>
        </div>

        <p className="copyright">© 2026 Black Line Studio. All rights reserved.</p>
      </div>

      <div
        className="auth-hero"
        style={heroImage ? { backgroundImage: `url(${heroImage})` } : undefined}
      >
        <div className="auth-hero-overlay" />
        <div className="auth-hero-content">
          <span className="hero-divider" />
          <h2>Súmate al equipo.</h2>
          <p>Crea tu acceso administrativo para gestionar citas y gastos del estudio.</p>
        </div>
      </div>
    </div>
  );
}