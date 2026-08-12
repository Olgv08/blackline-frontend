import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api, setAuth } from "../api";
import {
  pushNotificationsSupported,
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  registerServiceWorker,
} from "../notifications";
import "./Dashboard.css";
import OfflineBanner from "../offline/OfflineBanner";

interface Profile {
  _id: string;
  name: string;
  email: string;
  estudio?: {
    _id: string;
    nombre: string;
    codigoInvitacion: string;
  };
}

interface GastoStats {
  totalMesActual: number;
  variacionPorcentual: number;
}

interface BalanceResumen {
  balanceMesActual: number;
  saldoAcumulado: number;
  variacionPorcentual: number;
}

interface Cita {
  _id: string;
  clienteNombre: string;
  fecha: string;
  duracionMinutos: number;
  precio: number;
  estado: "programada" | "completada" | "cancelada";
}

interface ClienteRecurrente {
  _id: string;
  nombre: string;
  telefono: string;
  totalCitas: number;
}

interface InsumoBajo {
  _id: string;
  nombre: string;
  cantidadActual: number;
  cantidadMinima: number;
  unidad: string;
}

interface InsumoOpcion {
  _id: string;
  nombre: string;
  unidad: string;
  cantidadActual: number;
}

interface Miembro {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

type Categoria = "insumos" | "servicios" | "marketing" | "renta" | "nomina" | "otros";

const CATEGORIAS: { value: Categoria; label: string }[] = [
  { value: "insumos", label: "Insumos" },
  { value: "servicios", label: "Servicios" },
  { value: "marketing", label: "Marketing" },
  { value: "renta", label: "Renta" },
  { value: "nomina", label: "Nómina" },
  { value: "otros", label: "Otros" },
];

const NOTES_KEY = "blackline_dashboard_notes";

function money(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

function iniciales(nombre: string) {
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");
}

const emptyEditForm = {
  name: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const emptyCitaForm = {
  clienteNombre: "",
  clienteTelefono: "",
  fecha: new Date().toISOString().slice(0, 10),
  hora: "12:00",
  duracionMinutos: "120",
  precio: "",
};

const emptyGastoForm = {
  categoria: "insumos" as Categoria,
  descripcion: "",
  monto: "",
};

type CategoriaIngreso = "tatuaje" | "piercing" | "producto" | "propina" | "otros";

const CATEGORIAS_INGRESO: { value: CategoriaIngreso; label: string }[] = [
  { value: "tatuaje", label: "Tatuaje" },
  { value: "piercing", label: "Piercing" },
  { value: "producto", label: "Producto" },
  { value: "propina", label: "Propina" },
  { value: "otros", label: "Otros" },
];

const emptyIngresoForm = {
  categoria: "tatuaje" as CategoriaIngreso,
  descripcion: "",
  monto: "",
};

const emptyClienteForm = {
  nombre: "",
  telefono: "",
  email: "",
};

/* ---------- Iconos (line-style, monocromáticos — sin emoji) ---------- */

function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  );
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="8" r="3.5" />
      <path d="M3.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2" />
      <path d="M18.5 8v5M16 10.5h5" />
    </svg>
  );
}

function IconBanknote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M5.5 9v0M18.5 15v0" />
    </svg>
  );
}

function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12v18l-2.5-1.6L13 21l-2.5-1.6L8 21l-2-1.6V3z" />
      <path d="M9 8h6M9 12h6M9 16h3.5" />
    </svg>
  );
}

function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="13" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M2.8 20c0-3.4 2.7-5.9 6.2-5.9s6.2 2.5 6.2 5.9" />
      <path d="M15.5 5.3c1.5.4 2.6 1.7 2.6 3.3 0 1.6-1.1 2.9-2.6 3.3M18 14.4c2 .5 3.4 2.2 3.4 4.4" />
    </svg>
  );
}

function IconBox() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5v-9z" />
      <path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" />
    </svg>
  );
}

function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M5 5l14 14M19 5 5 19" />
    </svg>
  );
}

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: IconGrid },
  { to: "/citas", label: "Citas", icon: IconCalendar },
  { to: "/clientes", label: "Clientes", icon: IconUsers },
  { to: "/ingresos", label: "Ingresos", icon: IconBanknote },
  { to: "/gastos", label: "Gastos", icon: IconReceipt },
  { to: "/insumos", label: "Insumos", icon: IconBox },
];

export default function Dashboard() {
  const nav = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [gastoStats, setGastoStats] = useState<GastoStats | null>(null);
  const [balance, setBalance] = useState<BalanceResumen | null>(null);
  const [totalClientes, setTotalClientes] = useState<number | null>(null);
  const [proximasCitas, setProximasCitas] = useState<Cita[]>([]);
  const [recurrentes, setRecurrentes] = useState<ClienteRecurrente[]>([]);
  const [insumosBajos, setInsumosBajos] = useState<InsumoBajo[]>([]);
  const [todosInsumos, setTodosInsumos] = useState<InsumoOpcion[]>([]);
  const [miembros, setMiembros] = useState<Miembro[]>([]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<"loading" | "subscribed" | "not-subscribed" | "unsupported">("loading");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [showCitaModal, setShowCitaModal] = useState(false);
  const [citaForm, setCitaForm] = useState(emptyCitaForm);
  const [citaError, setCitaError] = useState("");
  const [savingCita, setSavingCita] = useState(false);

  const [showGastoModal, setShowGastoModal] = useState(false);
  const [gastoForm, setGastoForm] = useState(emptyGastoForm);
  const [gastoError, setGastoError] = useState("");
  const [savingGasto, setSavingGasto] = useState(false);

  const [showIngresoModal, setShowIngresoModal] = useState(false);
  const [ingresoForm, setIngresoForm] = useState(emptyIngresoForm);
  const [ingresoError, setIngresoError] = useState("");
  const [savingIngreso, setSavingIngreso] = useState(false);

  const [showClienteModal, setShowClienteModal] = useState(false);
  const [clienteForm, setClienteForm] = useState(emptyClienteForm);
  const [clienteError, setClienteError] = useState("");
  const [savingCliente, setSavingCliente] = useState(false);

  const [notas, setNotas] = useState("");
  const [notasGuardadas, setNotasGuardadas] = useState(true);

  const [consumoInsumoId, setConsumoInsumoId] = useState("");
  const [consumoCantidad, setConsumoCantidad] = useState("");
  const [consumoError, setConsumoError] = useState("");
  const [consumoSuccess, setConsumoSuccess] = useState("");
  const [savingConsumo, setSavingConsumo] = useState(false);

  async function loadProfile() {
    try {
      setLoading(true);
      const { data } = await api.get("/auth/profile");
      setProfile(data.user);
      setProfileError("");
    } catch (err: any) {
      if (err.response?.status === 401) {
        // El token ya no es válido de verdad (expiró o se revocó) — ahí sí cerramos sesión.
        handleLogout();
      } else {
        // Falla de red, servidor dormido despertando (cold start), timeout, etc.
        // No cerramos sesión por esto; solo avisamos y dejamos reintentar.
        setProfileError("No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    loadResumen();

    const notasGuardadasLocal = localStorage.getItem(NOTES_KEY);
    if (notasGuardadasLocal) setNotas(notasGuardadasLocal);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!pushNotificationsSupported()) {
      setPushStatus("unsupported");
      return;
    }
    registerServiceWorker()
      .then(() => getPushSubscriptionStatus())
      .then(setPushStatus)
      .catch(() => setPushStatus("not-subscribed"));
  }, []);

  async function togglePush() {
    setPushError("");
    setPushBusy(true);
    try {
      if (pushStatus === "subscribed") {
        await unsubscribeFromPush();
        setPushStatus("not-subscribed");
      } else {
        await subscribeToPush();
        setPushStatus("subscribed");
      }
    } catch (err: any) {
      setPushError(err.message || "No se pudo activar las notificaciones.");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // El menú móvil se cierra solo si cambias de ruta (por si algo más navega)
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Autoguardado de notas con debounce chico
  useEffect(() => {
    setNotasGuardadas(false);
    const timeout = setTimeout(() => {
      localStorage.setItem(NOTES_KEY, notas);
      setNotasGuardadas(true);
    }, 500);
    return () => clearTimeout(timeout);
  }, [notas]);

  async function loadResumen() {
    try {
      const hoy = new Date();
      const en30dias = new Date();
      en30dias.setDate(en30dias.getDate() + 30);

      const [
        gastosRes,
        balanceRes,
        clientesRes,
        citasRes,
        recurrentesRes,
        insumosBajosRes,
        todosInsumosRes,
        miembrosRes,
      ] = await Promise.all([
        api.get("/gastos/stats/resumen?meses=1"),
        api.get("/balance/resumen?meses=1&limit=1"),
        api.get("/clientes"),
        api.get(`/citas?from=${hoy.toISOString()}&to=${en30dias.toISOString()}`),
        api.get("/clientes/recurrentes?limit=5"),
        api.get("/insumos?stockBajo=true"),
        api.get("/insumos"),
        api.get("/auth/miembros"),
      ]);

      setGastoStats(gastosRes.data);
      setBalance(balanceRes.data);
      setTotalClientes(clientesRes.data.clientes.length);

      const proximas = citasRes.data.citas
        .filter((c: Cita) => c.estado === "programada")
        .sort((a: Cita, b: Cita) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())
        .slice(0, 5);
      setProximasCitas(proximas);

      setRecurrentes(recurrentesRes.data.clientes);
      setInsumosBajos(insumosBajosRes.data.insumos);
      setTodosInsumos(todosInsumosRes.data.insumos);
      setMiembros(miembrosRes.data.miembros);
    } catch {
      // El dashboard no debe tronar si algún módulo aún no tiene datos
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userName");
    setAuth(null);
    nav("/");
  }

  // --- Editar perfil ---
  function openEditModal() {
    setEditForm({
      name: profile?.name || "",
      email: profile?.email || "",
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
    setEditError("");
    setEditSuccess("");
    setShowDropdown(false);
    setShowEditModal(true);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (editForm.newPassword && editForm.newPassword !== editForm.confirmPassword) {
      setEditError("Las contraseñas nuevas no coinciden.");
      return;
    }

    setSavingProfile(true);
    try {
      const payload: Record<string, string> = {
        name: editForm.name,
        email: editForm.email,
      };
      if (editForm.newPassword) {
        payload.currentPassword = editForm.currentPassword;
        payload.newPassword = editForm.newPassword;
      }

      const { data } = await api.put("/auth/profile", payload);
      setProfile((prev) => (prev ? { ...prev, name: data.user.name, email: data.user.email } : prev));
      setEditSuccess("Perfil actualizado correctamente.");
      setEditForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
      await loadResumen();
    } catch (err: any) {
      setEditError(err.response?.data?.message || "Error al actualizar el perfil");
    } finally {
      setSavingProfile(false);
    }
  }

  // --- Cita rápida ---
  function openCitaModal() {
    setCitaForm(emptyCitaForm);
    setCitaError("");
    setShowCitaModal(true);
  }

  async function handleCreateCita(e: React.FormEvent) {
    e.preventDefault();
    setCitaError("");
    setSavingCita(true);
    try {
      const fechaISO = new Date(`${citaForm.fecha}T${citaForm.hora}`).toISOString();
      await api.post("/citas", {
        clienteNombre: citaForm.clienteNombre,
        clienteTelefono: citaForm.clienteTelefono,
        fecha: fechaISO,
        duracionMinutos: Number(citaForm.duracionMinutos),
        precio: Number(citaForm.precio),
      });
      setShowCitaModal(false);
      await loadResumen();
    } catch (err: any) {
      setCitaError(err.response?.data?.message || "Error al crear la cita");
    } finally {
      setSavingCita(false);
    }
  }

  // --- Gasto de hoy ---
  function openGastoModal() {
    setGastoForm(emptyGastoForm);
    setGastoError("");
    setShowGastoModal(true);
  }

  async function handleCreateGasto(e: React.FormEvent) {
    e.preventDefault();
    setGastoError("");
    setSavingGasto(true);
    try {
      await api.post("/gastos", {
        categoria: gastoForm.categoria,
        descripcion: gastoForm.descripcion,
        monto: Number(gastoForm.monto),
        fecha: new Date().toISOString(),
        notas: "",
      });
      setShowGastoModal(false);
      await loadResumen();
    } catch (err: any) {
      setGastoError(err.response?.data?.message || "Error al registrar el gasto");
    } finally {
      setSavingGasto(false);
    }
  }

  // --- Ingreso de hoy ---
  function openIngresoModal() {
    setIngresoForm(emptyIngresoForm);
    setIngresoError("");
    setShowIngresoModal(true);
  }

  async function handleCreateIngreso(e: React.FormEvent) {
    e.preventDefault();
    setIngresoError("");
    setSavingIngreso(true);
    try {
      await api.post("/ingresos", {
        categoria: ingresoForm.categoria,
        descripcion: ingresoForm.descripcion,
        monto: Number(ingresoForm.monto),
        fecha: new Date().toISOString(),
        notas: "",
      });
      setShowIngresoModal(false);
      await loadResumen();
    } catch (err: any) {
      setIngresoError(err.response?.data?.message || "Error al registrar el ingreso");
    } finally {
      setSavingIngreso(false);
    }
  }

  // --- Cliente nuevo ---
  function openClienteModal() {
    setClienteForm(emptyClienteForm);
    setClienteError("");
    setShowClienteModal(true);
  }

  async function handleCreateCliente(e: React.FormEvent) {
    e.preventDefault();
    setClienteError("");
    setSavingCliente(true);
    try {
      await api.post("/clientes", {
        nombre: clienteForm.nombre,
        telefono: clienteForm.telefono,
        email: clienteForm.email,
      });
      setShowClienteModal(false);
      await loadResumen();
    } catch (err: any) {
      setClienteError(err.response?.data?.message || "Error al registrar el cliente");
    } finally {
      setSavingCliente(false);
    }
  }

  // --- Consumo diario de insumos ---
  async function handleConsumo(e: React.FormEvent) {
    e.preventDefault();
    setConsumoError("");
    setConsumoSuccess("");

    if (!consumoInsumoId || !consumoCantidad) {
      setConsumoError("Selecciona un insumo y una cantidad.");
      return;
    }

    setSavingConsumo(true);
    try {
      const { data } = await api.post(`/insumos/${consumoInsumoId}/consumo`, {
        cantidad: Number(consumoCantidad),
      });
      setConsumoSuccess(`Descontado: ${consumoCantidad} ${data.insumo.unidad} de ${data.insumo.nombre}`);
      setConsumoCantidad("");
      await loadResumen();
    } catch (err: any) {
      setConsumoError(err.response?.data?.message || "Error al registrar el consumo");
    } finally {
      setSavingConsumo(false);
    }
  }

  if (loading) {
    return (
      <div className="dashboard-loading">
        <p>Cargando...</p>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="dashboard-loading dashboard-error">
        <p>{profileError}</p>
        <button className="btn primary" onClick={loadProfile}>
          Reintentar
        </button>
      </div>
    );
  }

  const variacion = gastoStats?.variacionPorcentual ?? 0;
  const proximaCita = proximasCitas[0];
  const todoEnOrden = insumosBajos.length === 0 && (balance?.balanceMesActual ?? 0) >= 0;
  const primerNombre = profile?.name?.split(" ")[0] || "";

  return (
    <div className="dash-shell">
      <OfflineBanner />
      <aside className="dash-sidebar">
        <div className="dash-brand">
          <span className="dash-brand-name">
            {profile?.estudio?.nombre?.toUpperCase() || "BLACK LINE"}
          </span>
          <span className="dash-brand-sub">Studio Admin</span>
        </div>

        <nav className="dash-nav">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`dash-nav-item${location.pathname === item.to ? " active" : ""}`}
              >
                <span className="dash-nav-icon">
                  <Icon />
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <IconClose /> : <IconMenu />}
        </button>
      </aside>

      <div
        className={`mobile-drawer-backdrop${menuOpen ? " open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />
      <nav className={`mobile-drawer${menuOpen ? " open" : ""}`} aria-hidden={!menuOpen}>
        <div className="mobile-drawer-header">
          <span className="dash-brand-name">
            {profile?.estudio?.nombre?.toUpperCase() || "BLACK LINE"}
          </span>
          <button
            type="button"
            className="mobile-drawer-close"
            aria-label="Cerrar menú"
            onClick={() => setMenuOpen(false)}
          >
            <IconClose />
          </button>
        </div>

        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`mobile-drawer-item${location.pathname === item.to ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              <span className="mobile-drawer-icon">
                <Icon />
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <main className="dash-main">
        <header className="dash-topbar">
          <div>
            <span className="dash-eyebrow">Panel administrativo</span>
            <h1>Hola{primerNombre ? `, ${primerNombre}` : ""}</h1>
            <div className={`status-pill${todoEnOrden ? " ok" : " attn"}`}>
              <span className="status-dot" />
              {todoEnOrden ? "Todo en orden" : "Hay pendientes por revisar"}
            </div>
          </div>

          <div className="profile-widget" ref={dropdownRef}>
            <button className="profile-trigger" onClick={() => setShowDropdown((v) => !v)}>
              <span className="profile-avatar">{profile ? iniciales(profile.name) : "?"}</span>
              <span className="profile-info">
                <span className="profile-name">{profile?.name}</span>
                <span className="profile-role">Administrador</span>
              </span>
              <span className="profile-chevron">▾</span>
            </button>

            {showDropdown && (
              <div className="profile-dropdown">
                {profile?.estudio?.codigoInvitacion && (
                  <div className="profile-dropdown-codigo">
                    <span className="muted" style={{ fontSize: 11 }}>
                      Código de invitación
                    </span>
                    <strong>{profile.estudio.codigoInvitacion}</strong>
                  </div>
                )}
                <button className="profile-dropdown-item" onClick={openEditModal}>
                  ✎ Editar perfil
                </button>
                {pushStatus !== "unsupported" && (
                  <button
                    className="profile-dropdown-item"
                    onClick={togglePush}
                    disabled={pushBusy || pushStatus === "loading"}
                  >
                    {pushStatus === "subscribed" ? "🔕 Desactivar recordatorios" : "🔔 Activar recordatorios"}
                  </button>
                )}
                {pushError && <p className="profile-dropdown-error">{pushError}</p>}
                <button className="profile-dropdown-item danger" onClick={handleLogout}>
                  ⏻ Cerrar sesión
                </button>
              </div>
            )}
          </div>
        </header>

        {insumosBajos.length > 0 && (
          <div className="stock-banner">
            <span className="stock-banner-icon">⚠</span>
            <div className="stock-banner-text">
              <strong>{insumosBajos.length}</strong>{" "}
              {insumosBajos.length === 1 ? "insumo está" : "insumos están"} en stock bajo:{" "}
              {insumosBajos.slice(0, 3).map((i) => i.nombre).join(", ")}
              {insumosBajos.length > 3 ? ` y ${insumosBajos.length - 3} más` : ""}
            </div>
            <Link to="/insumos" className="stock-banner-link">
              Ver inventario →
            </Link>
          </div>
        )}

        <div className="dash-shortcuts">
          <button className="shortcut-action" onClick={openCitaModal}>
            <span className="shortcut-icon">
              <IconCalendar />
            </span>
            <div>
              <span className="shortcut-title">Crear cita rápida</span>
              <span className="shortcut-sub">Agenda en segundos</span>
            </div>
          </button>

          <button className="shortcut-action" onClick={openClienteModal}>
            <span className="shortcut-icon">
              <IconUserPlus />
            </span>
            <div>
              <span className="shortcut-title">Registrar cliente</span>
              <span className="shortcut-sub">Sin necesidad de cita</span>
            </div>
          </button>

          <button className="shortcut-action" onClick={openIngresoModal}>
            <span className="shortcut-icon">
              <IconBanknote />
            </span>
            <div>
              <span className="shortcut-title">Registrar ingreso</span>
              <span className="shortcut-sub">Venta, servicio o propina</span>
            </div>
          </button>

          <button className="shortcut-action" onClick={openGastoModal}>
            <span className="shortcut-icon">
              <IconReceipt />
            </span>
            <div>
              <span className="shortcut-title">Añadir gasto de hoy</span>
              <span className="shortcut-sub">Registro exprés</span>
            </div>
          </button>
        </div>

        <div className="dash-stats-row">
          <div className={`dash-stat-card ${(balance?.balanceMesActual ?? 0) < 0 ? "dash-stat-neg" : "dash-stat-pos"}`}>
            <span className="dash-stat-label">Balance del mes</span>
            <span className="dash-stat-value">{money(balance?.balanceMesActual ?? 0)}</span>
            <span className="dash-stat-delta muted">Ingresos menos gastos</span>
          </div>

          <div className="dash-stat-card">
            <span className="dash-stat-label">Gasto de este mes</span>
            <span className="dash-stat-value">{money(gastoStats?.totalMesActual ?? 0)}</span>
            <span className={`dash-stat-delta ${variacion >= 0 ? "up" : "down"}`}>
              {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs mes anterior
            </span>
          </div>

          <div className="dash-stat-card">
            <span className="dash-stat-label">Clientes registrados</span>
            <span className="dash-stat-value">{totalClientes ?? "—"}</span>
            <span className="dash-stat-delta muted">
              {recurrentes[0] ? `Top: ${recurrentes[0].nombre}` : "Aún sin clientes"}
            </span>
          </div>

          <div className="dash-stat-card dash-stat-dark">
            <span className="dash-stat-label light">Próxima cita</span>
            {proximaCita ? (
              <>
                <span className="dash-stat-value light">{proximaCita.clienteNombre}</span>
                <span className="dash-stat-delta light">
                  {new Date(proximaCita.fecha).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                  })}{" "}
                  ·{" "}
                  {new Date(proximaCita.fecha).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </>
            ) : (
              <span className="dash-stat-value light" style={{ fontSize: 15 }}>
                No hay citas próximas
              </span>
            )}
          </div>
        </div>

        <div className="dash-columns">
          <section className="dash-card">
            <div className="dash-card-header">
              <h3>Próximas citas</h3>
              <Link to="/citas" className="dash-link">
                Ver calendario →
              </Link>
            </div>
            {proximasCitas.length === 0 ? (
              <p className="muted">No tienes citas programadas en los próximos 30 días.</p>
            ) : (
              <ul className="dash-list">
                {proximasCitas.map((c) => (
                  <li key={c._id} className="dash-list-item">
                    <div>
                      <span className="dash-list-title">{c.clienteNombre}</span>
                      <span className="dash-list-sub">
                        {new Date(c.fecha).toLocaleDateString("es-MX", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                        })}{" "}
                        ·{" "}
                        {new Date(c.fecha).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <span className="dash-list-amount">{money(c.precio)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-header">
              <h3>Clientes recurrentes</h3>
              <Link to="/clientes" className="dash-link">
                Ver todos →
              </Link>
            </div>
            {recurrentes.length === 0 ? (
              <p className="muted">Aún no hay clientes recurrentes.</p>
            ) : (
              <ul className="dash-list">
                {recurrentes.map((c) => (
                  <li key={c._id} className="dash-list-item">
                    <div>
                      <span className="dash-list-title">{c.nombre}</span>
                      <span className="dash-list-sub">{c.telefono}</span>
                    </div>
                    <span className="dash-tag">{c.totalCitas}x</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dash-card">
            <div className="dash-card-header">
              <h3>Equipo del estudio</h3>
            </div>
            {miembros.length === 0 ? (
              <p className="muted">No hay miembros registrados todavía.</p>
            ) : (
              <ul className="dash-list">
                {miembros.map((m) => (
                  <li key={m._id} className="dash-list-item">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="miembro-avatar">{iniciales(m.name)}</span>
                      <div>
                        <span className="dash-list-title">
                          {m.name}
                          {m._id === profile?._id && <span className="tu-tag"> (Tú)</span>}
                        </span>
                        <span className="dash-list-sub">{m.email}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {insumosBajos.length > 0 && (
            <section className="dash-card">
              <div className="dash-card-header">
                <h3>Insumos en stock bajo</h3>
                <Link to="/insumos" className="dash-link">
                  Ver inventario →
                </Link>
              </div>
              <ul className="dash-list">
                {insumosBajos.slice(0, 5).map((i) => (
                  <li key={i._id} className="dash-list-item">
                    <div>
                      <span className="dash-list-title">{i.nombre}</span>
                      <span className="dash-list-sub">
                        Mínimo: {i.cantidadMinima} {i.unidad}
                      </span>
                    </div>
                    <span className="dash-tag dash-tag-alert">
                      {i.cantidadActual} {i.unidad}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="dash-card">
            <div className="dash-card-header">
              <h3>¿Cuántos insumos gastaste hoy?</h3>
            </div>

            <form onSubmit={handleConsumo} className="consumo-form">
              {consumoError && <div className="alert">{consumoError}</div>}
              {consumoSuccess && <div className="alert alert-success">{consumoSuccess}</div>}

              <select
                value={consumoInsumoId}
                onChange={(e) => {
                  setConsumoInsumoId(e.target.value);
                  setConsumoSuccess("");
                }}
              >
                <option value="">Selecciona un insumo...</option>
                {todosInsumos.map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.nombre} ({i.cantidadActual} {i.unidad} disponibles)
                  </option>
                ))}
              </select>

              <div className="consumo-row">
                <input
                  type="number"
                  min={1}
                  placeholder="Cantidad"
                  value={consumoCantidad}
                  onChange={(e) => setConsumoCantidad(e.target.value)}
                />
                <button type="submit" className="btn primary" disabled={savingConsumo}>
                  {savingConsumo ? "..." : "Descontar"}
                </button>
              </div>
            </form>
          </section>

          <section className="dash-card postit-card">
            <div className="dash-card-header">
              <h3>📌 Notas rápidas</h3>
              <span className="postit-status">{notasGuardadas ? "Guardado" : "Guardando..."}</span>
            </div>
            <textarea
              className="postit-textarea"
              placeholder="Escribe pendientes, recordatorios, ideas..."
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
            />
          </section>
        </div>
      </main>

      {/* Modal: editar perfil */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Editar perfil</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="modal-form">
              {editError && <div className="alert">{editError}</div>}
              {editSuccess && <div className="alert alert-success">{editSuccess}</div>}

              <label>Nombre</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />

              <label>Correo</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />

              <div className="modal-divider">Cambiar contraseña (opcional)</div>

              <label>Contraseña actual</label>
              <input
                type="password"
                value={editForm.currentPassword}
                onChange={(e) => setEditForm({ ...editForm, currentPassword: e.target.value })}
                placeholder="Solo si vas a cambiarla"
              />

              <div className="form-row">
                <div>
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={editForm.newPassword}
                    onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  />
                </div>
                <div>
                  <label>Confirmar</label>
                  <input
                    type="password"
                    value={editForm.confirmPassword}
                    onChange={(e) => setEditForm({ ...editForm, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <button type="submit" className="btn primary full" disabled={savingProfile}>
                {savingProfile ? "Guardando..." : "Guardar cambios"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: cita rápida */}
      {showCitaModal && (
        <div className="modal-overlay" onClick={() => setShowCitaModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 Cita rápida</h3>
              <button className="modal-close" onClick={() => setShowCitaModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCita} className="modal-form">
              {citaError && <div className="alert">{citaError}</div>}

              <label>Nombre del cliente</label>
              <input
                type="text"
                value={citaForm.clienteNombre}
                onChange={(e) => setCitaForm({ ...citaForm, clienteNombre: e.target.value })}
                required
              />

              <label>Teléfono</label>
              <input
                type="tel"
                value={citaForm.clienteTelefono}
                onChange={(e) => setCitaForm({ ...citaForm, clienteTelefono: e.target.value })}
                required
              />

              <div className="form-row">
                <div>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={citaForm.fecha}
                    onChange={(e) => setCitaForm({ ...citaForm, fecha: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Hora</label>
                  <input
                    type="time"
                    value={citaForm.hora}
                    onChange={(e) => setCitaForm({ ...citaForm, hora: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label>Duración (min)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={citaForm.duracionMinutos}
                    onChange={(e) => setCitaForm({ ...citaForm, duracionMinutos: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Precio</label>
                  <input
                    type="number"
                    min={0}
                    value={citaForm.precio}
                    onChange={(e) => setCitaForm({ ...citaForm, precio: e.target.value })}
                    required
                  />
                </div>
              </div>

              <p className="modal-hint">
                Para más detalle (anticipo, notas, ver horarios ocupados), usa el módulo de Citas.
              </p>

              <button type="submit" className="btn primary full" disabled={savingCita}>
                {savingCita ? "Guardando..." : "Agendar cita"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: gasto de hoy */}
      {showGastoModal && (
        <div className="modal-overlay" onClick={() => setShowGastoModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💵 Gasto de hoy</h3>
              <button className="modal-close" onClick={() => setShowGastoModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateGasto} className="modal-form">
              {gastoError && <div className="alert">{gastoError}</div>}

              <label>Categoría</label>
              <select
                value={gastoForm.categoria}
                onChange={(e) => setGastoForm({ ...gastoForm, categoria: e.target.value as Categoria })}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <label>Descripción</label>
              <input
                type="text"
                value={gastoForm.descripcion}
                onChange={(e) => setGastoForm({ ...gastoForm, descripcion: e.target.value })}
                required
              />

              <label>Monto</label>
              <input
                type="number"
                min={0}
                value={gastoForm.monto}
                onChange={(e) => setGastoForm({ ...gastoForm, monto: e.target.value })}
                required
              />

              <p className="modal-hint">
                Se registra con la fecha de hoy. Para editar notas o fecha, usa el módulo de Gastos.
              </p>

              <button type="submit" className="btn primary full" disabled={savingGasto}>
                {savingGasto ? "Guardando..." : "Registrar gasto"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: ingreso de hoy */}
      {showIngresoModal && (
        <div className="modal-overlay" onClick={() => setShowIngresoModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💰 Ingreso de hoy</h3>
              <button className="modal-close" onClick={() => setShowIngresoModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIngreso} className="modal-form">
              {ingresoError && <div className="alert">{ingresoError}</div>}

              <label>Categoría</label>
              <select
                value={ingresoForm.categoria}
                onChange={(e) =>
                  setIngresoForm({ ...ingresoForm, categoria: e.target.value as CategoriaIngreso })
                }
              >
                {CATEGORIAS_INGRESO.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>

              <label>Descripción</label>
              <input
                type="text"
                value={ingresoForm.descripcion}
                onChange={(e) => setIngresoForm({ ...ingresoForm, descripcion: e.target.value })}
                required
              />

              <label>Monto</label>
              <input
                type="number"
                min={0}
                value={ingresoForm.monto}
                onChange={(e) => setIngresoForm({ ...ingresoForm, monto: e.target.value })}
                required
              />

              <p className="modal-hint">
                Se registra con la fecha de hoy. Si completas una cita desde el módulo de Citas,
                el ingreso se genera solo — no hace falta capturarlo aquí también.
              </p>

              <button type="submit" className="btn primary full" disabled={savingIngreso}>
                {savingIngreso ? "Guardando..." : "Registrar ingreso"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal: cliente nuevo */}
      {showClienteModal && (
        <div className="modal-overlay" onClick={() => setShowClienteModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>👤 Registrar cliente</h3>
              <button className="modal-close" onClick={() => setShowClienteModal(false)}>
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCliente} className="modal-form">
              {clienteError && <div className="alert">{clienteError}</div>}

              <label>Nombre</label>
              <input
                type="text"
                value={clienteForm.nombre}
                onChange={(e) => setClienteForm({ ...clienteForm, nombre: e.target.value })}
                required
              />

              <label>Teléfono</label>
              <input
                type="tel"
                value={clienteForm.telefono}
                onChange={(e) => setClienteForm({ ...clienteForm, telefono: e.target.value })}
                required
              />

              <label>Correo (opcional)</label>
              <input
                type="email"
                value={clienteForm.email}
                onChange={(e) => setClienteForm({ ...clienteForm, email: e.target.value })}
              />

              <p className="modal-hint">Este cliente quedará registrado aunque no tenga cita todavía.</p>

              <button type="submit" className="btn primary full" disabled={savingCliente}>
                {savingCliente ? "Guardando..." : "Registrar cliente"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}