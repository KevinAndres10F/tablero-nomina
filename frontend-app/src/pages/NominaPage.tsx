import { useState, useEffect } from 'react';
import { Calculator, Play, Download } from 'lucide-react';
import { getEmployees, getBenefits, getConfig, getPayrollRecords, savePayrollRecords } from '../lib/storage';
import { calculatePayroll } from '../lib/payroll-engine';
import { formatCurrency, formatPeriod } from '../lib/format';
import { downloadFile } from '../lib/csv-templates';
import type { Employee, PayrollRecord } from '../types';

export default function NominaPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [period, setPeriod] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('');

  useEffect(() => {
    const config = getConfig();
    setPeriod(config.currentPeriod);
    setSelectedPeriod(config.currentPeriod);
    setEmployees(getEmployees().filter(e => e.active));
    setRecords(getPayrollRecords());
  }, []);

  const periodRecords = records.filter(r => r.period === selectedPeriod);

  const summary = {
    totalIncome: periodRecords.reduce((s, r) => s + r.totalIncome, 0),
    totalDeductions: periodRecords.reduce((s, r) => s + r.totalDeductions, 0),
    totalNet: periodRecords.reduce((s, r) => s + r.netPay, 0),
  };

  function runPayroll() {
    if (periodRecords.length > 0) {
      if (!confirm(`Ya existe nómina para ${formatPeriod(period)}. ¿Recalcular?`)) return;
    }
    const config = getConfig();
    const benefits = getBenefits();
    const existing = records.filter(r => r.period !== period);
    const newRecords = employees.map(emp => calculatePayroll(emp, benefits, config, period));
    const allRecords = [...existing, ...newRecords];
    savePayrollRecords(allRecords);
    setRecords(allRecords);
    setSelectedPeriod(period);
  }

  function exportCSV() {
    const headers = ['Cédula', 'Nombre', 'Sueldo Base', 'Total Ingresos', 'Total Deducciones', 'Neto a Pagar'];
    const rows = periodRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      return [emp?.cedula || '', `${emp?.firstName} ${emp?.lastName}`, r.baseSalary, r.totalIncome, r.totalDeductions, r.netPay].join(',');
    });
    downloadFile([headers.join(','), ...rows].join('\n'), `nomina_${selectedPeriod}.csv`);
  }

  const periods = [...new Set(records.map(r => r.period))].sort().reverse();

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg shrink-0">
            <Calculator className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Nómina</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Cálculo y procesamiento de nómina mensual</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="flex-1 sm:flex-none px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm" />
          <button onClick={runPayroll} className="px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 active:bg-green-800 flex items-center gap-2 text-sm shrink-0">
            <Play className="w-4 h-4" /> Calcular
          </button>
        </div>
      </div>

      {/* CARDS DE RESUMEN */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Empleados</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{periodRecords.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Ingresos</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Deducciones</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{formatCurrency(summary.totalDeductions)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Neto</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(summary.totalNet)}</p>
        </div>
      </div>

      {/* PERIOD SELECTOR */}
      {periods.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0">
          <span className="text-sm text-gray-500 shrink-0">Período:</span>
          {periods.map(p => (
            <button key={p} onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-sm shrink-0 ${selectedPeriod === p ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300'}`}>
              {formatPeriod(p)}
            </button>
          ))}
          {periodRecords.length > 0 && (
            <button onClick={exportCSV} className="ml-auto px-3 py-2 sm:py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm flex items-center gap-1 shrink-0">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
        </div>
      )}

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-3">
        {periodRecords.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay registros para este período</p>
            <p className="text-xs text-gray-400 mt-1">Seleccione un período y presione "Calcular"</p>
          </div>
        ) : periodRecords.map(record => {
          const emp = employees.find(e => e.id === record.employeeId);
          return (
            <div key={record.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="font-medium text-gray-900">{emp?.firstName} {emp?.lastName}</p>
              <p className="text-sm text-gray-500 mt-0.5">Base: {formatCurrency(record.baseSalary)}</p>
              <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <p className="text-xs text-gray-400">Ingresos</p>
                  <p className="text-sm font-medium text-green-600">{formatCurrency(record.totalIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Deducciones</p>
                  <p className="text-sm font-medium text-red-600">{formatCurrency(record.totalDeductions)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400">Neto</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(record.netPay)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Sueldo Base</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Ingresos</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">IESS</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">IR</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Deducciones</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Calculator className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No hay registros para este período</p>
                  </td>
                </tr>
              ) : periodRecords.map(record => {
                const emp = employees.find(e => e.id === record.employeeId);
                return (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp?.firstName} {emp?.lastName}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(record.baseSalary)}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(record.totalIncome)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(record.iessPersonal)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(record.incomeTax)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(record.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(record.netPay)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
