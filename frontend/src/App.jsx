import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth, RequireStaff } from "./components/RequireAuth";
import Dashboard from "./screens/Dashboard";
import Login from "./screens/Login";
import PlanScreen from "./screens/PlanScreen";
import Profile from "./screens/Profile";
import Report from "./screens/Report";
import RoleSelect from "./screens/RoleSelect";
import SectorDetail from "./screens/SectorDetail";
import Tips from "./screens/Tips";
import Welcome from "./screens/Welcome";
import AdminDataset from "./screens/admin/AdminDataset";
import AdminJobs from "./screens/admin/AdminJobs";
import AdminLayout from "./screens/admin/AdminLayout";
import AdminModels from "./screens/admin/AdminModels";
import HomePlantFlow from "./screens/home/HomePlantFlow";
import ScanFlow from "./screens/scan/ScanFlow";
import CropSelect from "./screens/setup/CropSelect";
import GridSetup from "./screens/setup/GridSetup";
import QrCodes from "./screens/setup/QrCodes";
import Register from "./screens/setup/Register";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/welcome" replace />} />
      <Route path="/welcome" element={<Welcome />} />
      <Route path="/role" element={<RoleSelect />} />
      <Route path="/login" element={<Login />} />
      <Route path="/home" element={<HomePlantFlow />} />
      <Route path="/register" element={<Register />} />

      {/* Farmer setup wizard + main app — all require a logged-in farmer */}
      <Route element={<RequireAuth />}>
        <Route path="/setup/crop" element={<CropSelect />} />
        <Route path="/setup/grid" element={<GridSetup />} />
        <Route path="/setup/qr" element={<QrCodes />} />

        <Route path="/app" element={<Dashboard />} />
        <Route path="/app/scan" element={<ScanFlow />} />
        <Route path="/app/report/:sessionId" element={<Report />} />
        <Route path="/app/report/:sessionId/sector/:sectorId" element={<SectorDetail />} />
        <Route path="/app/plan/:sessionId" element={<PlanScreen />} />
        <Route path="/app/tips" element={<Tips />} />
        <Route path="/app/profile" element={<Profile />} />
      </Route>

      {/* Admin/training area — staff only */}
      <Route element={<RequireStaff />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDataset />} />
          <Route path="jobs" element={<AdminJobs />} />
          <Route path="models" element={<AdminModels />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/welcome" replace />} />
    </Routes>
  );
}
