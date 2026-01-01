export interface StaffMember {
    id: string;
    name: string;
    role: string;
    local_id: string;
}

export const MOCK_STAFF: StaffMember[] = [
    { id: 'emp-001', name: 'Alvaro Sanchez', role: 'OPERADOR', local_id: 'S-01' },
    { id: 'emp-002', name: 'Beatriz Gomez', role: 'SUPERVISOR', local_id: 'S-01' },
    { id: 'emp-003', name: 'Carlos Perez', role: 'VENDEDOR', local_id: 'S-01' },
    { id: 'emp-004', name: 'Dora Martinez', role: 'LIMPIEZA', local_id: 'S-01' },
    { id: 'emp-005', name: 'Esteban Quito', role: 'SEGURIDAD', local_id: 'S-01' },
    { id: 'emp-006', name: 'Fabiana Rios', role: 'OPERADOR', local_id: 'S-01' },
    { id: 'emp-007', name: 'Gabriel Lopez', role: 'VENDEDOR', local_id: 'S-01' },
    { id: 'emp-008', name: 'Hugo Boss', role: 'GERENTE', local_id: 'S-01' }
];
