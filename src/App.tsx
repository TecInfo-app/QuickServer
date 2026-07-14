import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tables from './pages/Tables';
import TableDetail from './pages/TableDetail';
import Inventory from './pages/Inventory';
import Reports from './pages/Reports';
import Admin from './pages/Admin';
import Kiosk from './pages/Kiosk';
import CentralAdmin from './pages/CentralAdmin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/kiosk" element={<Kiosk />} />
        <Route path="/central-admin" element={<CentralAdmin />} />
        
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="tables" element={<Tables />} />
          <Route path="tables/:id" element={<TableDetail />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="reports" element={<Reports />} />
          <Route path="admin" element={<Admin />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
