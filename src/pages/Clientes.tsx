import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./Clientes.css";
import OfflineBanner from "../offline/OfflineBanner";

interface Cliente {
  _id: string;
  nombre: string;
  telefono: string;
  email: string;
  notas: string;
  totalCitas: number;
  createdAt: string;
  creadoPor?: { _id: string; name: string };
}

interface CitaHistorial {
  _id: string;
  fecha: string;
  precio: number;
  estado: "programada" | "completada" | "cancelada";
  notas: string;
  creadoPor?: { _id: string; name: string };
}

function money(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

export default function Clientes() {
  const nav = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const [selected, setSelected] = useState<Cliente | null>(null);
  const [historial, setHistorial] = useState<CitaHistorial[]>([]);
  const [loadingDetalle, setLoadingDetalle] = useState(false);

  useEffect(() => {
    loadClientes();
  }, []);

  async function loadClientes() {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/clientes");
      setClientes(res.data.clientes);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar los clientes");
    } finally {
      setLoading(false);
    }
  }

  async function openDetalle(c: Cliente) {
    setSelected(c);
    setLoadingDetalle(true);
    try {
      const res = await api.get(`/clientes/${c._id}`);
      setHistorial(res.data.citas);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar el historial");
    } finally {
      setLoadingDetalle(false);
    }
  }

  function closeDetalle() {
    setSelected(null);
    setHistorial([]);
  }

  const filteredClientes = useMemo(() => {
    if (!search.trim()) return clientes;
    const q = search.toLowerCase();
    return clientes.filter(
      (c) => c.nombre.toLowerCase().includes(q) || c.telefono.includes(q)
    );
  }, [clientes, search]);

  const stats = useMemo(() => {
    const total = clientes.length;
    const totalCitas = clientes.reduce((sum, c) => sum + c.totalCitas, 0);
    const masFrecuente = [...clientes].sort((a, b) => b.totalCitas - a.totalCitas)[0];
    const promedio = total > 0 ? totalCitas / total : 0;
    return { total, masFrecuente, promedio };
  }, [clientes]);

  return (
    <div className="clientes-page">
      <OfflineBanner />
      <header className="clientes-header">
        <button className="back-link" onClick={() => nav("/dashboard")}>
          ← Panel
        </button>
        <div className="brand-mini">BLACK LINE STUDIO — CLIENTES</div>
      </header>

      <div className="clientes-body">
        <main className="clientes-main">
          {error && <div className="alert">{error}</div>}

          <div className="summary-row">
            <div className="summary-card">
              <span className="summary-label">Clientes registrados</span>
              <span className="summary-value">{stats.total}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Cliente más frecuente</span>
              <span className="summary-value summary-value-sm">
                {stats.masFrecuente?.nombre ?? "—"}
              </span>
              <span className="summary-delta muted">
                {stats.masFrecuente ? `${stats.masFrecuente.totalCitas} citas` : ""}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Promedio de citas por cliente</span>
              <span className="summary-value">{stats.promedio.toFixed(1)}</span>
            </div>
          </div>

          <section className="card">
            <div className="table-header">
              <h3>Todos los clientes</h3>
              <div className="table-filters">
                <input
                  type="text"
                  placeholder="Buscar por nombre o teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <p className="muted">Cargando...</p>
            ) : filteredClientes.length === 0 ? (
              <p className="muted">No hay clientes que coincidan.</p>
            ) : (
              <table className="clientes-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Teléfono</th>
                    <th>Citas</th>
                    <th>Registrado por</th>
                    <th>Cliente desde</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClientes.map((c) => (
                    <tr key={c._id} onClick={() => openDetalle(c)}>
                      <td>{c.nombre}</td>
                      <td>{c.telefono}</td>
                      <td>
                        <span className="tag" style={{ background: "#4f8fdd22", color: "#4f8fdd" }}>
                          {c.totalCitas} {c.totalCitas === 1 ? "cita" : "citas"}
                        </span>
                      </td>
                      <td className="muted" style={{ fontSize: 12.5 }}>
                        {c.creadoPor?.name || "—"}
                      </td>
                      <td>{new Date(c.createdAt).toLocaleDateString("es-MX")}</td>
                      <td className="row-action">→</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <aside className="clientes-sidebar">
          {!selected && (
            <div className="sidebar-legend">
              <h4>Sobre este panel</h4>
              <p className="muted" style={{ fontSize: 13.5 }}>
                Los clientes se registran automáticamente cuando agendas una
                cita nueva. Selecciona uno de la tabla para ver su historial
                completo.
              </p>
            </div>
          )}

          {selected && (
            <div className="sidebar-section">
              <button type="button" className="back-link small" onClick={closeDetalle}>
                ← Cerrar
              </button>
              <h3>{selected.nombre}</h3>
              <p className="muted" style={{ marginTop: -8 }}>{selected.telefono}</p>
              {selected.creadoPor && (
                <p className="muted" style={{ marginTop: -6, fontSize: 12 }}>
                  Registrado por {selected.creadoPor.name}
                </p>
              )}

              {loadingDetalle ? (
                <p className="muted">Cargando historial...</p>
              ) : historial.length === 0 ? (
                <p className="muted">Sin citas registradas todavía.</p>
              ) : (
                <div className="historial-list">
                  {historial.map((cita) => (
                    <div className="historial-item" key={cita._id}>
                      <div className="historial-item-top">
                        <span>{new Date(cita.fecha).toLocaleDateString("es-MX")}</span>
                        <span className={`estado-tag estado-${cita.estado}`}>
                          {cita.estado}
                        </span>
                      </div>
                      <div className="historial-item-bottom">
                        <span className="amount">{money(cita.precio)}</span>
                        {cita.creadoPor && (
                          <span className="historial-tatuador">{cita.creadoPor.name}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}