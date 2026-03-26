# KAPI Sistema de Nómina - Instrucciones para Copilot

## Stack Tecnológico

- Frontend: React 18 + TypeScript + Vite
- Estilos: Tailwind CSS (utility-first, sin CSS custom)
- Iconos: lucide-react
- Persistencia: localStorage con funciones centralizadas en `src/lib/storage.ts`
- Deploy: GitHub → Netlify (auto-deploy)
- Sin backend: Todo corre en el navegador del cliente

## Estructura del Proyecto

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

## Convenciones de Código

- Moneda: `formatCurrency()` → `$1,234.56` (USD Ecuador)
- Fechas: `formatDate()` → `15/03/2026`
- Períodos: formato `YYYY-MM`, display con `formatPeriod()`
- IDs: `crypto.randomUUID()`
- Storage keys: prefijo `kapi_`
- Un archivo por página, exports default
- Nombres de archivo: PascalCase + `Page.tsx`
- Sin librerías externas de UI (solo Tailwind + lucide-react)
- Responsive: mobile-first con breakpoints `md:` y `lg:`

## Reglas UI/UX

- Card container: `bg-white rounded-xl shadow-sm border border-gray-200`
- Botón primario: `px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm`
- Botón secundario: `px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm`
- Input/Select: `w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm`
- Label: `block text-sm font-medium text-gray-700 mb-1`
- Modal overlay: `fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4`
- Modal card: `bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto`

## Paleta de Colores por Módulo

- Empleados: blue-600
- Nómina: green-600
- Importar CSV: purple-600
- Beneficios: amber-600
- Vacaciones: teal-600
- Impuesto Renta: rose-600
- Provisiones: orange-600
- Historial: indigo-600
- Diario Contable: emerald-600
- Configuración: gray-600
- Cargas Familiares: pink-600
- Rol de Pagos: green-600
- Archivos Bancarios: blue-600
- Salario Digno: violet-600

## Patrón de Página

Cada página debe tener: Header con icono + título, Cards de resumen, y Tabla principal.
Consultar `CLAUDE.md` en la raíz del proyecto para el template completo y ejemplos de patrones de código (modales, tabs, descarga de archivos).
