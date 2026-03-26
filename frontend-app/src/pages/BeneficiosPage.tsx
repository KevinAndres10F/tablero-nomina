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

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm";

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-amber-100 rounded-lg shrink-0">
            <Gift className="w-6 h-6 text-amber-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Beneficios</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Ingresos y deducciones adicionales</p>
          </div>
        </div>
        <button onClick={() => { setEditing(null); setForm(EMPTY_BENEFIT); setShowModal(true); }} className="px-3 sm:px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:bg-amber-800 flex items-center gap-2 text-sm shrink-0">
          <Plus className="w-4 h-4" /> Nuevo
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{benefits.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Ingresos</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{ingresos.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Egresos</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{egresos.length}</p>
        </div>
      </div>

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-3">
        {benefits.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" /><p className="text-gray-500">No hay beneficios registrados</p>
          </div>
        ) : benefits.map(b => (
          <div key={b.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{b.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${b.type === 'ingreso' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{b.type === 'ingreso' ? 'Ingreso' : 'Egreso'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{b.active ? 'Activo' : 'Inactivo'}</span>
                </div>
              </div>
              <p className="text-lg font-bold text-gray-900 shrink-0">{b.isPercentage ? `${b.amount}%` : formatCurrency(b.amount)}</p>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-500">{b.appliesTo === 'all' ? 'Aplica a todos' : 'Seleccionados'}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditing(b); setForm(b); setShowModal(true); }} className="p-2.5 hover:bg-blue-50 active:bg-blue-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => handleDelete(b.id)} className="p-2.5 hover:bg-red-50 active:bg-red-100 rounded-lg">
                  <Trash2 className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* DESKTOP TABLE */}
      <div className="hidden sm:block bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditing(b); setForm(b); setShowModal(true); }} className="p-2 hover:bg-blue-50 rounded-lg"><Pencil className="w-4 h-4 text-blue-600" /></button>
                      <button onClick={() => handleDelete(b.id)} className="p-2 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4 text-red-600" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{editing ? 'Editar' : 'Nuevo'} Beneficio</h2>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div><label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputClass} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'ingreso' | 'egreso' })} className={inputClass}><option value="ingreso">Ingreso</option><option value="egreso">Egreso</option></select></div>
                <div><label className="block text-sm font-medium text-gray-700 mb-1">Valor</label><input type="number" step="0.01" value={form.amount} onChange={e => setForm({ ...form, amount: parseFloat(e.target.value) || 0 })} className={inputClass} /></div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isPercentage} onChange={e => setForm({ ...form, isPercentage: e.target.checked })} className="w-5 h-5 rounded" /> Valor es porcentaje</label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-5 h-5 rounded" /> Activo</label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 active:bg-amber-800 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
