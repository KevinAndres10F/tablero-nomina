import { useState, useEffect } from 'react';
import { Archive, Calculator } from 'lucide-react';
import { getEmployees, getConfig, getProvisions, saveProvisions } from '../lib/storage';
import { formatCurrency, formatPeriod } from '../lib/format';
import type { Employee, ProvisionRecord } from '../types';

export default function ProvisionesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [provisions, setProvisions] = useState<ProvisionRecord[]>([]);
  const [period, setPeriod] = useState('');

  useEffect(() => {
    const config = getConfig();
    setPeriod(config.currentPeriod);
    setEmployees(getEmployees().filter(e => e.active));
    setProvisions(getProvisions());
  }, []);

  const periodProvisions = provisions.filter(p => p.period === period);

  function calculateProvisions() {
    const config = getConfig();
    const existing = provisions.filter(p => p.period !== period);
    const newProvisions = employees.map(emp => ({
      id: crypto.randomUUID(),
      employeeId: emp.id,
      period,
      decimoTercero: emp.baseSalary / 12,
      decimoCuarto: config.sbu / 12,
      vacaciones: emp.baseSalary / 24,
      fondoReserva: emp.baseSalary * 0.0833,
    }));
    const all = [...existing, ...newProvisions];
    saveProvisions(all);
    setProvisions(all);
  }

  const totals = {
    d13: periodProvisions.reduce((s, p) => s + p.decimoTercero, 0),
    d14: periodProvisions.reduce((s, p) => s + p.decimoCuarto, 0),
    vac: periodProvisions.reduce((s, p) => s + p.vacaciones, 0),
    fr: periodProvisions.reduce((s, p) => s + p.fondoReserva, 0),
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-orange-100 rounded-lg shrink-0">
            <Archive className="w-6 h-6 text-orange-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Provisiones</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Décimos, vacaciones y fondo de reserva</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2.5 border border-gray-300 rounded-lg text-base sm:text-sm" />
          <button onClick={calculateProvisions} className="px-4 py-2.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 active:bg-orange-800 flex items-center gap-2 text-sm">
            <Calculator className="w-4 h-4" /> <span className="hidden sm:inline">Calcular</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Décimo Tercero</p>
          <p className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(totals.d13)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Décimo Cuarto</p>
          <p className="text-lg sm:text-2xl font-bold text-orange-600">{formatCurrency(totals.d14)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Vacaciones</p>
          <p className="text-lg sm:text-2xl font-bold text-teal-600">{formatCurrency(totals.vac)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Fondo de Reserva</p>
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{formatCurrency(totals.fr)}</p>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {periodProvisions.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay provisiones para {period ? formatPeriod(period) : 'este período'}</p>
          </div>
        ) : periodProvisions.map(p => {
          const emp = employees.find(e => e.id === p.employeeId);
          const total = p.decimoTercero + p.decimoCuarto + p.vacaciones + p.fondoReserva;
          return (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</p>
                  <p className="text-sm text-gray-500">Total: {formatCurrency(total)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-500">
                <div>D.13: {formatCurrency(p.decimoTercero)}</div>
                <div>D.14: {formatCurrency(p.decimoCuarto)}</div>
                <div>Vac: {formatCurrency(p.vacaciones)}</div>
                <div>F.R: {formatCurrency(p.fondoReserva)}</div>
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">D. Tercero</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">D. Cuarto</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Vacaciones</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Fondo Reserva</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periodProvisions.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12"><Archive className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay provisiones para {period ? formatPeriod(period) : 'este período'}</p></td></tr>
              ) : periodProvisions.map(p => {
                const emp = employees.find(e => e.id === p.employeeId);
                const total = p.decimoTercero + p.decimoCuarto + p.vacaciones + p.fondoReserva;
                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.decimoTercero)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.decimoCuarto)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.vacaciones)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(p.fondoReserva)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCurrency(total)}</td>
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
