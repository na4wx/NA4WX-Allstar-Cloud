import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { TopNav } from "./components/TopNav";
import { DeviceDetail } from "./routes/DeviceDetail";
import { DevicesList } from "./routes/DevicesList";
import { Login } from "./routes/Login";
import { NodeEditor } from "./routes/NodeEditor";
import { NodesList } from "./routes/NodesList";
import { RawConfigEditor } from "./routes/RawConfigEditor";
import { Register } from "./routes/Register";
import { SoundsManager } from "./routes/SoundsManager";
import { useAuth } from "./state/auth";

function RequireAuth({ children }: { children: ReactNode }) {
  const { email, loading } = useAuth();
  if (loading) {
    return null;
  }
  if (!email) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <>
      <TopNav />
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <DevicesList />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:id"
            element={
              <RequireAuth>
                <DeviceDetail />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:deviceId/nodes"
            element={
              <RequireAuth>
                <NodesList />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:deviceId/nodes/:number"
            element={
              <RequireAuth>
                <NodeEditor />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:deviceId/sounds"
            element={
              <RequireAuth>
                <SoundsManager />
              </RequireAuth>
            }
          />
          <Route
            path="/devices/:deviceId/rawconfig"
            element={
              <RequireAuth>
                <RawConfigEditor />
              </RequireAuth>
            }
          />
        </Routes>
      </main>
    </>
  );
}
