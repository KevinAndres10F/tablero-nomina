import { useState, useEffect } from 'react';
import { Palmtree, Plus } from 'lucide-react';
import { getEmployees, getVacations, saveVacations } from '../lib/storage';
import { formatDate } from '../lib/format';
import type { Employee, VacationRecord } from '../types';

export default function VacacionesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [vacations, setVacations] = useState<VacationRecord[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: '', startDate: '', endDate: '', days: 0, notes: '' });

  useEffect(() => {
    setEmployees(getEmployees());
    setVacations(getVacations());
  }, []);

  function handleSave() {
    const record: VacationRecord = {
      id: crypto.randomUUID(),
      employeeId: form.employeeId,
      startDate: form.startDate,
      endDate: form.endDate,
      days: form.days,
      status: 'pendiente',
      notes: form.notes,
    };
    const all = [...vacations, record];
    saveVacations(all);
    setVacations(all);
    setShowModal(false);
    setForm({ employeeId: '', startDate: '', endDate: '', days: 0, notes: '' });
  }

  function updateStatus(id: string, status: VacationRecord['status']) {
    const updated = vacations.map(v => v.id === id ? { ...v, status } : v);
    saveVacations(updated);
    setVacations(updated);
  }

  const statusColors: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-700',
    aprobada: 'bg-green-100 text-green-700',
    rechazada: 'bg-red-100 text-red-700',
    tomada: 'bg-blue-100 text-blue-700',
  };

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-teal-100 rounded-lg shrink-0">
            <Palmtree className="w-6 h-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Vacaciones</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Control de vacaciones del personal</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="px-3 sm:px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:bg-teal-800 flex items-center gap-2 text-sm shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Solicitar</span><span className="sm:hidden">Nueva</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{vacations.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Pendientes</p>
          <p className="text-xl sm:text-2xl font-bold text-yellow-600">{vacations.filter(v => v.status === 'pendiente').length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Aprobadas</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{vacations.filter(v => v.status === 'aprobada').length}</p>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-3">
        {vacations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Palmtree className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay solicitudes de vacaciones</p>
          </div>
        ) : vacations.map(v => {
          const emp = employees.find(e => e.id === v.employeeId);
          return (
            <div key={v.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{formatDate(v.startDate)} → {formatDate(v.endDate)}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${statusColors[v.status]}`}>{v.status}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-gray-600"><span className="font-semibold">{v.days}</span> días</p>
                {v.status === 'pendiente' && (
                  <div className="flex gap-2">
                    <button onClick={() => updateStatus(v.id, 'aprobada')} className="px-3 py-2 bg-green-50 text-green-600 rounded-lg text-sm hover:bg-green-100 active:bg-green-200">Aprobar</button>
                    <button onClick={() => updateStatus(v.id, 'rechazada')} className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm hover:bg-red-100 active:bg-red-200">Rechazar</button>
                  </div>
                )}
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Desde</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Hasta</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Días</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vacations.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12"><Palmtree className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay solicitudes</p></td></tr>
              ) : vacations.map(v => {
                const emp = employees.find(e => e.id === v.employeeId);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                    <td className="px-4 py-3">{formatDate(v.startDate)}</td>
                    <td className="px-4 py-3">{formatDate(v.endDate)}</td>
                    <td className="px-4 py-3 text-center">{v.days}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${statusColors[v.status]}`}>{v.status}</span></td>
                    <td className="px-4 py-3">
                      {v.status === 'pendiente' && (
                        <div className="flex gap-1">
                          <button onClick={() => updateStatus(v.id, 'aprobada')} className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-xs hover:bg-green-100">Aprobar</button>
                          <button onClick={() => updateStatus(v.id, 'rechazada')} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs hover:bg-red-100">Rechazar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-gray-200"><h2 className="text-lg font-semibold">Solicitar Vacaciones</h2></div>
            <div className="p-4 sm:p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label><select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className={inputClass}><option value="">Seleccionar...</option>{employees.filter(e => e.active).map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Desde</label><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} /></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Hasta</label><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className={inputClass} /></div>
              </div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Días</label><input type="number" value={form.days} onChange={e => setForm({ ...form, days: parseInt(e.target.value) || 0 })} className={inputClass} /></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Notas</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} rows={3} /></div>
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 sm:flex-none px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 active:bg-teal-800 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
