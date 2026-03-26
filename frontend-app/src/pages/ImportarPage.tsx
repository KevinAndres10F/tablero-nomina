import { useState } from 'react';
import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { getEmployees, saveEmployees } from '../lib/storage';
import { csvToObjects } from '../lib/csv-parser';
import { getEmployeeTemplate, downloadFile } from '../lib/csv-templates';
import type { Employee } from '../types';

export default function ImportarPage() {
  const [result, setResult] = useState<{ success: number; errors: string[] } | null>(null);
  const [importing, setImporting] = useState(false);

  function handleDownloadTemplate() {
    downloadFile(getEmployeeTemplate(), 'plantilla_empleados.csv');
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = csvToObjects(text);
      const existing = getEmployees();
      const errors: string[] = [];
      let success = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const cedula = row['cedula'] || '';
        if (!cedula) { errors.push(`Fila ${i + 2}: cédula vacía`); continue; }
        if (existing.some(e => e.cedula === cedula)) { errors.push(`Fila ${i + 2}: cédula ${cedula} ya existe`); continue; }

        const emp: Employee = {
          id: crypto.randomUUID(),
          cedula,
          firstName: row['nombres'] || '',
          lastName: row['apellidos'] || '',
          position: row['cargo'] || '',
          department: row['departamento'] || '',
          contractType: (row['tipo_contrato'] as Employee['contractType']) || 'indefinido',
          startDate: row['fecha_ingreso'] || '',
          baseSalary: parseFloat(row['sueldo_base']) || 0,
          active: true,
          bankAccount: row['cuenta_bancaria'] || '',
          bankName: row['banco'] || '',
          email: row['email'] || '',
          phone: row['telefono'] || '',
        };
        existing.push(emp);
        success++;
      }

      saveEmployees(existing);
      setResult({ success, errors });
      setImporting(false);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-100 rounded-lg">
            <Upload className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Importar CSV</h1>
            <p className="text-sm text-gray-500">Carga masiva de empleados desde archivo CSV</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">1. Descargar Plantilla</h3>
          <p className="text-sm text-gray-500 mb-4">Descargue la plantilla CSV con el formato correcto para importar empleados.</p>
          <button onClick={handleDownloadTemplate} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2">
            <Download className="w-4 h-4" /> Descargar Plantilla
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">2. Subir Archivo</h3>
          <p className="text-sm text-gray-500 mb-4">Seleccione el archivo CSV con los datos de empleados.</p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
            <FileText className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-600">{importing ? 'Procesando...' : 'Click para seleccionar archivo CSV'}</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" disabled={importing} />
          </label>
        </div>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Resultado de Importación</h3>
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-700">{result.success} empleados importados correctamente</span>
          </div>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                  <span className="text-sm text-red-600">{err}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
