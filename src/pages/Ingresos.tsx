import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./Ingresos.css";
import OfflineBanner from "../offline/OfflineBanner";

interface Ingreso {
  _id: string;
  categoria: Categoria;
  descripcion: string;
  monto: number;
  metodoPago: MetodoPago;
  cliente?: { _id: string; nombre: string } | null;
  fecha: string;
  notas: string;
}

type Categoria = "tatuaje" | "piercing" | "producto" | "propina" | "otros";
type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

interface TendenciaMes {
  anio: number;
  mes: number;
  label: string;
  total: number;
}

interface Stats {
  totalMesActual: number;
  totalMesAnterior: number;
  variacionPorcentual: number;
  tendencia: TendenciaMes[];
  porCategoriaMesActual: Record<string, number>;
}

interface TendenciaBalanceMes {
  anio: number;
  mes: number;
  label: string;
  ingresos: number;
  gastos: number;
  balance: number;
}

interface Movimiento {
  id: string;
  tipo: "ingreso" | "gasto";
  categoria: string;
  descripcion: string;
  monto: number;
  fecha: string;
}

interface Balance {
  totalIngresosMesActual: number;
  totalGastosMesActual: number;
  balanceMesActual: number;
  balanceMesAnterior: number;
  variacionPorcentual: number;
  saldoAcumulado: number;
  tendencia: TendenciaBalanceMes[];
  movimientos: Movimiento[];
}

const CATEGORIAS: { value: Categoria; label: string; color: string }[] = [
  { value: "tatuaje", label: "Tatuaje", color: "#4f8fdd" },
  { value: "piercing", label: "Piercing", color: "#9b7fd4" },
  { value: "producto", label: "Producto", color: "#e0a458" },
  { value: "propina", label: "Propina", color: "#4fb8a8" },
  { value: "otros", label: "Otros", color: "#b3b0aa" },
];

const METODOS_PAGO: { value: MetodoPago; label: string }[] = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

function categoriaInfo(cat: string) {
  return CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[CATEGORIAS.length - 1];
}

function gastoCategoriaLabel(cat: string) {
  const map: Record<string, string> = {
    insumos: "Insumos",
    servicios: "Servicios",
    marketing: "Marketing",
    renta: "Renta",
    nomina: "Nómina",
    otros: "Otros",
  };
  return map[cat] || "Gasto";
}

function money(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

const emptyForm = {
  categoria: "tatuaje" as Categoria,
  descripcion: "",
  monto: "",
  metodoPago: "efectivo" as MetodoPago,
  fecha: new Date().toISOString().slice(0, 10),
  notas: "",
};

type SidebarMode = "idle" | "create" | "edit";

export default function Ingresos() {
  const nav = useNavigate();

  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "todas">("todas");
  const [search, setSearch] = useState("");

  const [mode, setMode] = useState<SidebarMode>("idle");
  const [selected, setSelected] = useState<Ingreso | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const desde = new Date();
      desde.setMonth(desde.getMonth() - 5);
      desde.setDate(1);

      const [ingresosRes, statsRes, balanceRes] = await Promise.all([
        api.get(`/ingresos?from=${desde.toISOString()}`),
        api.get(`/ingresos/stats/resumen?meses=6`),
        api.get(`/balance/resumen?meses=6&limit=12`),
      ]);
      setIngresos(ingresosRes.data.ingresos);
      setStats(statsRes.data);
      setBalance(balanceRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar los ingresos");
    } finally {
      setLoading(false);
    }
  }

  const filteredIngresos = useMemo(() => {
    let list = ingresos;
    if (filtroCategoria !== "todas") {
      list = list.filter((i) => i.categoria === filtroCategoria);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.descripcion.toLowerCase().includes(q));
    }
    return list;
  }, [ingresos, filtroCategoria, search]);

  const maxTendencia = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.tendencia.map((t) => t.total));
  }, [stats]);

  const maxBalanceTendencia = useMemo(() => {
    if (!balance) return 1;
    return Math.max(1, ...balance.tendencia.flatMap((t) => [t.ingresos, t.gastos]));
  }, [balance]);

  const categoriasMesActual = useMemo(() => {
    if (!stats) return [];
    const total = Object.values(stats.porCategoriaMesActual).reduce((a, b) => a + b, 0);
    return Object.entries(stats.porCategoriaMesActual)
      .map(([cat, monto]) => ({
        ...categoriaInfo(cat),
        monto,
        pct: total > 0 ? (monto / total) * 100 : 0,
      }))
      .sort((a, b) => b.monto - a.monto);
  }, [stats]);

  function openCreate() {
    setForm(emptyForm);
    setSelected(null);
    setMode("create");
  }

  function openEdit(i: Ingreso) {
    setSelected(i);
    setForm({
      categoria: i.categoria,
      descripcion: i.descripcion,
      monto: String(i.monto),
      metodoPago: i.metodoPago || "efectivo",
      fecha: i.fecha.slice(0, 10),
      notas: i.notas || "",
    });
    setMode("edit");
  }

  function closeSidebar() {
    setMode("idle");
    setSelected(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        categoria: form.categoria,
        descripcion: form.descripcion,
        monto: Number(form.monto),
        metodoPago: form.metodoPago,
        fecha: new Date(form.fecha).toISOString(),
        notas: form.notas,
      };
      if (mode === "edit" && selected) {
        await api.put(`/ingresos/${selected._id}`, payload);
      } else {
        await api.post("/ingresos", payload);
      }
      await loadAll();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al guardar el ingreso");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este ingreso? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/ingresos/${id}`);
      await loadAll();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar el ingreso");
    }
  }

  const variacion = stats?.variacionPorcentual ?? 0;
  const variacionBalance = balance?.variacionPorcentual ?? 0;
  const balanceNegativo = (balance?.balanceMesActual ?? 0) < 0;

  return (
    <div className="ingresos-page">
      <OfflineBanner />
      <header className="ingresos-header">
        <button className="back-link" onClick={() => nav("/dashboard")}>
          ← Panel
        </button>
        <div className="brand-mini">BLACK LINE STUDIO — INGRESOS Y BALANCE</div>
      </header>

      <div className="ingresos-body">
        <main className="ingresos-main">
          {error && <div className="alert">{error}</div>}

          <section className="balance-hero">
            <div className="balance-hero-main">
              <span className="balance-hero-label">Saldo acumulado del estudio</span>
              <span className={`balance-hero-value ${balance && balance.saldoAcumulado < 0 ? "neg" : ""}`}>
                {money(balance?.saldoAcumulado ?? 0)}
              </span>
              <span className="balance-hero-sub">
                Ingresos menos gastos desde que arrancó el estudio
              </span>
            </div>
            <div className="balance-hero-split">
              <div className="balance-hero-chip up">
                <span>Ingresos del mes</span>
                <strong>{money(balance?.totalIngresosMesActual ?? 0)}</strong>
              </div>
              <div className="balance-hero-chip down">
                <span>Gastos del mes</span>
                <strong>{money(balance?.totalGastosMesActual ?? 0)}</strong>
              </div>
              <div className={`balance-hero-chip ${balanceNegativo ? "down" : "up"} balance-chip`}>
                <span>Balance del mes</span>
                <strong>{money(balance?.balanceMesActual ?? 0)}</strong>
                <em>
                  {variacionBalance >= 0 ? "▲" : "▼"} {Math.abs(variacionBalance).toFixed(1)}% vs mes
                  anterior
                </em>
              </div>
            </div>
          </section>

          <div className="summary-row">
            <div className="summary-card">
              <span className="summary-label">Ingreso de este mes</span>
              <span className="summary-value">{money(stats?.totalMesActual ?? 0)}</span>
              <span className={`summary-delta ${variacion >= 0 ? "down" : "up"}`}>
                {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs mes anterior
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Mes anterior</span>
              <span className="summary-value">{money(stats?.totalMesAnterior ?? 0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Categoría con más ingresos</span>
              <span className="summary-value summary-value-sm">
                {categoriasMesActual[0]?.label ?? "—"}
              </span>
              <span className="summary-delta muted">
                {categoriasMesActual[0] ? money(categoriasMesActual[0].monto) : ""}
              </span>
            </div>
          </div>

          <section className="card">
            <h3>Ingresos vs. gastos (últimos 6 meses)</h3>
            {balance && (
              <>
                <div className="trend-chart-dual">
                  {balance.tendencia.map((t) => (
                    <div className="trend-col" key={`${t.anio}-${t.mes}`}>
                      <div className="trend-bar-track dual">
                        <div
                          className="trend-bar ingreso"
                          style={{ height: `${(t.ingresos / maxBalanceTendencia) * 100}%` }}
                          title={`Ingresos: ${money(t.ingresos)}`}
                        />
                        <div
                          className="trend-bar gasto"
                          style={{ height: `${(t.gastos / maxBalanceTendencia) * 100}%` }}
                          title={`Gastos: ${money(t.gastos)}`}
                        />
                      </div>
                      <span className="trend-label">{t.label}</span>
                    </div>
                  ))}
                </div>
                <div className="trend-legend">
                  <span><i className="dot ingreso" /> Ingresos</span>
                  <span><i className="dot gasto" /> Gastos</span>
                </div>
              </>
            )}
          </section>

          <section className="card">
            <h3>Tendencia de ingresos (últimos 6 meses)</h3>
            {stats && (
              <div className="trend-chart">
                {stats.tendencia.map((t) => (
                  <div className="trend-col" key={`${t.anio}-${t.mes}`}>
                    <div className="trend-bar-track">
                      <div
                        className="trend-bar"
                        style={{ height: `${(t.total / maxTendencia) * 100}%` }}
                        title={money(t.total)}
                      />
                    </div>
                    <span className="trend-label">{t.label}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Desglose por categoría (este mes)</h3>
            {categoriasMesActual.length === 0 ? (
              <p className="muted">Sin ingresos registrados este mes.</p>
            ) : (
              <div className="cat-breakdown">
                {categoriasMesActual.map((c) => (
                  <div className="cat-row" key={c.value}>
                    <span className="cat-dot" style={{ background: c.color }} />
                    <span className="cat-name">{c.label}</span>
                    <div className="cat-bar-track">
                      <div
                        className="cat-bar"
                        style={{ width: `${c.pct}%`, background: c.color }}
                      />
                    </div>
                    <span className="cat-amount">{money(c.monto)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h3>Movimientos recientes</h3>
            <p className="muted movimientos-hint">
              Aquí se juntan ingresos y gastos —incluyendo las compras de insumos que se
              restockean desde Inventario— para que se vea el efecto real en el balance.
            </p>
            {!balance || balance.movimientos.length === 0 ? (
              <p className="muted">Aún no hay movimientos registrados.</p>
            ) : (
              <ul className="movimientos-list">
                {balance.movimientos.map((m) => (
                  <li key={`${m.tipo}-${m.id}`} className={`movimiento-row ${m.tipo}`}>
                    <span className={`movimiento-icon ${m.tipo}`}>
                      {m.tipo === "ingreso" ? "↑" : "↓"}
                    </span>
                    <div className="movimiento-info">
                      <span className="movimiento-desc">{m.descripcion}</span>
                      <span className="movimiento-meta">
                        {m.tipo === "ingreso" ? categoriaInfo(m.categoria).label : gastoCategoriaLabel(m.categoria)}
                        {" · "}
                        {new Date(m.fecha).toLocaleDateString("es-MX")}
                      </span>
                    </div>
                    <span className={`movimiento-monto ${m.tipo}`}>
                      {m.tipo === "ingreso" ? "+" : "−"}
                      {money(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <div className="table-header">
              <h3>Transacciones de ingresos</h3>
              <div className="table-filters">
                <input
                  type="text"
                  placeholder="Buscar descripción..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  value={filtroCategoria}
                  onChange={(e) => setFiltroCategoria(e.target.value as Categoria | "todas")}
                >
                  <option value="todas">Todas las categorías</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <p className="muted">Cargando...</p>
            ) : filteredIngresos.length === 0 ? (
              <p className="muted">No hay ingresos que coincidan.</p>
            ) : (
              <table className="ingresos-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Método</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIngresos.map((i) => {
                    const info = categoriaInfo(i.categoria);
                    return (
                      <tr key={i._id} onClick={() => openEdit(i)}>
                        <td>
                          <span className="tag" style={{ background: `${info.color}22`, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td>{i.descripcion}</td>
                        <td className="muted">
                          {METODOS_PAGO.find((m) => m.value === i.metodoPago)?.label ?? "Efectivo"}
                        </td>
                        <td>{new Date(i.fecha).toLocaleDateString("es-MX")}</td>
                        <td className="amount">{money(i.monto)}</td>
                        <td className="row-action">→</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <aside className="ingresos-sidebar">
          {mode === "idle" && (
            <>
              <button className="btn primary full" onClick={openCreate}>
                + Nuevo ingreso
              </button>
              <div className="sidebar-legend">
                <h4>Categorías</h4>
                <ul>
                  {CATEGORIAS.map((c) => (
                    <li key={c.value}>
                      <span className="cat-dot" style={{ background: c.color }} />
                      {c.label}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="sidebar-note">
                <h4>💡 Tip</h4>
                <p>
                  Al marcar una cita como <strong>completada</strong> en el módulo de Citas, el
                  ingreso se registra solo aquí. No hace falta capturarlo dos veces.
                </p>
              </div>
            </>
          )}

          {(mode === "create" || mode === "edit") && (
            <form className="sidebar-section" onSubmit={handleSubmit}>
              <button type="button" className="back-link small" onClick={closeSidebar}>
                ← Cancelar
              </button>
              <h3>{mode === "edit" ? "Editar ingreso" : "Nuevo ingreso"}</h3>

              <label>Categoría</label>
              <select
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value as Categoria })}
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
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                required
              />

              <div className="form-row">
                <div>
                  <label>Monto</label>
                  <input
                    type="number"
                    min={0}
                    value={form.monto}
                    onChange={(e) => setForm({ ...form, monto: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Fecha</label>
                  <input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                    required
                  />
                </div>
              </div>

              <label>Método de pago</label>
              <select
                value={form.metodoPago}
                onChange={(e) => setForm({ ...form, metodoPago: e.target.value as MetodoPago })}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>

              <label>Notas</label>
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />

              <button type="submit" className="btn primary full" disabled={saving}>
                {saving ? "Guardando..." : "Guardar ingreso"}
              </button>

              {mode === "edit" && selected && (
                <button
                  type="button"
                  className="btn small danger full"
                  onClick={() => handleDelete(selected._id)}
                >
                  Eliminar ingreso
                </button>
              )}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
