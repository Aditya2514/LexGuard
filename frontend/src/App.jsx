import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/Layout/AppLayout';
import LandingPage from './pages/LandingPage';
import ContractsPage from './pages/ContractsPage';
import ContractDetailPage from './pages/ContractDetailPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Landing Page */}
        <Route path="/" element={<LandingPage />} />

        {/* Dashboard Routes under AppLayout */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<ContractsPage />} />
          <Route path="/contracts/:id" element={<ContractDetailPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
