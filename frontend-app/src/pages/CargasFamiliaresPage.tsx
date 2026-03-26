import { useState, useEffect } from 'react';
import { Heart, Plus, Trash2 } from 'lucide-react';
import { getEmployees, getDependents, saveDependents } from '../lib/storage';
import { formatDate } from '../lib/format';
import type { Employee, FamilyDependent } from '../types';

export default function CargasFamiliaresPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [dependents, setDependents] = useState<FamilyDependent[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ employeeId: '', name: '', relationship: 'hijo' as FamilyDependent['relationship'], birthDate: '', hasDisability: false });

  useEffect(() => {
    setEmployees(getEmployees());
    setDependents(getDependents());
  }, []);

  function handleSave() {
    const dep: FamilyDependent = { id: crypto.randomUUID(), ...form };
    const all = [...dependents, dep];
    saveDependents(all);
    setDependents(all);
    setShowModal(false);
    setForm({ employeeId: '', name: '', relationship: 'hijo', birthDate: '', hasDisability: false });
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta carga familiar?')) return;
    const filtered = dependents.filter(d => d.id !== id);
    saveDependents(filtered);
    setDependents(filtered);
  }

  const relationLabels: Record<string, string> = { hijo: 'Hijo/a', conyuge: 'Cónyuge', padre: 'Padre', madre: 'Madre', otro: 'Otro' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-pink-100 rounded-lg">
            <Heart className="w-6 h-6 text-pink-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cargas Familiares</h1>
            <p className="text-sm text-gray-500">Dependientes de los empleados</p>
          </div>
        </div>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nueva Carga
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Cargas</p>
          <p className="text-2xl font-bold text-pink-600">{dependents.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Con Discapacidad</p>
          <p className="text-2xl font-bold text-gray-900">{dependents.filter(d => d.hasDisability).length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Empleados con Cargas</p>
          <p className="text-2xl font-bold text-gray-900">{new Set(dependents.map(d => d.employeeId)).size}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Empleado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Parentesco</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Fecha Nac.</th>
                <th className="px-4 py-3 text-center font-medium text-gray-700">Discapacidad</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {dependents.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12"><Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay cargas familiares registradas</p></td></tr>
              ) : dependents.map(d => {
                const emp = employees.find(e => e.id === d.employeeId);
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{emp ? `${emp.firstName} ${emp.lastName}` : '—'}</td>
                    <td className="px-4 py-3">{d.name}</td>
                    <td className="px-4 py-3">{relationLabels[d.relationship]}</td>
                    <td className="px-4 py-3">{formatDate(d.birthDate)}</td>
                    <td className="px-4 py-3 text-center">{d.hasDisability ? <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">Sí</span> : '—'}</td>
                    <td className="px-4 py-3"><button onClick={() => handleDelete(d.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-600" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold">Nueva Carga Familiar</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Empleado</label><select value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"><option value="">Seleccionar...</option>{employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>)}</select></div>
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Dependiente</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Parentesco</label><select value={form.relationship} onChange={e => setForm({ ...form, relationship: e.target.value as FamilyDependent['relationship'] })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"><option value="hijo">Hijo/a</option><option value="conyuge">Cónyuge</option><option value="padre">Padre</option><option value="madre">Madre</option><option value="otro">Otro</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Fecha Nacimiento</label><input type="date" value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
              </div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.hasDisability} onChange={e => setForm({ ...form, hasDisability: e.target.checked })} className="rounded" /> Tiene discapacidad</label>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
