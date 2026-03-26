import { useState, useEffect } from 'react';
import { FileText, Download, Printer } from 'lucide-react';
import { getPayrollRecords, getEmployees, getConfig } from '../lib/storage';
import { formatCurrency, formatPeriod } from '../lib/format';
import { downloadFile } from '../lib/csv-templates';
import type { PayrollRecord, Employee } from '../types';

export default function RolDePagosPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [period, setPeriod] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState('');

  useEffect(() => {
    const config = getConfig();
    setPeriod(config.currentPeriod);
    setRecords(getPayrollRecords());
    setEmployees(getEmployees());
  }, []);

  const periods = [...new Set(records.map(r => r.period))].sort().reverse();
  const periodRecords = records.filter(r => r.period === period);
  const selected = selectedEmployee ? periodRecords.find(r => r.employeeId === selectedEmployee) : null;
  const emp = selected ? employees.find(e => e.id === selected.employeeId) : null;

  function exportRol() {
    if (!selected || !emp) return;
    const lines = [
      `ROL DE PAGOS - ${formatPeriod(period)}`,
      `Empleado: ${emp.firstName} ${emp.lastName}`,
      `Cédula: ${emp.cedula}`,
      `Cargo: ${emp.position}`,
      '',
      'INGRESOS',
      ...selected.details.filter(d => d.type === 'ingreso').map(d => `${d.concept},${d.amount.toFixed(2)}`),
      `Total Ingresos,${selected.totalIncome.toFixed(2)}`,
      '',
      'EGRESOS',
      ...selected.details.filter(d => d.type === 'egreso').map(d => `${d.concept},${d.amount.toFixed(2)}`),
      `Total Deducciones,${selected.totalDeductions.toFixed(2)}`,
      '',
      `NETO A RECIBIR,${selected.netPay.toFixed(2)}`,
    ];
    downloadFile(lines.join('\n'), `rol_${emp.cedula}_${period}.csv`);
  }

  const selectClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-green-100 rounded-lg shrink-0">
          <FileText className="w-6 h-6 text-green-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Rol de Pagos</h1>
          <p className="text-sm text-gray-500 hidden sm:block">Rol individual por empleado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className={selectClass}>
            {periods.length === 0 && <option value="">Sin períodos</option>}
            {periods.map(p => <option key={p} value={p}>{formatPeriod(p)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label>
          <select value={selectedEmployee} onChange={e => setSelectedEmployee(e.target.value)} className={selectClass}>
            <option value="">Seleccionar...</option>
            {periodRecords.map(r => {
              const e = employees.find(emp => emp.id === r.employeeId);
              return e ? <option key={r.id} value={r.employeeId}>{e.firstName} {e.lastName}</option> : null;
            })}
          </select>
        </div>
      </div>

      {selected && emp ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 truncate">{emp.firstName} {emp.lastName}</h2>
              <p className="text-sm text-gray-500">{emp.position} · {emp.department}</p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">Cédula: {emp.cedula}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={exportRol} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm flex items-center justify-center gap-1.5">
                <Download className="w-4 h-4" /> CSV
              </button>
              <button onClick={() => window.print()} className="flex-1 sm:flex-none px-3 py-2.5 sm:py-2 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm flex items-center justify-center gap-1.5">
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-green-700 mb-3">INGRESOS</h3>
              <div className="space-y-2">
                {selected.details.filter(d => d.type === 'ingreso').map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-600">{d.concept}</span>
                    <span className="font-medium">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-2 text-green-700">
                  <span>Total Ingresos</span>
                  <span>{formatCurrency(selected.totalIncome)}</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-red-700 mb-3">EGRESOS</h3>
              <div className="space-y-2">
                {selected.details.filter(d => d.type === 'egreso').map((d, i) => (
                  <div key={i} className="flex justify-between text-sm py-0.5">
                    <span className="text-gray-600">{d.concept}</span>
                    <span className="font-medium">{formatCurrency(d.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-bold border-t pt-2 text-red-700">
                  <span>Total Deducciones</span>
                  <span>{formatCurrency(selected.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg flex justify-between items-center">
            <span className="text-base sm:text-lg font-bold text-blue-900">NETO A RECIBIR</span>
            <span className="text-xl sm:text-2xl font-bold text-blue-700">{formatCurrency(selected.netPay)}</span>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Seleccione un período y empleado</p>
          <p className="text-xs text-gray-400 mt-1">para ver el rol de pagos</p>
        </div>
      )}
    </div>
  );
}
