import { useState, useEffect } from 'react';
import { Scale } from 'lucide-react';
import { getEmployees, getConfig } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import type { Employee } from '../types';

export default function SalarioDignoPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sbu, setSbu] = useState(460);

  useEffect(() => {
    const config = getConfig();
    setSbu(config.sbu);
    setEmployees(getEmployees().filter(e => e.active));
  }, []);

  // Salario digno = SBU + componentes (d13/12 + d14/12 + fondo reserva + comisiones)
  const calculations = employees.map(emp => {
    const d13Monthly = emp.baseSalary / 12;
    const d14Monthly = sbu / 12;
    const fondoReserva = emp.baseSalary * 0.0833;
    const totalComponents = emp.baseSalary + d13Monthly + d14Monthly + fondoReserva;
    const salarioDigno = sbu; // Salario digno = SBU vigente
    const gap = Math.max(0, salarioDigno - totalComponents);
    const compliant = gap === 0;
    return { employee: emp, totalComponents, salarioDigno, gap, compliant };
  });

  const compliantCount = calculations.filter(c => c.compliant).length;
  const totalGap = calculations.reduce((s, c) => s + c.gap, 0);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-violet-100 rounded-lg shrink-0">
          <Scale className="w-6 h-6 text-violet-600" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Salario Digno</h1>
          <p className="text-sm text-gray-500 hidden sm:block">Verificación de cumplimiento del salario digno (SBU: {formatCurrency(sbu)})</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Cumplen</p>
          <p className="text-lg sm:text-2xl font-bold text-green-600">{compliantCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">No Cumplen</p>
          <p className="text-lg sm:text-2xl font-bold text-red-600">{employees.length - compliantCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 col-span-2 sm:col-span-1">
          <p className="text-xs sm:text-sm text-gray-500">Brecha Total</p>
          <p className="text-lg sm:text-2xl font-bold text-violet-600">{formatCurrency(totalGap)}</p>
        </div>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-3">
        {calculations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay empleados registrados</p>
          </div>
        ) : calculations.map(c => (
          <div key={c.employee.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{c.employee.firstName} {c.employee.lastName}</p>
                <p className="text-sm text-gray-500">Sueldo: {formatCurrency(c.employee.baseSalary)}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${c.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {c.compliant ? 'Cumple' : 'No cumple'}
              </span>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-xs text-gray-500">
              <div>Componentes: {formatCurrency(c.totalComponents)}</div>
              <div>Brecha: {c.gap > 0 ? formatCurrency(c.gap) : '—'}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hidden sm:block">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Sueldo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Componentes</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Sal. Digno</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Brecha</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calculations.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12"><Scale className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay empleados registrados</p></td></tr>
              ) : calculations.map(c => (
                <tr key={c.employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.employee.firstName} {c.employee.lastName}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.employee.baseSalary)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.totalComponents)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.salarioDigno)}</td>
                  <td className="px-4 py-3 text-right font-medium text-red-600">{c.gap > 0 ? formatCurrency(c.gap) : '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${c.compliant ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.compliant ? 'Cumple' : 'No cumple'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
