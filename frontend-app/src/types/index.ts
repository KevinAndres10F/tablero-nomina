export interface Employee {
  id: string;
  cedula: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
  contractType: 'indefinido' | 'fijo' | 'eventual' | 'prueba';
  startDate: string;
  baseSalary: number;
  active: boolean;
  bankAccount?: string;
  bankName?: string;
  email?: string;
  phone?: string;
}

export interface FamilyDependent {
  id: string;
  employeeId: string;
  name: string;
  relationship: 'hijo' | 'conyuge' | 'padre' | 'madre' | 'otro';
  birthDate: string;
  hasDisability: boolean;
}

export interface Benefit {
  id: string;
  name: string;
  type: 'ingreso' | 'egreso';
  amount: number;
  isPercentage: boolean;
  appliesTo: 'all' | 'selected';
  employeeIds?: string[];
  active: boolean;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  period: string; // YYYY-MM
  baseSalary: number;
  workedDays: number;
  totalIncome: number;
  totalDeductions: number;
  netPay: number;
  iessPersonal: number;
  iessPatronal: number;
  incomeTax: number;
  details: PayrollDetail[];
  createdAt: string;
}

export interface PayrollDetail {
  concept: string;
  type: 'ingreso' | 'egreso';
  amount: number;
}

export interface VacationRecord {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'tomada';
  notes?: string;
}

export interface ProvisionRecord {
  id: string;
  employeeId: string;
  period: string;
  decimoTercero: number;
  decimoCuarto: number;
  vacaciones: number;
  fondoReserva: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  period: string;
  description: string;
  lines: JournalLine[];
  createdAt: string;
}

export interface JournalLine {
  account: string;
  accountName: string;
  debit: number;
  credit: number;
}

export interface IncomeTaxBracket {
  from: number;
  to: number;
  baseTax: number;
  rate: number;
}

export interface AppConfig {
  companyName: string;
  ruc: string;
  iessPersonalRate: number;
  iessPatronalRate: number;
  sbu: number; // Salario Básico Unificado
  currentPeriod: string;
  incomeTaxTable: IncomeTaxBracket[];
}

export interface PayrollSummary {
  totalEmployees: number;
  totalIncome: number;
  totalDeductions: number;
  totalNetPay: number;
  totalIessPersonal: number;
  totalIessPatronal: number;
  totalIncomeTax: number;
}
