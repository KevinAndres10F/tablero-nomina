import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import EmpleadosPage from './pages/EmpleadosPage';
import NominaPage from './pages/NominaPage';
import ImportarPage from './pages/ImportarPage';
import BeneficiosPage from './pages/BeneficiosPage';
import VacacionesPage from './pages/VacacionesPage';
import ImpuestoRentaPage from './pages/ImpuestoRentaPage';
import ProvisionesPage from './pages/ProvisionesPage';
import HistorialPage from './pages/HistorialPage';
import DiarioContablePage from './pages/DiarioContablePage';
import CargasFamiliaresPage from './pages/CargasFamiliaresPage';
import RolDePagosPage from './pages/RolDePagosPage';
import ArchivosBancariosPage from './pages/ArchivosBancariosPage';
import SalarioDignoPage from './pages/SalarioDignoPage';
import ConfiguracionPage from './pages/ConfiguracionPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/empleados" replace />} />
          <Route path="/empleados" element={<EmpleadosPage />} />
          <Route path="/nomina" element={<NominaPage />} />
          <Route path="/importar" element={<ImportarPage />} />
          <Route path="/beneficios" element={<BeneficiosPage />} />
          <Route path="/vacaciones" element={<VacacionesPage />} />
          <Route path="/impuesto-renta" element={<ImpuestoRentaPage />} />
          <Route path="/provisiones" element={<ProvisionesPage />} />
          <Route path="/historial" element={<HistorialPage />} />
          <Route path="/diario-contable" element={<DiarioContablePage />} />
          <Route path="/cargas-familiares" element={<CargasFamiliaresPage />} />
          <Route path="/rol-de-pagos" element={<RolDePagosPage />} />
          <Route path="/archivos-bancarios" element={<ArchivosBancariosPage />} />
          <Route path="/salario-digno" element={<SalarioDignoPage />} />
          <Route path="/configuracion" element={<ConfiguracionPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
