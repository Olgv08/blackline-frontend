import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { es } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "./Citas.css";
import OfflineBanner from "../offline/OfflineBanner";

const locales = { es };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es }),
  getDay,
  locales,
});

interface Cita {
  _id: string;
  clienteNombre: string;
  clienteTelefono: string;
  fecha: string;
  duracionMinutos: number;
  precio: number;
  anticipo: number;
  notas: string;
  estado: "programada" | "completada" | "cancelada";
  creadoPor?: { _id: string; name: string };
}

interface ClienteRecurrente {
  _id: string;
  nombre: string;
  telefono: string;
  totalCitas: number;
}

type SidebarMode = "list" | "detail" | "create";

const emptyForm = {
  clienteNombre: "",
  clienteTelefono: "",
  fecha: "",
  hora: "",
  duracionMinutos: "120",
  precio: "",
  anticipo: "0",
  notas: "",
};

// Horario de operación del estudio para armar la cuadrícula de horas
const HORA_INICIO = 10; // 10:00
const HORA_FIN = 20; // 20:00
const PASO_MINUTOS = 30;

function generarSlots() {
  const slots: string[] = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    for (let m = 0; m < 60; m += PASO_MINUTOS) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}
const TIME_SLOTS = generarSlots();

export default function Citas() {
  const nav = useNavigate();

  const [citas, setCitas] = useState<Cita[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [recurrentes, setRecurrentes] = useState<ClienteRecurrente[]>([]);

  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(new Date());

  const [mode, setMode] = useState<SidebarMode>("list");
  const [selected, setSelected] = useState<Cita | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    loadCitas();
  }, [date, view]);

  useEffect(() => {
    loadRecurrentes();
  }, []);

  async function loadCitas() {
    setLoading(true);
    setError("");
    try {
      const from = startOfMonth(date).toISOString();
      const to = endOfMonth(date).toISOString();
      const { data } = await api.get(`/citas?from=${from}&to=${to}`);
      setCitas(data.citas);
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al cargar las citas");
    } finally {
      setLoading(false);
    }
  }

  async function loadRecurrentes() {
    try {
      const { data } = await api.get("/clientes/recurrentes?limit=5");
      setRecurrentes(data.clientes);
    } catch {
      // silencioso — no es crítico para la vista de citas
    }
  }

  function startOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() - 1, 1);
  }
  function endOfMonth(d: Date) {
    return new Date(d.getFullYear(), d.getMonth() + 2, 0);
  }

  const events = useMemo(
    () =>
      citas.map((c) => {
        const start = new Date(c.fecha);
        const end = new Date(start.getTime() + c.duracionMinutos * 60000);
        return {
          id: c._id,
          title: c.clienteNombre,
          start,
          end,
          resource: c,
        };
      }),
    [citas]
  );

  const todayCitas = useMemo(() => {
    const today = new Date();
    return citas
      .filter((c) => sameDay(new Date(c.fecha), today))
      .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
  }, [citas]);

  const filteredCitas = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return citas.filter(
      (c) =>
        c.clienteNombre.toLowerCase().includes(q) ||
        c.clienteTelefono.includes(q)
    );
  }, [citas, search]);

  function sameDay(a: Date, b: Date) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const slotsOcupados = useMemo(() => {
    if (!form.fecha) return new Set<string>();
    const [y, m, d] = form.fecha.split("-").map(Number);
    const diaSeleccionado = new Date(y, m - 1, d);

    const ocupados = new Set<string>();
    citas
      .filter((c) => c.estado !== "cancelada" && sameDay(new Date(c.fecha), diaSeleccionado))
      .forEach((c) => {
        const start = new Date(c.fecha);
        const end = new Date(start.getTime() + c.duracionMinutos * 60000);
        TIME_SLOTS.forEach((slot) => {
          const [hh, mm] = slot.split(":").map(Number);
          const slotDate = new Date(y, m - 1, d, hh, mm);
          if (slotDate >= start && slotDate < end) {
            ocupados.add(slot);
          }
        });
      });
    return ocupados;
  }, [citas, form.fecha]);

  function eventPropGetter(event: any) {
    const estado = event.resource?.estado;
    let backgroundColor = "#7fb896"; // programada (pendiente) — verde pastel
    if (estado === "completada") backgroundColor = "#d98b86"; // completada — rojo pastel
    if (estado === "cancelada") backgroundColor = "#b3b0aa"; // cancelada — gris
    return { style: { backgroundColor, borderRadius: 6, border: "none", color: "#1a1a1a" } };
  }

  function dayPropGetter(day: Date) {
    if (selectedDate && sameDay(day, selectedDate)) {
      return { className: "selected-day" };
    }
    return {};
  }

  function openDetail(cita: Cita) {
    setSelected(cita);
    setSelectedDate(new Date(cita.fecha));
    setMode("detail");
  }

  function openCreate(prefilledDate?: Date) {
    const d = prefilledDate || new Date();
    setForm({
      ...emptyForm,
      fecha: format(d, "yyyy-MM-dd"),
      hora: "",
    });
    setSelectedDate(d);
    setMode("create");
  }

  function backToList() {
    setSelected(null);
    setSelectedDate(null);
    setMode("list");
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.hora) {
      setError("Selecciona un horario para la cita.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const fechaISO = new Date(`${form.fecha}T${form.hora}`).toISOString();
      await api.post("/citas", {
        clienteNombre: form.clienteNombre,
        clienteTelefono: form.clienteTelefono,
        fecha: fechaISO,
        duracionMinutos: Number(form.duracionMinutos),
        precio: Number(form.precio),
        anticipo: Number(form.anticipo) || 0,
        notas: form.notas,
      });
      await loadCitas();
      await loadRecurrentes();
      backToList();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al crear la cita");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar esta cita? Esta acción no se puede deshacer.")) return;
    try {
      await api.delete(`/citas/${id}`);
      await loadCitas();
      await loadRecurrentes();
      backToList();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al eliminar la cita");
    }
  }

  async function handleStatusChange(id: string, estado: Cita["estado"]) {
    try {
      const { data } = await api.put(`/citas/${id}`, { estado });
      setSelected(data.cita);
      await loadCitas();
    } catch (err: any) {
      setError(err.response?.data?.message || "Error al actualizar la cita");
    }
  }

  return (
    <div className="citas-page">
      <OfflineBanner />
      <header className="citas-header">
        <button className="back-link" onClick={() => nav("/dashboard")}>
          ← Panel
        </button>
        <div className="brand-mini">BLACK LINE STUDIO — CITAS</div>
      </header>

      <div className="citas-body">
        <main className="citas-calendar-wrap">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            views={["month"]}
            culture="es"
            style={{ height: "100%" }}
            eventPropGetter={eventPropGetter}
            dayPropGetter={dayPropGetter}
            onSelectEvent={(e: any) => openDetail(e.resource)}
            onSelectSlot={(slot: any) => openCreate(slot.start)}
            selectable
            popup
            popupOffset={{ x: 10, y: 10 }}
            messages={{
              next: "Sig.",
              previous: "Ant.",
              today: "Hoy",
              month: "Mes",
              noEventsInRange: "No hay citas en este rango.",
              showMore: (total: number) => `+${total} más`,
            }}
          />
        </main>

        <aside className="citas-sidebar">
          {error && <div className="alert">{error}</div>}

          {mode !== "create" && (
            <>
              <div className="sidebar-search">
                <input
                  type="text"
                  placeholder="Buscar cliente o teléfono..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <button className="btn primary full" onClick={() => openCreate()}>
                + Nueva cita
              </button>
            </>
          )}

          {mode === "list" && (
            <>
              <div className="sidebar-section">
                <h3>{filteredCitas ? "Resultados" : "Citas de hoy"}</h3>
                {loading ? (
                  <p className="muted">Cargando...</p>
                ) : (filteredCitas || todayCitas).length === 0 ? (
                  <p className="muted">
                    {filteredCitas ? "Sin resultados." : "No hay citas para hoy."}
                  </p>
                ) : (
                  <ul className="cita-list">
                    {(filteredCitas || todayCitas).map((c) => (
                      <li key={c._id} onClick={() => openDetail(c)} className={`cita-item estado-${c.estado}`}>
                        <span className="cita-hora">{format(new Date(c.fecha), "HH:mm")}</span>
                        <span className="cita-nombre">{c.clienteNombre}</span>
                        {c.creadoPor && (
                          <span className="cita-tatuador">{c.creadoPor.name}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {recurrentes.length > 0 && (
                <div className="sidebar-section recurrentes-widget">
                  <h4>Clientes recurrentes</h4>
                  <ul className="recurrente-list">
                    {recurrentes.map((c) => (
                      <li key={c._id} className="recurrente-item">
                        <span className="recurrente-nombre">{c.nombre}</span>
                        <span className="tag recurrente-count">{c.totalCitas}x</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {mode === "detail" && selected && (
            <div className="sidebar-section">
              <button className="back-link small" onClick={backToList}>
                ← Volver
              </button>
              <h3>{selected.clienteNombre}</h3>
              <span className={`badge estado-${selected.estado}`}>{selected.estado}</span>

              <dl className="detail-list">
                <dt>Teléfono</dt>
                <dd>{selected.clienteTelefono}</dd>
                <dt>Fecha</dt>
                <dd>{format(new Date(selected.fecha), "dd/MM/yyyy HH:mm")}</dd>
                <dt>Duración</dt>
                <dd>{selected.duracionMinutos} min</dd>
                <dt>Precio</dt>
                <dd>${selected.precio.toLocaleString()}</dd>
                <dt>Anticipo</dt>
                <dd>${selected.anticipo.toLocaleString()}</dd>
                {selected.creadoPor && (
                  <>
                    <dt>Agendada por</dt>
                    <dd>{selected.creadoPor.name}</dd>
                  </>
                )}
                {selected.notas && (
                  <>
                    <dt>Notas</dt>
                    <dd>{selected.notas}</dd>
                  </>
                )}
              </dl>

              <div className="detail-actions">
                {selected.estado === "programada" && (
                  <>
                    <button className="btn small" onClick={() => handleStatusChange(selected._id, "completada")}>
                      Marcar completada
                    </button>
                    <button className="btn small ghost" onClick={() => handleStatusChange(selected._id, "cancelada")}>
                      Cancelar cita
                    </button>
                  </>
                )}
                <button className="btn small danger" onClick={() => handleDelete(selected._id)}>
                  Eliminar
                </button>
              </div>
            </div>
          )}

          {mode === "create" && (
            <form className="sidebar-section" onSubmit={handleCreate}>
              <button type="button" className="back-link small" onClick={backToList}>
                ← Cancelar
              </button>
              <h3>Nueva cita</h3>

              <label>Nombre del cliente</label>
              <input
                type="text"
                value={form.clienteNombre}
                onChange={(e) => setForm({ ...form, clienteNombre: e.target.value })}
                required
              />

              <label>Teléfono</label>
              <input
                type="tel"
                value={form.clienteTelefono}
                onChange={(e) => setForm({ ...form, clienteTelefono: e.target.value })}
                required
              />

              <div>
                <label>Fecha</label>
                <input
                  type="date"
                  value={form.fecha}
                  onChange={(e) => {
                    setForm({ ...form, fecha: e.target.value, hora: "" });
                    if (e.target.value) {
                      const [y, m, d] = e.target.value.split("-").map(Number);
                      setSelectedDate(new Date(y, m - 1, d));
                    }
                  }}
                  required
                />
              </div>

              <label>Hora</label>
              {!form.fecha ? (
                <p className="muted">Elige primero una fecha para ver los horarios disponibles.</p>
              ) : (
                <div className="time-slot-grid">
                  {TIME_SLOTS.map((slot) => {
                    const ocupado = slotsOcupados.has(slot);
                    const activo = form.hora === slot;
                    return (
                      <button
                        type="button"
                        key={slot}
                        disabled={ocupado}
                        className={`time-slot${activo ? " active" : ""}${ocupado ? " busy" : ""}`}
                        onClick={() => setForm({ ...form, hora: slot })}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              )}
              {form.fecha && !form.hora && (
                <p className="muted small">Selecciona un horario disponible.</p>
              )}

              <label>Duración (minutos)</label>
              <input
                type="number"
                min={15}
                step={15}
                value={form.duracionMinutos}
                onChange={(e) => setForm({ ...form, duracionMinutos: e.target.value })}
                required
              />

              <div className="form-row">
                <div>
                  <label>Precio</label>
                  <input
                    type="number"
                    min={0}
                    value={form.precio}
                    onChange={(e) => setForm({ ...form, precio: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label>Anticipo</label>
                  <input
                    type="number"
                    min={0}
                    value={form.anticipo}
                    onChange={(e) => setForm({ ...form, anticipo: e.target.value })}
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
                {saving ? "Guardando..." : "Guardar cita"}
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}