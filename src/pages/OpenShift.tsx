import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Sun, Moon, Play, ArrowLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { openShift, getOpenShift } from '../offline/opsContext';
import './Selection.css';

export const OpenShift: React.FC = () => {
    const { localId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const localName = location.state?.name || `Local ${localId}`;
    const [cycle, setCycle] = useState<'MANANA' | 'NOCHE'>('MANANA');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [existingShift, setExistingShift] = useState<any>(null);

    useEffect(() => {
        const checkExisting = async () => {
            const shift = await getOpenShift();
            if (shift && shift.local_id === localId) {
                setExistingShift(shift);
                setCycle(shift.cycle);
            }
        };
        checkExisting();
    }, [localId]);

    const handleOpenShift = async () => {
        setIsLoading(true);
        setError(null);
        try {
            if (!localId) throw new Error("ID de local no válido");
            localStorage.setItem("ops_local_id", localId);

            await openShift(localId, localName, cycle);
            
            navigate('/shift', { replace: true });
        } catch (err: any) {
            setError(err.message || 'Error al abrir el turno');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="selection-container">
            <button
                onClick={() => navigate('/select-local')}
                className="btn-secondary"
                style={{ marginBottom: '1.5rem', padding: '0.5rem 1rem' }}
            >
                <ArrowLeft size={18} /> Volver
            </button>

            <h1 className="selection-title">{existingShift ? 'Turno en curso' : 'Abrir Turno'}</h1>
            <h2 className="selection-subtitle">
                {localName}
            </h2>

            {error && (
                <div className="error-banner">
                    <AlertCircle size={20} />
                    <span>{error}</span>
                </div>
            )}

            <div className="cycle-grid">
                <div
                    className={`cycle-card ${cycle === 'MANANA' ? 'is-selected' : ''}`}
                    onClick={() => !existingShift && setCycle('MANANA')}
                >
                    <Sun size={32} />
                    <span className="cycle-card-title">MAÑANA</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}></span>
                </div>
                <div
                    className={`cycle-card ${cycle === 'NOCHE' ? 'is-selected' : ''}`}
                    onClick={() => !existingShift && setCycle('NOCHE')}
                >
                    <Moon size={32} />
                    <span className="cycle-card-title">NOCHE</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}></span>
                </div>
            </div>

            <button
                onClick={handleOpenShift}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '1rem 0' }}
                disabled={isLoading}
            >
                {existingShift ? (
                    <>
                        <Play size={20} />
                        Continuar Turno
                    </>
                ) : (
                    <>
                        <Play size={20} />
                        {isLoading ? 'Abriendo...' : 'Comenzar Jornada'}
                    </>
                )}
            </button>

            {existingShift && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem', color: '#4ade80', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <CheckCircle size={16} />
                    <span>Ya existe un turno abierto para este local.</span>
                </div>
            )}
        </div>
    );
};
