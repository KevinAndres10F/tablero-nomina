import type { PayrollRecord, JournalEntry, JournalLine } from '../types';

export function generatePayrollJournal(
  records: PayrollRecord[],
  period: string,
  description?: string
): JournalEntry {
  const totalSalaries = records.reduce((sum, r) => sum + r.totalIncome, 0);
  const totalIessPersonal = records.reduce((sum, r) => sum + r.iessPersonal, 0);
  const totalIessPatronal = records.reduce((sum, r) => sum + r.iessPatronal, 0);
  const totalIncomeTax = records.reduce((sum, r) => sum + r.incomeTax, 0);
  const totalNetPay = records.reduce((sum, r) => sum + r.netPay, 0);

  const lines: JournalLine[] = [
    { account: '6.1.01', accountName: 'Gasto Sueldos y Salarios', debit: totalSalaries, credit: 0 },
    { account: '6.1.02', accountName: 'Gasto Aporte Patronal IESS', debit: totalIessPatronal, credit: 0 },
    { account: '2.1.03', accountName: 'IESS Personal por Pagar', debit: 0, credit: totalIessPersonal },
    { account: '2.1.04', accountName: 'IESS Patronal por Pagar', debit: 0, credit: totalIessPatronal },
  ];

  if (totalIncomeTax > 0) {
    lines.push({ account: '2.1.05', accountName: 'Retención IR por Pagar', debit: 0, credit: totalIncomeTax });
  }

  lines.push({ account: '2.1.01', accountName: 'Sueldos por Pagar', debit: 0, credit: totalNetPay });

  return {
    id: crypto.randomUUID(),
    date: new Date().toISOString().slice(0, 10),
    period,
    description: description || `Registro de nómina ${period}`,
    lines,
    createdAt: new Date().toISOString(),
  };
}
