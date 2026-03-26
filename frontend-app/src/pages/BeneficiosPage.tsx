import { useState, useEffect } from 'react';
import { Gift, Plus, Pencil, Trash2 } from 'lucide-react';
import { getBenefits, saveBenefits } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import type { Benefit } from '../types';

const EMPTY_BENEFIT: Omit<Benefit, 'id'> = {
  name: '',
  type: 'ingreso',
  amount: 0,
  isPercentage: false,
  appliesTo: 'all',
  active: true,
};

export default function BeneficiosPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Benefit | null>(null);
  const [form, setForm] = useState(EMPTY_BENEFIT);

  useEffect(() => { setBenefits(getBenefits()); }, []);

  function handleSave() {
    const all = [...benefits];
    if (editing) {
      const idx = all.findIndex(b => b.id === editing.id);
      all[idx] = { ...editing, ...form };
    } else {
      all.push({ ...form, id: crypto.randomUUID() });
    }
    saveBenefits(all);
    setBenefits(all);
    setShowModal(false);
  }

  function handleDelete(id: string) {
    if (!confirm('¿Eliminar este beneficio?')) return;
    const filtered = benefits.filter(b => b.id !== id);
    saveBenefits(filtered);
    setBenefits(filtered);
  }

  const ingresos = benefits.filter(b => b.type === 'ingreso');
  const egresos = benefits.filter(b => b.type === 'egreso');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Gift className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Beneficios</h1>
            <p className="text-sm text-gray-500">Ingresos y deducciones adicionales</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm(EMPTY_BENEFIT); setShowModal(true); }} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nuevo Beneficio
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Total Beneficios</p>
          <p className="text-2xl font-bold text-gray-900">{benefits.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Ingresos</p>
          <p className="text-2xl font-bold text-green-600">{ingresos.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Egresos</p>
          <p className="text-2xl font-bold text-red-600">{egresos.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Tipo</th>
                <th className="px-4 py-3 text-right font-medium text-gray-700">Valor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Aplica a</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {benefits.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12"><Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay beneficios registrados</p></td></tr>
              ) : benefits.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${b.type === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.type === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td>
                  <td className="px-4 py-3 text-right">{b.isPercentage ? `${b.amount}%` : formatCurrency(b.amount)}</td>
                  <td className="px-4 py-3">{b.appliesTo === 'all' ? 'Todos' : 'Seleccionados'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.active ? 'Activo' : 'Inactivo'}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setEditing(b); setForm(b); setShowModal(true); }} className="p-1 hover:bg-blue-50 rounded"><Pencil className="w-4 h-4 text-blue-600" /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 text-red-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200"><h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nuevo'} Beneficio</h2></div>
            <div className="p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'ingreso' | 'egreso' })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" /></div>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPercentage} onChange={e => setForm({ ...form, isPercentage: e.target.checked })} className="rounded" /> Valor es porcentaje</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="rounded" /> Activo</label>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm">Cancelar</button>
              <button onClick={handleSave} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
