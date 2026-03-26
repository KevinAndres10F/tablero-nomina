import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Search } from 'lucide-react';
import { getEmployees, addEmployee, updateEmployee, deleteEmployee } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import type { Employee } from '../types';

const EMPTY_EMPLOYEE: Omit<Employee, 'id'> = {
  cedula: '',
  firstName: '',
  lastName: '',
  position: '',
  department: '',
  contractType: 'indefinido',
  startDate: '',
  baseSalary: 0,
  active: true,
  bankAccount: '',
  bankName: '',
  email: '',
  phone: '',
};

export default function EmpleadosPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_EMPLOYEE);

  useEffect(() => {
    setEmployees(getEmployees());
  }, []);

  const filtered = employees.filter(e =>
    `${e.firstName} ${e.lastName} ${e.cedula} ${e.department}`.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = employees.filter(e => e.active).length;

  function openNew() {
    setEditing(null);
    setForm(EMPTY_EMPLOYEE);
    setShowModal(true);
  }

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({ ...emp });
    setShowModal(true);
  }

  function handleSave() {
    if (editing) {
      const updated = { ...editing, ...form };
      updateEmployee(updated);
    } else {
      addEmployee({ ...form, id: crypto.randomUUID() });
    }
    setEmployees(getEmployees());
    setShowModal(false);
  }

  function handleDelete(id: string) {
    if (confirm('¿Eliminar este empleado?')) {
      deleteEmployee(id);
      setEmployees(getEmployees());
    }
  }

  const inputClass = "w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm";

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-blue-100 rounded-lg shrink-0">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Empleados</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Gestión de personal de la empresa</p>
          </div>
        </div>
        <button onClick={openNew} className="px-3 sm:px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 flex items-center gap-2 text-sm shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Nuevo</span> <span className="sm:hidden">Nuevo</span>
        </button>
      </div>

      {/* CARDS DE RESUMEN */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900">{employees.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Activos</p>
          <p className="text-xl sm:text-2xl font-bold text-green-600">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Inactivos</p>
          <p className="text-xl sm:text-2xl font-bold text-red-600">{employees.length - activeCount}</p>
        </div>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por nombre, cédula o departamento..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-sm"
        />
      </div>

      {/* MOBILE CARDS */}
      <div className="sm:hidden space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No se encontraron empleados</p>
          </div>
        ) : filtered.map(emp => (
          <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{emp.firstName} {emp.lastName}</p>
                <p className="text-sm text-gray-500">{emp.position} · {emp.department}</p>
                <p className="text-xs text-gray-400 font-mono mt-1">{emp.cedula}</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs shrink-0 ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {emp.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
              <p className="text-lg font-bold text-gray-900">{formatCurrency(emp.baseSalary)}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(emp)} className="p-2.5 hover:bg-blue-50 active:bg-blue-100 rounded-lg">
                  <Pencil className="w-4 h-4 text-blue-600" />
                </button>
                <button onClick={() => handleDelete(emp.id)} className="p-2.5 hover:bg-red-50 active:bg-red-100 rounded-lg">
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
                <th className="px-4 py-3 text-left font-medium text-gray-700">Cédula</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Nombre</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Cargo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Departamento</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Sueldo</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No se encontraron empleados</p>
                  </td>
                </tr>
              ) : filtered.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{emp.cedula}</td>
                  <td className="px-4 py-3 font-medium">{emp.firstName} {emp.lastName}</td>
                  <td className="px-4 py-3">{emp.position}</td>
                  <td className="px-4 py-3">{emp.department}</td>
                  <td className="px-4 py-3">{formatCurrency(emp.baseSalary)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${emp.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {emp.active ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEdit(emp)} className="p-2 hover:bg-blue-50 rounded-lg">
                        <Pencil className="w-4 h-4 text-blue-600" />
                      </button>
                      <button onClick={() => handleDelete(emp.id)} className="p-2 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </button>
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
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editing ? 'Editar Empleado' : 'Nuevo Empleado'}</h2>
              <button onClick={() => setShowModal(false)} className="sm:hidden p-2 -mr-2 rounded-lg hover:bg-gray-100">
                <span className="text-gray-400 text-xl leading-none">&times;</span>
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cédula</label>
                  <input value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombres</label>
                  <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellidos</label>
                  <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                  <input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                  <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo Contrato</label>
                  <select value={form.contractType} onChange={e => setForm({ ...form, contractType: e.target.value as Employee['contractType'] })} className={inputClass}>
                    <option value="indefinido">Indefinido</option>
                    <option value="fijo">Plazo Fijo</option>
                    <option value="eventual">Eventual</option>
                    <option value="prueba">Prueba</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Ingreso</label>
                  <input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sueldo Base</label>
                  <input type="number" step="0.01" value={form.baseSalary} onChange={e => setForm({ ...form, baseSalary: parseFloat(e.target.value) || 0 })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Banco</label>
                  <input value={form.bankName || ''} onChange={e => setForm({ ...form, bankName: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuenta Bancaria</label>
                  <input value={form.bankAccount || ''} onChange={e => setForm({ ...form, bankAccount: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                  <input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputClass} />
                </div>
              </div>
              <div className="flex items-center gap-2 py-1">
                <input type="checkbox" id="emp-active" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} className="w-5 h-5 rounded" />
                <label htmlFor="emp-active" className="text-sm text-gray-700">Empleado activo</label>
              </div>
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-6 border-t border-gray-200 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 sm:flex-none px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 active:bg-gray-100 text-sm">Cancelar</button>
              <button onClick={handleSave} className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm">Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
