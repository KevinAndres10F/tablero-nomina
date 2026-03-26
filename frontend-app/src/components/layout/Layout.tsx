import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Calculator,
  Upload,
  Gift,
  Palmtree,
  Receipt,
  Archive,
  Clock,
  BookOpen,
  Settings,
  Heart,
  FileText,
  Building,
  Scale,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

const menuItems = [
  { icon: Users, label: 'Empleados', path: '/empleados' },
  { icon: Calculator, label: 'Nómina', path: '/nomina' },
  { icon: Upload, label: 'Importar CSV', path: '/importar' },
  { icon: Gift, label: 'Beneficios', path: '/beneficios' },
  { icon: Palmtree, label: 'Vacaciones', path: '/vacaciones' },
  { icon: Receipt, label: 'Impuesto Renta', path: '/impuesto-renta' },
  { icon: Archive, label: 'Provisiones', path: '/provisiones' },
  { icon: Clock, label: 'Historial', path: '/historial' },
  { icon: BookOpen, label: 'Diario Contable', path: '/diario-contable' },
  { icon: Heart, label: 'Cargas Familiares', path: '/cargas-familiares' },
  { icon: FileText, label: 'Rol de Pagos', path: '/rol-de-pagos' },
  { icon: Building, label: 'Archivos Bancarios', path: '/archivos-bancarios' },
  { icon: Scale, label: 'Salario Digno', path: '/salario-digno' },
  { icon: Settings, label: 'Configuración', path: '/configuracion' },
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const currentPage = menuItems.find(i => i.path === location.pathname);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-72 lg:w-64 bg-white border-r border-gray-200 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between h-14 lg:h-16 px-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">K</span>
            </div>
            <span className="text-lg font-bold text-gray-900">KAPI Nómina</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2.5 -mr-1 rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <nav className="p-2 space-y-0.5 overflow-y-auto h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-4rem)]">
          {menuItems.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-3 lg:py-2.5 rounded-lg text-sm transition-colors active:bg-gray-100 ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                {item.label}
                {isActive && <ChevronRight className="w-4 h-4 ml-auto shrink-0" />}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 lg:h-16 bg-white border-b border-gray-200 flex items-center px-3 lg:px-6 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2.5 -ml-1 rounded-lg hover:bg-gray-100 active:bg-gray-200"
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          {/* Mobile: show current page name */}
          {currentPage && (
            <span className="lg:hidden text-sm font-semibold text-gray-900 truncate">
              {currentPage.label}
            </span>
          )}
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">KAPI Sistema</p>
              <p className="text-xs text-gray-500">Nómina Ecuador</p>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
