import { useState, useEffect } from 'react';
import { Building, Download } from 'lucide-react';
import { getPayrollRecords, getEmployees, getConfig } from '../lib/storage';
import { formatCurrency, formatPeriod } from '../lib/format';
import { downloadFile } from '../lib/csv-templates';
import type { PayrollRecord, Employee } from '../types';

export default function ArchivosBancariosPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [period, setPeriod] = useState('');

  useEffect(() => {
    const config = getConfig();
    setPeriod(config.currentPeriod);
    setRecords(getPayrollRecords());
    setEmployees(getEmployees());
  }, []);

  const periods = [...new Set(records.map(r => r.period))].sort().reverse();
  const periodRecords = records.filter(r => r.period === period);

  function generateBankFile() {
    const lines = periodRecords.map(r => {
      const emp = employees.find(e => e.id === r.employeeId);
      if (!emp) return '';
      return [emp.cedula, emp.firstName + ' ' + emp.lastName, emp.bankAccount || '', emp.bankName || '', r.netPay.toFixed(2)].join(',');
    }).filter(Boolean);
    const header = 'CEDULA,NOMBRE,CUENTA,BANCO,MONTO';
    downloadFile([header, ...lines].join('\n'), `archivo_bancario_${period}.csv`);
  }

  const totalPay = periodRecords.reduce((s, r) => s + r.netPay, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Building className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Archivos Bancarios</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Generación de archivos para pago bancario</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm">
            {periods.map(p => <option key={p} value={p}>{formatPeriod(p)}</option>)}
          </select>
          <button onClick={generateBankFile} disabled={periodRecords.length === 0} className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 flex items-center gap-2 text-sm disabled:opacity-50">
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">Generar Archivo</span><span className="sm:hidden">Generar</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Transferencias</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{periodRecords.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Monto Total</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(totalPay)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-gray-500">Sin Cuenta</p>
          <p className="text-lg sm:text-2xl font-bold text-yellow-600">{periodRecords.filter(r => { const e = employees.find(em => em.id === r.employeeId); return !e?.bankAccount; }).length}</p>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {periodRecords.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Building className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay registros de nómina para este período</p>
          </div>
        ) : periodRecords.map(r => {
          const emp = employees.find(e => e.id === r.employeeId);
          return (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</p>
                  <p className="text-sm text-gray-500">{emp?.bankName || 'Sin banco'}</p>
                </div>
                <span className="font-bold text-gray-900 shrink-0">{formatCurrency(r.netPay)}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span className="font-mono">{emp?.cedula}</span>
                <span className="font-mono">{emp?.bankAccount || '—'}</span>
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Cédula</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Banco</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Cuenta</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodRecords.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12"><Building className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay registros de nómina para este período</p></td></tr>
              ) : periodRecords.map(r => {
                const emp = employees.find(e => e.id === r.employeeId);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs">{emp?.cedula}</td>
                    <td className="px-4 py-3 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                    <td className="px-4 py-3">{emp?.bankName || <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">Sin banco</span>}</td>
                    <td className="px-4 py-3 font-mono text-xs">{emp?.bankAccount || '—'}</td>
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
