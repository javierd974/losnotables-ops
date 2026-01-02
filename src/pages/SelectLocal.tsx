import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import './Selection.css';
import { apiFetch } from '../api/client';

type LocalItem = {
  id: string;
  name: string;
  code?: string; // por si tu DB tiene code separado
};

type LocalsMineResponse = {
  items: LocalItem[];
};

export const SelectLocal: React.FC = () => {
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [locals, setLocals] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setErr(null);

        // ✅ Endpoint esperado: GET /locals/mine
        const data = await apiFetch<LocalsMineResponse>('/locals/mine');

        if (!alive) return;
        setLocals(Array.isArray(data.items) ? data.items : []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || 'No se pudieron cargar los locales.');
        setLocals([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const filteredLocals = useMemo(() => {
    const q = searchTerm.toLowerCase().trim();
    if (!q) return locals;

    return locals.filter(l => {
      const name = (l.name || '').toLowerCase();
      const id = (l.id || '').toLowerCase();
      const code = (l.code || '').toLowerCase();
      return name.includes(q) || id.includes(q) || code.includes(q);
    });
  }, [locals, searchTerm]);

  const handleSelect = (local: LocalItem) => {
    // mantenemos tu navegación actual, pero ahora el id es real (UUID o lo que uses)
    navigate(`/open-shift/${local.id}`, { state: { name: local.name, code: local.code } });
  };

  return (
    <div className="selection-container">
      <h1 className="selection-title">Selección de Local</h1>
      <p className="selection-subtitle">Selecciona el punto de venta donde operarás hoy</p>

      <div className="search-input-wrapper">
        <Search className="search-icon" size={20} />
        <input
          type="text"
          placeholder="Buscar local por nombre o código..."
          className="search-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
          disabled={loading}
        />
      </div>

      {loading && (
        <div className="selection-subtitle" style={{ marginTop: '1rem' }}>
          Cargando locales…
        </div>
      )}

      {err && (
        <div
          style={{
            marginTop: '1rem',
            padding: '12px 14px',
            borderRadius: 12,
            border: '1px solid rgba(255,80,80,.35)',
            background: 'rgba(255,80,80,.10)',
            color: 'white',
          }}
        >
          {err}
          <div style={{ opacity: 0.75, marginTop: 6, fontSize: 12 }}>
            Tip: verificá que tengas locales asignados en <code>user_locals</code>.
          </div>
        </div>
      )}

      <div className="local-list">
        {!loading && !err && filteredLocals.map(local => (
          <div
            key={local.id}
            className="local-item"
            onClick={() => handleSelect(local)}
          >
            <div className="local-info">
              <span className="local-name">{local.name}</span>
              <span className="local-code">{local.code ?? local.id}</span>
            </div>
            <ChevronRight size={20} className="text-muted" />
          </div>
        ))}

        {!loading && !err && filteredLocals.length === 0 && (
          <div className="selection-subtitle" style={{ marginTop: '2rem' }}>
            No se encontraron locales que coincidan.
          </div>
        )}
      </div>
    </div>
  );
};
