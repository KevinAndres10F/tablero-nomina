import type { Employee, Benefit, PayrollRecord, PayrollDetail, AppConfig } from '../types';
import { calculateMonthlyIncomeTax } from './income-tax-engine';

export function calculatePayroll(
  employee: Employee,
  benefits: Benefit[],
  config: AppConfig,
  period: string,
  workedDays: number = 30
): PayrollRecord {
  const dailySalary = employee.baseSalary / 30;
  const proportionalSalary = dailySalary * workedDays;

  const details: PayrollDetail[] = [
    { concept: 'Sueldo', type: 'ingreso', amount: proportionalSalary },
  ];

  // Apply benefits
  const applicableBenefits = benefits.filter(b =>
    b.active && (b.appliesTo === 'all' || b.employeeIds?.includes(employee.id))
  );

  for (const benefit of applicableBenefits) {
    const amount = benefit.isPercentage
      ? proportionalSalary * (benefit.amount / 100)
      : benefit.amount;
    details.push({ concept: benefit.name, type: benefit.type, amount });
  }

  const totalIncome = details
    .filter(d => d.type === 'ingreso')
    .reduce((sum, d) => sum + d.amount, 0);

  // IESS Personal
  const iessPersonal = totalIncome * (config.iessPersonalRate / 100);
  details.push({ concept: 'IESS Personal 9.45%', type: 'egreso', amount: iessPersonal });

  // IESS Patronal (not deducted from employee but recorded)
  const iessPatronal = totalIncome * (config.iessPatronalRate / 100);

  // Income Tax
  const annualProjection = totalIncome * 12;
  const annualIess = iessPersonal * 12;
  const incomeTax = calculateMonthlyIncomeTax(annualProjection, annualIess, config.incomeTaxTable);
  if (incomeTax > 0) {
    details.push({ concept: 'Impuesto a la Renta', type: 'egreso', amount: incomeTax });
  }

  // Apply benefit deductions
  const totalDeductions = details
    .filter(d => d.type === 'egreso')
    .reduce((sum, d) => sum + d.amount, 0);

  const netPay = totalIncome - totalDeductions;

  return {
    id: crypto.randomUUID(),
    employeeId: employee.id,
    period,
    baseSalary: employee.baseSalary,
    workedDays,
    totalIncome,
    totalDeductions,
    netPay,
    iessPersonal,
    iessPatronal,
    incomeTax,
    details,
    createdAt: new Date().toISOString(),
  };
}
