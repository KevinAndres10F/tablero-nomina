import type { IncomeTaxBracket } from '../types';

export function calculateAnnualIncomeTax(
  annualIncome: number,
  annualIessDeduction: number,
  table: IncomeTaxBracket[]
): number {
  const taxableIncome = annualIncome - annualIessDeduction;

  if (taxableIncome <= 0) return 0;

  for (const bracket of table) {
    if (taxableIncome > bracket.from && taxableIncome <= bracket.to) {
      const excess = taxableIncome - bracket.from;
      return bracket.baseTax + excess * (bracket.rate / 100);
    }
  }

  // Above highest bracket
  const last = table[table.length - 1];
  const excess = taxableIncome - last.from;
  return last.baseTax + excess * (last.rate / 100);
}

export function calculateMonthlyIncomeTax(
  annualIncome: number,
  annualIessDeduction: number,
  table: IncomeTaxBracket[]
): number {
  const annual = calculateAnnualIncomeTax(annualIncome, annualIessDeduction, table);
  return Math.round((annual / 12) * 100) / 100;
}
