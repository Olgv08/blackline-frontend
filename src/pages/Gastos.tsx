import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./Gastos.css";

interface Gasto {
  _id: string;
  categoria: Categoria;
  descripcion: string;
  monto: number;
  fecha: string;
  notas: string;
}

type Categoria = "insumos" | "servicios" | "marketing" | "renta" | "nomina" | "otros";

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

const CATEGORIAS: { value: Categoria; label: string; color: string }[] = [
  { value: "insumos", label: "Insumos", color: "#4f8fdd" },
  { value: "servicios", label: "Servicios", color: "#9b7fd4" },
  { value: "marketing", label: "Marketing", color: "#e0a458" },
  { value: "renta", label: "Renta", color: "#4fb8a8" },
  { value: "nomina", label: "Nómina", color: "#d98b86" },
  { value: "otros", label: "Otros", color: "#b3b0aa" },
];

function categoriaInfo(cat: string) {
  return CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[CATEGORIAS.length - 1];
}

function money(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

const emptyForm = {
  categoria: "insumos" as Categoria,
  descripcion: "",
  monto: "",
  fecha: new Date().toISOString().slice(0, 10),
  notas: "",
};

type SidebarMode = "idle" | "create" | "edit";

export default function Gastos() {
  const nav = useNavigate();

  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "todas">("todas");
  const [search, setSearch] = useState("");

  const [mode, setMode] = useState<SidebarMode>("idle");
  const [selected, setSelected] = useState<Gasto | null>(null);
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

      const [gastosRes, statsRes] = await Promise.all([
        api.get(`/gastos?from=${desde.toISOString()}`),
        api.get(`/gastos/stats/resumen?meses=6`),
      ]);
      setGastos(gastosRes.data.gastos);
      setStats(statsRes.data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar los gastos");
    } finally {
      setLoading(false);
    }
  }

  const filteredGastos = useMemo(() => {
    let list = gastos;
    if (filtroCategoria !== "todas") {
      list = list.filter((g) => g.categoria === filtroCategoria);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.descripcion.toLowerCase().includes(q));
    }
    return list;
  }, [gastos, filtroCategoria, search]);

  const maxTendencia = useMemo(() => {
    if (!stats) return 1;
    return Math.max(1, ...stats.tendencia.map((t) => t.total));
  }, [stats]);

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

  function openEdit(g: Gasto) {
    setSelected(g);
    setForm({
      categoria: g.categoria,
      descripcion: g.descripcion,
      monto: String(g.monto),
      fecha: g.fecha.slice(0, 10),
      notas: g.notas || "",
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
        fecha: new Date(form.fecha).toISOString(),
        notas: form.notas,
      };
      if (mode === "edit" && selected) {
        await api.put(`/gastos/${selected._id}`, payload);
      } else {
        await api.post("/gastos", payload);
      }
      await loadAll();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al guardar el gasto");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/gastos/${id}`);
      await loadAll();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar el gasto");
    }
  }

  const variacion = stats?.variacionPorcentual ?? 0;

  return (
    <div className="gastos-page">
      <header className="gastos-header">
        <button className="back-link" onClick={() => nav("/dashboard")}>
          ← Panel
        </button>
        <div className="brand-mini">BLACK LINE STUDIO — GASTOS</div>
      </header>

      <div className="gastos-body">
        <main className="gastos-main">
          {error && <div className="alert">{error}</div>}

          <div className="summary-row">
            <div className="summary-card">
              <span className="summary-label">Gasto de este mes</span>
              <span className="summary-value">{money(stats?.totalMesActual ?? 0)}</span>
              <span className={`summary-delta ${variacion >= 0 ? "up" : "down"}`}>
                {variacion >= 0 ? "▲" : "▼"} {Math.abs(variacion).toFixed(1)}% vs mes anterior
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Mes anterior</span>
              <span className="summary-value">{money(stats?.totalMesAnterior ?? 0)}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Categoría con más gasto</span>
              <span className="summary-value summary-value-sm">
                {categoriasMesActual[0]?.label ?? "—"}
              </span>
              <span className="summary-delta muted">
                {categoriasMesActual[0] ? money(categoriasMesActual[0].monto) : ""}
              </span>
            </div>
          </div>

          <section className="card">
            <h3>Tendencia de gastos (últimos 6 meses)</h3>
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
              <p className="muted">Sin gastos registrados este mes.</p>
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
            <div className="table-header">
              <h3>Transacciones</h3>
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
            ) : filteredGastos.length === 0 ? (
              <p className="muted">No hay gastos que coincidan.</p>
            ) : (
              <table className="gastos-table">
                <thead>
                  <tr>
                    <th>Categoría</th>
                    <th>Descripción</th>
                    <th>Fecha</th>
                    <th>Monto</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGastos.map((g) => {
                    const info = categoriaInfo(g.categoria);
                    return (
                      <tr key={g._id} onClick={() => openEdit(g)}>
                        <td>
                          <span className="tag" style={{ background: `${info.color}22`, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td>{g.descripcion}</td>
                        <td>{new Date(g.fecha).toLocaleDateString("es-MX")}</td>
                        <td className="amount">{money(g.monto)}</td>
                        <td className="row-action">→</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <aside className="gastos-sidebar">
          {mode === "idle" && (
            <>
              <button className="btn primary full" onClick={openCreate}>
                + Nuevo gasto
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
            </>
          )}

          {(mode === "create" || mode === "edit") && (
            <form className="sidebar-section" onSubmit={handleSubmit}>
              <button type="button" className="back-link small" onClick={closeSidebar}>
                ← Cancelar
              </button>
              <h3>{mode === "edit" ? "Editar gasto" : "Nuevo gasto"}</h3>

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

              <label>Notas</label>
              <textarea
                rows={3}
                value={form.notas}
                onChange={(e) => setForm({ ...form, notas: e.target.value })}
              />

              <button type="submit" className="btn primary full" disabled={saving}>
                {saving ? "Guardando..." : "Guardar gasto"}
              </button>

              {mode === "edit" && selected && (
                <button
                  type="button"
                  className="btn small danger full"
                  onClick={() => handleDelete(selected._id)}
                >
                  Eliminar gasto
                </button>
              )}
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}