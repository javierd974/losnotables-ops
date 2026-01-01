export type PayrollEffect = 'DEDUCT' | 'INFO' | 'NONE';

export type CashAdvanceReason = {
  code: string;
  name: string;
  payroll_effect: PayrollEffect;
};

export const CASH_ADVANCE_REASONS: CashAdvanceReason[] = [
  { code: 'ANTICIPO', name: 'Anticipo de sueldo', payroll_effect: 'DEDUCT' },
  { code: 'COMPRA', name: 'Compra autorizada', payroll_effect: 'DEDUCT' },
  { code: 'CAJA', name: 'Fondo de caja (no descuenta)', payroll_effect: 'NONE' },
  { code: 'INFO', name: 'Registro informativo', payroll_effect: 'INFO' },
];

