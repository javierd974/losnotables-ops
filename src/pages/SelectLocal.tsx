import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronRight } from 'lucide-react';
import './Selection.css';

const LOCALS_MOCK = [
    { id: 'S-01', name: 'Cao' },
    { id: 'S-02', name: 'Celta' },
    { id: 'S-03', name: 'Cortazar' },
    { id: 'S-04', name: 'Federal' },
    { id: 'S-05', name: 'Margot' },
];

export const SelectLocal: React.FC = () => {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');

    const filteredLocals = LOCALS_MOCK.filter(l =>
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (local: typeof LOCALS_MOCK[0]) => {
        // We pass the local info as state or just via URL params
        navigate(`/open-shift/${local.id}`, { state: { name: local.name } });
    };

    return (
        <div className="selection-container">
            <h1 className="selection-title">Selección de Local</h1>
            <p className="selection-subtitle">Selecciona el punto de venta donde operarás hoy</p>

            <div className="search-input-wrapper">
                <Search className="search-icon" size={20} />
                <input
                    type="text"
                    placeholder="Buscar local por nombre o ID..."
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                />
            </div>

            <div className="local-list">
                {filteredLocals.map(local => (
                    <div
                        key={local.id}
                        className="local-item"
                        onClick={() => handleSelect(local)}
                    >
                        <div className="local-info">
                            <span className="local-name">{local.name}</span>
                            <span className="local-code">{local.id}</span>
                        </div>
                        <ChevronRight size={20} className="text-muted" />
                    </div>
                ))}
                {filteredLocals.length === 0 && (
                    <div className="selection-subtitle" style={{ marginTop: '2rem' }}>
                        No se encontraron locales que coincidan.
                    </div>
                )}
            </div>
        </div>
    );
};
