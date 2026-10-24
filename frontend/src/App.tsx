import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './features/admin-dashboard/DashboardPage';
import { AppointmentsPage } from './features/appointments/AppointmentsPage';
import { LoginPage } from './features/auth/LoginPage';
import { DoctorsPage } from './features/doctors/DoctorsPage';
import { PatientDetailPage } from './features/patients/PatientDetailPage';
import { PatientsPage } from './features/patients/PatientsPage';
import { ProtectedRoute } from './routes/ProtectedRoute';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute roles={['admin', 'doctor']} />}>
        <Route element={<Layout />}>
          <Route path="/patients" element={<PatientsPage />} />
          <Route path="/patients/:id" element={<PatientDetailPage />} />
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route index element={<DashboardPage />} />
            <Route path="/appointments" element={<AppointmentsPage />} />
            <Route path="/doctors" element={<DoctorsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
