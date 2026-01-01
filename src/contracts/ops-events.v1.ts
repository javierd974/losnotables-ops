export type EventType =
    | 'ATTENDANCE_IN'
    | 'ATTENDANCE_OUT'
    | 'SHIFT_NOTE'
    | 'SHIFT_ABSENCE'
    | 'CASH_ADVANCE'
    | 'SHIFT_CLOSE';

export interface BaseEventPayload {
    client_event_id: string;
    shift_id: string;
    employee_id: string;
    employee_name?: string;
    event_at: string; // UTC ISO
    created_at: string; // UTC ISO
    device_id: string;
    app_version: string;
    local_id?: string;
}

export interface AttendanceInPayload extends BaseEventPayload {
    type: 'ATTENDANCE_IN';
}

export interface AttendanceOutPayload extends BaseEventPayload {
    type: 'ATTENDANCE_OUT';
}

export interface ShiftNotePayload extends BaseEventPayload {
    type: 'SHIFT_NOTE';
    notes: string;
}

export interface CashAdvancePayload extends BaseEventPayload {
    type: 'CASH_ADVANCE';
    amount: number;
    notes?: string;
}

export interface ShiftAbsencePayload extends BaseEventPayload {
    type: 'SHIFT_ABSENCE';
    reason: string;
    notes?: string;
}

export interface ShiftClosePayload extends BaseEventPayload {
    type: 'SHIFT_CLOSE';
    summary: {
        in_count: number;
        out_count: number;
        vales_count: number;
        vales_total: number;
    };
}

export type OpsEventPayload =
    | AttendanceInPayload
    | AttendanceOutPayload
    | ShiftNotePayload
    | ShiftAbsencePayload
    | CashAdvancePayload
    | ShiftClosePayload;

export const validateEvent = (payload: any): string | null => {
    if (!payload.client_event_id) return 'Falta client_event_id';
    if (!payload.shift_id) return 'Falta shift_id';
    if (!payload.employee_id) return 'Falta employee_id';
    if (!payload.type) return 'Falta type';
    if (!payload.device_id) return 'Falta device_id';
    if (!payload.app_version) return 'Falta app_version';
    if (!payload.event_at) return 'Falta event_at';
    if (!payload.created_at) return 'Falta created_at';

    if (payload.type === 'CASH_ADVANCE') {
        if (payload.amount === undefined || payload.amount === null || payload.amount <= 0) {
            return 'El vale requiere un monto mayor a cero';
        }
    }

    if (payload.type === 'SHIFT_NOTE') {
        if (!payload.notes || payload.notes.trim() === '') {
            return 'La nota requiere un texto';
        }
    }

    if (payload.type === 'SHIFT_ABSENCE') {
        if (!payload.reason || payload.reason.trim() === '') {
            return 'La ausencia requiere un motivo';
        }
    }

    if (payload.type === 'SHIFT_CLOSE') {
        if (!payload.summary) return 'Falta el resumen del cierre';
        if (payload.summary.in_count === undefined) return 'Falta in_count en resumen';
        if (payload.summary.out_count === undefined) return 'Falta out_count en resumen';
    }

    return null;
};
