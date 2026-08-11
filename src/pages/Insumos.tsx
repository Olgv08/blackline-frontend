import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "./Insumos.css";

type Categoria = "tintas" | "agujas" | "guantes" | "limpieza" | "consumibles" | "otros";
type Unidad = "unidades" | "ml" | "g" | "cajas" | "pares" | "rollos";

interface Insumo {
  _id: string;
  nombre: string;
  categoria: Categoria;
  unidad: Unidad;
  cantidadActual: number;
  cantidadMinima: number;
  notas: string;
}

const CATEGORIAS: { value: Categoria; label: string; color: string }[] = [
  { value: "tintas", label: "Tintas", color: "#9b7fd4" },
  { value: "agujas", label: "Agujas", color: "#4f8fdd" },
  { value: "guantes", label: "Guantes", color: "#4fb8a8" },
  { value: "limpieza", label: "Limpieza", color: "#e0a458" },
  { value: "consumibles", label: "Consumibles", color: "#d98b86" },
  { value: "otros", label: "Otros", color: "#b3b0aa" },
];

const UNIDADES: Unidad[] = ["unidades", "ml", "g", "cajas", "pares", "rollos"];

function categoriaInfo(cat: string) {
  return CATEGORIAS.find((c) => c.value === cat) || CATEGORIAS[CATEGORIAS.length - 1];
}

function money(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

const emptyForm = {
  nombre: "",
  categoria: "otros" as Categoria,
  unidad: "unidades" as Unidad,
  cantidadActual: "",
  cantidadMinima: "",
  notas: "",
};

const emptyRestockForm = {
  cantidad: "",
  costoTotal: "",
  notas: "",
};

type SidebarMode = "idle" | "create" | "edit" | "restock";

export default function Insumos() {
  const nav = useNavigate();

  const [insumos, setInsumos] = useState<Insumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filtroCategoria, setFiltroCategoria] = useState<Categoria | "todas">("todas");
  const [soloStockBajo, setSoloStockBajo] = useState(false);
  const [search, setSearch] = useState("");

  const [mode, setMode] = useState<SidebarMode>("idle");
  const [selected, setSelected] = useState<Insumo | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [restockForm, setRestockForm] = useState(emptyRestockForm);

  useEffect(() => {
    loadInsumos();
  }, []);

  async function loadInsumos() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/insumos");
      setInsumos(data.insumos);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar los insumos");
    } finally {
      setLoading(false);
    }
  }

  const filteredInsumos = useMemo(() => {
    let list = insumos;
    if (filtroCategoria !== "todas") {
      list = list.filter((i) => i.categoria === filtroCategoria);
    }
    if (soloStockBajo) {
      list = list.filter((i) => i.cantidadActual <= i.cantidadMinima);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.nombre.toLowerCase().includes(q));
    }
    return list;
  }, [insumos, filtroCategoria, soloStockBajo, search]);

  const stats = useMemo(() => {
    const total = insumos.length;
    const stockBajo = insumos.filter((i) => i.cantidadActual <= i.cantidadMinima).length;
    const categoriasActivas = new Set(insumos.map((i) => i.categoria)).size;
    return { total, stockBajo, categoriasActivas };
  }, [insumos]);

  function openCreate() {
    setForm(emptyForm);
    setSelected(null);
    setMode("create");
  }

  function openEdit(i: Insumo) {
    setSelected(i);
    setForm({
      nombre: i.nombre,
      categoria: i.categoria,
      unidad: i.unidad,
      cantidadActual: String(i.cantidadActual),
      cantidadMinima: String(i.cantidadMinima),
      notas: i.notas || "",
    });
    setMode("edit");
  }

  function openRestock(i: Insumo) {
    setSelected(i);
    setRestockForm(emptyRestockForm);
    setMode("restock");
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
        nombre: form.nombre,
        categoria: form.categoria,
        unidad: form.unidad,
        cantidadActual: Number(form.cantidadActual) || 0,
        cantidadMinima: Number(form.cantidadMinima) || 0,
        notas: form.notas,
      };
      if (mode === "edit" && selected) {
        await api.put(`/insumos/${selected._id}`, payload);
      } else {
        await api.post("/insumos", payload);
      }
      await loadInsumos();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al guardar el insumo");
    } finally {
      setSaving(false);
    }
  }

  async function handleRestock(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/insumos/${selected._id}/restock`, {
        cantidad: Number(restockForm.cantidad),
        costoTotal: Number(restockForm.costoTotal),
        notas: restockForm.notas,
      });
      await loadInsumos();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al registrar el restock");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este insumo? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/insumos/${id}`);
      await loadInsumos();
      closeSidebar();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar el insumo");
    }
  }

  return (
    <div className="insumos-page">
      <header className="insumos-header">
        <button className="back-link" onClick={() => nav("/dashboard")}>
          ← Panel
        </button>
        <div className="brand-mini">BLACK LINE STUDIO — INSUMOS</div>
      </header>

      <div className="insumos-body">
        <main className="insumos-main">
          {error && <div className="alert">{error}</div>}

          <div className="summary-row">
            <div className="summary-card">
              <span className="summary-label">Insumos registrados</span>
              <span className="summary-value">{stats.total}</span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Alertas de stock bajo</span>
              <span className={`summary-value ${stats.stockBajo > 0 ? "summary-value-alert" : ""}`}>
                {stats.stockBajo}
              </span>
              <span className="summary-delta muted">
                {stats.stockBajo > 0 ? "Necesitan restock pronto" : "Todo en orden"}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-label">Categorías activas</span>
              <span className="summary-value">{stats.categoriasActivas}</span>
            </div>
          </div>

          <section className="card">
            <div className="table-header">
              <h3>Inventario</h3>
              <div className="table-filters">
                <input
                  type="text"
                  placeholder="Buscar insumo..."
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
                <label className="checkbox-filter">
                  <input
                    type="checkbox"
                    checked={soloStockBajo}
                    onChange={(e) => setSoloStockBajo(e.target.checked)}
                  />
                  Solo stock bajo
                </label>
              </div>
            </div>

            {loading ? (
              <p className="muted">Cargando...</p>
            ) : filteredInsumos.length === 0 ? (
              <p className="muted">No hay insumos que coincidan.</p>
            ) : (
              <table className="insumos-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th>Stock actual</th>
                    <th>Mínimo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInsumos.map((i) => {
                    const info = categoriaInfo(i.categoria);
                    const bajo = i.cantidadActual <= i.cantidadMinima;
                    return (
                      <tr key={i._id} onClick={() => openEdit(i)}>
                        <td>{i.nombre}</td>
                        <td>
                          <span className="tag" style={{ background: `${info.color}22`, color: info.color }}>
                            {info.label}
                          </span>
                        </td>
                        <td className={bajo ? "stock-bajo" : ""}>
                          {i.cantidadActual} {i.unidad}
                          {bajo && <span className="stock-alert-dot" title="Stock bajo" />}
                        </td>
                        <td>{i.cantidadMinima} {i.unidad}</td>
                        <td className="row-action">
                          <button
                            className="btn small restock-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRestock(i);
                            }}
                          >
                            + Restock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </main>

        <aside className="insumos-sidebar">
          {mode === "idle" && (
            <>
              <button className="btn primary full" onClick={openCreate}>
                + Nuevo insumo
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
              <h3>{mode === "edit" ? "Editar insumo" : "Nuevo insumo"}</h3>

              <label>Nombre</label>
              <input
                type="text"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />

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

              <label>Unidad de medida</label>
              <select
                value={form.unidad}
                onChange={(e) => setForm({ ...form, unidad: e.target.value as Unidad })}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>

              <div className="form-row">
                <div>
                  <label>Cantidad actual</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidadActual}
                    onChange={(e) => setForm({ ...form, cantidadActual: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Cantidad mínima</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cantidadMinima}
                    onChange={(e) => setForm({ ...form, cantidadMinima: e.target.value })}
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
                {saving ? "Guardando..." : "Guardar insumo"}
              </button>

              {mode === "edit" && selected && (
                <button
                  type="button"
                  className="btn small danger full"
                  onClick={() => handleDelete(selected._id)}
                >
                  Eliminar insumo
                </button>
              )}
            </form>
          )}

          {mode === "restock" && selected && (
            <form className="sidebar-section" onSubmit={handleRestock}>
              <button type="button" className="back-link small" onClick={closeSidebar}>
                ← Cancelar
              </button>
              <h3>Restock: {selected.nombre}</h3>
              <p className="muted" style={{ marginTop: -8, fontSize: 13 }}>
                Stock actual: {selected.cantidadActual} {selected.unidad}
              </p>

              <label>Cantidad a agregar ({selected.unidad})</label>
              <input
                type="number"
                min={1}
                value={restockForm.cantidad}
                onChange={(e) => setRestockForm({ ...restockForm, cantidad: e.target.value })}
                required
              />

              <label>Costo total de la compra</label>
              <input
                type="number"
                min={0}
                value={restockForm.costoTotal}
                onChange={(e) => setRestockForm({ ...restockForm, costoTotal: e.target.value })}
                required
              />

              <label>Notas (opcional)</label>
              <textarea
                rows={2}
                value={restockForm.notas}
                onChange={(e) => setRestockForm({ ...restockForm, notas: e.target.value })}
              />

              <p className="modal-hint">
                Esto sumará el stock y creará automáticamente un Gasto en la categoría "Insumos".
              </p>

              <button type="submit" className="btn primary full" disabled={saving}>
                {saving ? "Guardando..." : "Registrar restock"}
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}