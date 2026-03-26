import { useState, useEffect } from 'react';
import { Settings, Save } from 'lucide-react';
import { getConfig, saveConfig } from '../lib/storage';
import type { AppConfig } from '../types';

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setConfig(getConfig()); }, []);

  function handleSave() {
    if (!config) return;
    saveConfig(config);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <Settings className="w-6 h-6 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
            <p className="text-sm text-gray-500">Parámetros generales del sistema</p>
          </div>
        </div>
        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm">
          <Save className="w-4 h-4" /> {saved ? 'Guardado!' : 'Guardar'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Datos de la Empresa</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Empresa</label>
            <input value={config.companyName} onChange={e => setConfig({ ...config, companyName: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">RUC</label>
            <input value={config.ruc} onChange={e => setConfig({ ...config, ruc: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Parámetros de Nómina</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IESS Personal (%)</label>
            <input type="number" step="0.01" value={config.iessPersonalRate} onChange={e => setConfig({ ...config, iessPersonalRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IESS Patronal (%)</label>
            <input type="number" step="0.01" value={config.iessPatronalRate} onChange={e => setConfig({ ...config, iessPatronalRate: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SBU (Salario Básico)</label>
            <input type="number" step="0.01" value={config.sbu} onChange={e => setConfig({ ...config, sbu: parseFloat(e.target.value) || 0 })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Período Actual</label>
            <input type="month" value={config.currentPeriod} onChange={e => setConfig({ ...config, currentPeriod: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Tabla de Impuesto a la Renta</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Desde ($)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Hasta ($)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">Imp. Base ($)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-700">% Excedente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {config.incomeTaxTable.map((bracket, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={bracket.from} onChange={e => {
                      const table = [...config.incomeTaxTable];
                      table[i] = { ...table[i], from: parseFloat(e.target.value) || 0 };
                      setConfig({ ...config, incomeTaxTable: table });
                    }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={bracket.to === Infinity ? '' : bracket.to} placeholder="∞" onChange={e => {
                      const table = [...config.incomeTaxTable];
                      table[i] = { ...table[i], to: e.target.value ? parseFloat(e.target.value) : Infinity };
                      setConfig({ ...config, incomeTaxTable: table });
                    }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={bracket.baseTax} onChange={e => {
                      const table = [...config.incomeTaxTable];
                      table[i] = { ...table[i], baseTax: parseFloat(e.target.value) || 0 };
                      setConfig({ ...config, incomeTaxTable: table });
                    }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" step="0.01" value={bracket.rate} onChange={e => {
                      const table = [...config.incomeTaxTable];
                      table[i] = { ...table[i], rate: parseFloat(e.target.value) || 0 };
                      setConfig({ ...config, incomeTaxTable: table });
                    }} className="w-full px-2 py-1 border border-gray-300 rounded text-sm text-right" />
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
