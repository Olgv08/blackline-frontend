import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Citas from "./pages/Citas";
import Gastos from "./pages/Gastos";
import Clientes from "./pages/Clientes";
import ProtectedRoute from "./routes/ProtectedRoute";
import Insumos from "./pages/Insumos";
import Ingresos from "./pages/Ingresos";
import { registerServiceWorker } from "./notifications";
import { initSyncEngine } from "./offline/sync";

import "./index.css";

// Registrar el service worker (cachea la app para que funcione sin internet)
// y arrancar el motor de sincronización lo antes posible, no hasta que se
// entre al Dashboard.
registerServiceWorker().catch(() => {});
initSyncEngine();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/citas"
          element={
            <ProtectedRoute>
              <Citas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/gastos"
          element={
            <ProtectedRoute>
              <Gastos />
            </ProtectedRoute>
          }
        />
        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <Clientes />
            </ProtectedRoute>
          }
          
        /><Route
  path="/insumos"
  element={
    <ProtectedRoute>
      <Insumos />
    </ProtectedRoute>
  }
/>
<Route
  path="/ingresos"
  element={
    <ProtectedRoute>
      <Ingresos />
    </ProtectedRoute>
  }
/>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);