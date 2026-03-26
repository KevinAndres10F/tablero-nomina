import type { Employee, Benefit, PayrollRecord, VacationRecord, ProvisionRecord, JournalEntry, AppConfig, FamilyDependent } from '../types';

const KEYS = {
  employees: 'kapi_employees',
  benefits: 'kapi_benefits',
  payroll: 'kapi_payroll',
  vacations: 'kapi_vacations',
  provisions: 'kapi_provisions',
  journal: 'kapi_journal',
  config: 'kapi_config',
  dependents: 'kapi_dependents',
} as const;

function get<T>(key: string): T[] {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
}

function set<T>(key: string, data: T[]): void {
  localStorage.setItem(key, JSON.stringify(data));
}

// Employees
export function getEmployees(): Employee[] {
  return get<Employee>(KEYS.employees);
}

export function saveEmployees(employees: Employee[]): void {
  set(KEYS.employees, employees);
}

export function addEmployee(employee: Employee): void {
  const employees = getEmployees();
  employees.push(employee);
  saveEmployees(employees);
}

export function updateEmployee(updated: Employee): void {
  const employees = getEmployees().map(e => e.id === updated.id ? updated : e);
  saveEmployees(employees);
}

export function deleteEmployee(id: string): void {
  saveEmployees(getEmployees().filter(e => e.id !== id));
}

// Benefits
export function getBenefits(): Benefit[] {
  return get<Benefit>(KEYS.benefits);
}

export function saveBenefits(benefits: Benefit[]): void {
  set(KEYS.benefits, benefits);
}

// Payroll
export function getPayrollRecords(): PayrollRecord[] {
  return get<PayrollRecord>(KEYS.payroll);
}

export function savePayrollRecords(records: PayrollRecord[]): void {
  set(KEYS.payroll, records);
}

export function getPayrollByPeriod(period: string): PayrollRecord[] {
  return getPayrollRecords().filter(r => r.period === period);
}

// Vacations
export function getVacations(): VacationRecord[] {
  return get<VacationRecord>(KEYS.vacations);
}

export function saveVacations(vacations: VacationRecord[]): void {
  set(KEYS.vacations, vacations);
}

// Provisions
export function getProvisions(): ProvisionRecord[] {
  return get<ProvisionRecord>(KEYS.provisions);
}

export function saveProvisions(provisions: ProvisionRecord[]): void {
  set(KEYS.provisions, provisions);
}

// Journal
export function getJournalEntries(): JournalEntry[] {
  return get<JournalEntry>(KEYS.journal);
}

export function saveJournalEntries(entries: JournalEntry[]): void {
  set(KEYS.journal, entries);
}

// Family Dependents
export function getDependents(): FamilyDependent[] {
  return get<FamilyDependent>(KEYS.dependents);
}

export function saveDependents(dependents: FamilyDependent[]): void {
  set(KEYS.dependents, dependents);
}

export function getDependentsByEmployee(employeeId: string): FamilyDependent[] {
  return getDependents().filter(d => d.employeeId === employeeId);
}

// Config
const DEFAULT_CONFIG: AppConfig = {
  companyName: 'Mi Empresa',
  ruc: '',
  iessPersonalRate: 9.45,
  iessPatronalRate: 11.15,
  sbu: 460,
  currentPeriod: new Date().toISOString().slice(0, 7),
  incomeTaxTable: [
    { from: 0, to: 11722, baseTax: 0, rate: 0 },
    { from: 11722, to: 14930, baseTax: 0, rate: 5 },
    { from: 14930, to: 19385, baseTax: 160, rate: 10 },
    { from: 19385, to: 25638, baseTax: 606, rate: 12 },
    { from: 25638, to: 33738, baseTax: 1356, rate: 15 },
    { from: 33738, to: 44721, baseTax: 2571, rate: 20 },
    { from: 44721, to: 59537, baseTax: 4768, rate: 25 },
    { from: 59537, to: 79388, baseTax: 8472, rate: 30 },
    { from: 79388, to: Infinity, baseTax: 14427, rate: 35 },
  ],
};

export function getConfig(): AppConfig {
  const data = localStorage.getItem(KEYS.config);
  return data ? JSON.parse(data) : DEFAULT_CONFIG;
}

export function saveConfig(config: AppConfig): void {
  localStorage.setItem(KEYS.config, JSON.stringify(config));
}
