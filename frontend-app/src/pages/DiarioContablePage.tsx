import { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import { getJournalEntries, getPayrollRecords, saveJournalEntries } from '../lib/storage';
import { generatePayrollJournal } from '../lib/journal-engine';
import { formatCurrency, formatPeriod, formatDate } from '../lib/format';
import type { JournalEntry } from '../types';

export default function DiarioContablePage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => { setEntries(getJournalEntries()); }, []);

  function generateFromPayroll() {
    const records = getPayrollRecords();
    const periods = [...new Set(records.map(r => r.period))];
    const existingPeriods = entries.map(e => e.period);
    const newPeriods = periods.filter(p => !existingPeriods.includes(p));

    if (newPeriods.length === 0) { alert('No hay períodos nuevos para generar asientos.'); return; }

    const newEntries = newPeriods.map(p => {
      const periodRecords = records.filter(r => r.period === p);
      return generatePayrollJournal(periodRecords, p);
    });

    const all = [...entries, ...newEntries];
    saveJournalEntries(all);
    setEntries(all);
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
            <BookOpen className="w-6 h-6 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Diario Contable</h1>
            <p className="text-sm text-gray-500 hidden sm:block">Asientos contables de nómina</p>
          </div>
        </div>
        <button onClick={generateFromPayroll} className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 active:bg-emerald-800 flex items-center gap-2 text-sm shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Generar desde Nómina</span><span className="sm:hidden">Generar</span>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Asientos</p>
          <p className="text-lg sm:text-2xl font-bold text-emerald-600">{entries.length}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-gray-500">Total Debe</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatCurrency(entries.reduce((s, e) => s + e.lines.reduce((ls, l) => ls + l.debit, 0), 0))}</p>
        </div>
      </div>

      <div className="space-y-4">
        {entries.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 text-center py-12">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No hay asientos contables</p>
            <p className="text-xs text-gray-400 mt-1">Genere asientos desde la nómina procesada</p>
          </div>
        ) : entries.sort((a, b) => b.period.localeCompare(a.period)).map(entry => (
          <div key={entry.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <button onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              className="w-full px-4 sm:px-6 py-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100">
              <div className="text-left min-w-0">
                <p className="font-medium text-gray-900 truncate">{entry.description}</p>
                <p className="text-sm text-gray-500">{formatDate(entry.date)} - {formatPeriod(entry.period)}</p>
              </div>
              <span className="text-sm text-emerald-600 font-medium shrink-0 ml-2">
                {formatCurrency(entry.lines.reduce((s, l) => s + l.debit, 0))}
              </span>
            </button>
            {expanded === entry.id && (
              <div className="px-4 sm:px-6 pb-4">
                {/* Mobile detail view */}
                <div className="sm:hidden space-y-2">
                  {entry.lines.map((line, i) => (
                    <div key={i} className="flex justify-between items-start text-sm py-1 border-b border-gray-50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-gray-900 truncate">{line.accountName}</p>
                        <p className="text-xs text-gray-400 font-mono">{line.account}</p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {line.debit > 0 && <p className="text-gray-900">{formatCurrency(line.debit)}</p>}
                        {line.credit > 0 && <p className="text-gray-500">({formatCurrency(line.credit)})</p>}
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop table */}
                <table className="w-full text-sm hidden sm:table">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Cuenta</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-700">Nombre</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Debe</th>
                      <th className="px-3 py-2 text-right font-medium text-gray-700">Haber</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {entry.lines.map((line, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-mono text-xs">{line.account}</td>
                        <td className="px-3 py-2">{line.accountName}</td>
                        <td className="px-3 py-2 text-right">{line.debit > 0 ? formatCurrency(line.debit) : ''}</td>
                        <td className="px-3 py-2 text-right">{line.credit > 0 ? formatCurrency(line.credit) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
