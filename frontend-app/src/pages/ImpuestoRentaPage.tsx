import { useState, useEffect } from 'react';
import { Receipt } from 'lucide-react';
import { getEmployees, getConfig } from '../lib/storage';
import { calculateAnnualIncomeTax } from '../lib/income-tax-engine';
import { formatCurrency } from '../lib/format';
import type { Employee, AppConfig } from '../types';

export default function ImpuestoRentaPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    setEmployees(getEmployees().filter(e => e.active));
    setConfig(getConfig());
  }, []);

  const calculations = config ? employees.map(emp => {
    const annualIncome = emp.baseSalary * 12;
    const annualIess = annualIncome * (config.iessPersonalRate / 100);
    const annualTax = calculateAnnualIncomeTax(annualIncome, annualIess, config.incomeTaxTable);
    const monthlyTax = Math.round((annualTax / 12) * 100) / 100;
    return { employee: emp, annualIncome, annualIess, annualTax, monthlyTax };
  }) : [];

  const totalAnnualTax = calculations.reduce((s, c) => s + c.annualTax, 0);
  const taxPayers = calculations.filter(c => c.annualTax > 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-rose-100 rounded-lg">
          <Receipt className="w-6 h-6 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impuesto a la Renta</h1>
          <p className="text-sm text-gray-500">Proyección anual de IR por empleado</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Empleados Gravados</p>
          <p className="text-2xl font-bold text-rose-600">{taxPayers}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">IR Anual Total</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalAnnualTax)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Exentos</p>
          <p className="text-2xl font-bold text-green-600">{employees.length - taxPayers}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Ingreso Anual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">IESS Anual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">IR Anual</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">IR Mensual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {calculations.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12"><Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay empleados registrados</p></td></tr>
              ) : calculations.map(c => (
                <tr key={c.employee.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{c.employee.firstName} {c.employee.lastName}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.annualIncome)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.annualIess)}</td>
                  <td className="px-4 py-3 text-right font-medium text-rose-600">{formatCurrency(c.annualTax)}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(c.monthlyTax)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {config && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Tabla de IR Vigente</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Desde</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Hasta</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">Impuesto Base</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-700">% Excedente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {config.incomeTaxTable.map((b, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-right">{formatCurrency(b.from)}</td>
                    <td className="px-3 py-2 text-right">{b.to === Infinity ? 'En adelante' : formatCurrency(b.to)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(b.baseTax)}</td>
                    <td className="px-3 py-2 text-right">{b.rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
