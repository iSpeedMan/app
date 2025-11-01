import { useEffect, useState } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Profile from "@/pages/Profile";
import AdminPanel from "@/pages/AdminPanel";
import PluginManagement from "@/pages/PluginManagement";
import { Toaster } from "@/components/ui/sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const ProtectedRoute = ({ children }) => {
    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    if (!user) return <Navigate to="/login" />;
    return children;
  };

  const AdminRoute = ({ children }) => {
    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    if (!user || user.role !== 'admin') return <Navigate to="/" />;
    return children;
  };

  const SuperAdminRoute = ({ children }) => {
    if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
    if (!user || !user.is_super_admin) return <Navigate to="/" />;
    return children;
  };

  return (
    <LanguageProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={user ? <Navigate to="/" /> : <Login setUser={setUser} />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard user={user} setUser={setUser} />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile user={user} setUser={setUser} />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <AdminRoute>
                <AdminPanel user={user} setUser={setUser} />
              </AdminRoute>
            } />
            <Route path="/admin/plugins" element={
              <SuperAdminRoute>
                <PluginManagement user={user} setUser={setUser} />
              </SuperAdminRoute>
            } />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-right" />
      </div>
    </LanguageProvider>
  );
}

export default App;
