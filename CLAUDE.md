# KAPI Sistema de Nómina - Lineamientos de Desarrollo

## Stack Tecnológico

- **Frontend:** React 18 + TypeScript + Vite
- **Estilos:** Tailwind CSS (utility-first, sin CSS custom)
- **Iconos:** lucide-react
- **Persistencia:** localStorage con funciones centralizadas en `src/lib/storage.ts`
- **Deploy:** GitHub → Netlify (auto-deploy)
- **Sin backend:** Todo corre en el navegador del cliente

## Estructura de Archivos

```
src/
├── types/index.ts          # Todas las interfaces TypeScript
├── lib/
│   ├── storage.ts          # CRUD localStorage con keys prefijadas "kapi_"
│   ├── format.ts           # formatCurrency, formatDate, formatPeriod
│   ├── payroll-engine.ts   # Motor de cálculo de nómina
│   ├── income-tax-engine.ts # Cálculo IR progresivo
│   ├── journal-engine.ts   # Asientos contables
│   ├── csv-parser.ts       # Parser CSV con BOM
│   └── csv-templates.ts    # Plantillas descargables
├── pages/                  # Una página por módulo
├── components/
│   └── layout/Layout.tsx   # Sidebar + header + responsive
└── App.tsx                 # Rutas con React Router
```

## Patrón de Página (Template)

Cada página sigue esta estructura exacta:

```tsx
import { useState, useEffect } from 'react';
import { IconName } from 'lucide-react';
import { getEmployees, getConfig } from '../lib/storage';
import { formatCurrency } from '../lib/format';
import type { Employee } from '../types';

export default function NombreModuloPage() {
  const [data, setData] = useState<Type[]>([]);

  useEffect(() => { /* cargar datos de storage */ }, []);

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-{color}-100 rounded-lg">
            <Icon className="w-6 h-6 text-{color}-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Título</h1>
            <p className="text-sm text-gray-500">Subtítulo descriptivo</p>
          </div>
        </div>
        {/* Botones de acción */}
      </div>

      {/* CARDS DE RESUMEN */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <p className="text-sm text-gray-500">Label</p>
          <p className="text-2xl font-bold text-gray-900">Valor</p>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Col</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map(item => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{item.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

## Reglas UI/UX - Clases Tailwind

| Elemento | Clase Tailwind |
|----------|---------------|
| Card container | `bg-white rounded-xl shadow-sm border border-gray-200` |
| Header icon bg | `p-2 bg-{color}-100 rounded-lg` |
| Título principal | `text-2xl font-bold text-gray-900` |
| Subtítulo | `text-sm text-gray-500` |
| Botón primario | `px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm` |
| Botón secundario | `px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm` |
| Botón peligro | `px-3 py-1 bg-red-50 text-red-600 rounded-lg hover:bg-red-100` |
| Input | `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm` |
| Select | Mismo que Input |
| Label | `block text-sm font-medium text-gray-700 mb-1` |
| Badge info | `px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs` |
| Badge success | `px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs` |
| Badge warning | `px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs` |
| Empty state | `text-center py-12` con icono gris + texto |
| Tabla header | `bg-gray-50 border-b border-gray-200` |
| Tabla row hover | `hover:bg-gray-50` |
| Modal overlay | `fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4` |
| Modal card | `bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto` |
| Tabs activo | `border-b-2 border-blue-600 text-blue-600 font-medium` |
| Tabs inactivo | `text-gray-500 hover:text-gray-700` |
| Grid responsive | `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` |

## Paleta de Colores por Módulo

| Módulo | Color |
|--------|-------|
| Empleados | `blue-600` |
| Nómina | `green-600` |
| Importar CSV | `purple-600` |
| Beneficios | `amber-600` |
| Vacaciones | `teal-600` |
| Impuesto Renta | `rose-600` |
| Provisiones | `orange-600` |
| Historial | `indigo-600` |
| Diario Contable | `emerald-600` |
| Configuración | `gray-600` |
| Cargas Familiares | `pink-600` |
| Rol de Pagos | `green-600` |
| Archivos Bancarios | `blue-600` |
| Salario Digno | `violet-600` |

## Patrones de Código

### Descarga de archivos (CSV/TXT)

```ts
const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'nombre_archivo.csv';
a.click();
URL.revokeObjectURL(url);
```

### Modal con formulario

```tsx
{showModal && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Título Modal</h2>
      </div>
      <div className="p-6 space-y-4">
        {/* Campos del formulario */}
      </div>
      <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
        <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
        <button onClick={handleSave} className="btn-primary">Guardar</button>
      </div>
    </div>
  </div>
)}
```

### Tabs

```tsx
const [activeTab, setActiveTab] = useState<'tab1' | 'tab2'>('tab1');

<div className="flex gap-1 bg-gray-100 rounded-lg p-1">
  {['tab1', 'tab2'].map(tab => (
    <button key={tab} onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        activeTab === tab ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
      }`}>
      {tab}
    </button>
  ))}
</div>
```

### Agregar nueva ruta

En `App.tsx`:
```tsx
<Route path="/nueva-ruta" element={<NuevaPagina />} />
```

### Agregar al menú

En `Layout.tsx`, agregar al array `menuItems`:
```ts
{ icon: IconName, label: 'Nombre Módulo', path: '/nueva-ruta' }
```

## Convenciones

- **Moneda:** `formatCurrency()` → `$1,234.56` (USD Ecuador)
- **Fechas:** `formatDate()` → `15/03/2026`
- **Períodos:** formato `YYYY-MM`, display con `formatPeriod()`
- **IDs:** `crypto.randomUUID()`
- **Storage keys:** prefijo `kapi_`
- **Un archivo por página**, exports default
- **Nombres de archivo:** `PascalCase` + `Page.tsx`
- **Sin librerías externas de UI** (solo Tailwind + lucide-react)
- **Responsive:** mobile-first con breakpoints `md:` y `lg:`
