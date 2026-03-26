import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { getPayrollRecords, getEmployees } from '../lib/storage';
import { formatCurrency, formatPeriod } from '../lib/format';
import type { PayrollRecord, Employee } from '../types';

export default function HistorialPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState('');

  useEffect(() => {
    setRecords(getPayrollRecords());
    setEmployees(getEmployees());
  }, []);

  const periods = [...new Set(records.map(r => r.period))].sort().reverse();

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriod) setSelectedPeriod(periods[0]);
  }, [periods, selectedPeriod]);

  const filtered = selectedPeriod ? records.filter(r => r.period === selectedPeriod) : records;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 rounded-lg shrink-0">
          <Clock className="w-6 h-6 text-indigo-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Historial</h1>
          <p className="text-sm text-gray-500 hidden sm:block">Registros históricos de nómina</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Períodos Procesados</p>
          <p className="text-lg sm:text-2xl font-bold text-indigo-600">{periods.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Registros</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{records.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-gray-500">Total Pagado (todos)</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{formatCurrency(records.reduce((s, r) => s + r.netPay, 0))}</p>
        </div>
      </div>

      {periods.length > 0 && (
        <div className="flex overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 gap-2">
          {periods.map(p => (
            <button key={p} onClick={() => setSelectedPeriod(p)}
              className={`px-3 py-2 sm:py-1.5 rounded-lg text-sm shrink-0 ${selectedPeriod === p ? 'bg-indigo-100 text-indigo-700 font-medium' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {formatPeriod(p)}
            </button>
          ))}
        </div>
      )}

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay registros históricos</p>
          </div>
        ) : filtered.map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</p>
                  <p className="text-sm text-gray-500">{formatPeriod(r.period)}</p>
                </div>
                <span className="font-bold text-gray-900 shrink-0">{formatCurrency(r.netPay)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span className="text-green-600">+{formatCurrency(r.totalIncome)}</span>
                <span className="text-red-600">-{formatCurrency(r.totalDeductions)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Período</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Ingresos</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Deducciones</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12"><Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay registros históricos</p></td></tr>
              ) : filtered.map(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3"><span className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs">{formatPeriod(r.period)}</span></td>
                    <td className="px-4 py-3 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                    <td className="px-4 py-3 text-right text-green-600">{formatCurrency(r.totalIncome)}</td>
                    <td className="px-4 py-3 text-right text-red-600">{formatCurrency(r.totalDeductions)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(r.netPay)}</td>
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
