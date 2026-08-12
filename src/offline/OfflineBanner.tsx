import { useEffect, useState } from "react";
import { offlineEvents, getPendingCount, flushQueue } from "./sync";
import "./OfflineBanner.css";

export default function OfflineBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() {
      setOnline(false);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    function handlePendingChanged(e: Event) {
      setPending((e as CustomEvent).detail?.count ?? 0);
    }
    function handleSyncStart() {
      setSyncing(true);
    }
    function handleSyncEnd() {
      setSyncing(false);
    }

    offlineEvents.addEventListener("pending-changed", handlePendingChanged);
    offlineEvents.addEventListener("sync-start", handleSyncStart);
    offlineEvents.addEventListener("sync-end", handleSyncEnd);

    getPendingCount().then(setPending);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      offlineEvents.removeEventListener("pending-changed", handlePendingChanged);
      offlineEvents.removeEventListener("sync-start", handleSyncStart);
      offlineEvents.removeEventListener("sync-end", handleSyncEnd);
    };
  }, []);

  if (online && pending === 0 && !syncing) return null;

  return (
    <div className={`offline-banner ${online ? "online" : "offline"}`}>
      {!online && (
        <span>📴 Sin conexión — tus cambios se guardan y se suben solos cuando regrese internet.</span>
      )}
      {online && syncing && <span>🔄 Sincronizando {pending > 0 ? `${pending} cambios` : ""}...</span>}
      {online && !syncing && pending > 0 && (
        <span>
          ⏳ {pending} cambio{pending === 1 ? "" : "s"} pendiente{pending === 1 ? "" : "s"} por subir
          <button className="offline-banner-retry" onClick={() => flushQueue()}>
            Sincronizar ahora
          </button>
        </span>
      )}
    </div>
  );
}
