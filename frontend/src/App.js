import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Users from "@/pages/Users";
import Projects from "@/pages/Projects";
import Locations from "@/pages/Locations";
import Activities from "@/pages/Activities";
import Tagihan from "@/pages/Tagihan";
import CashBook from "@/pages/CashBook";
import Kasbon from "@/pages/Kasbon";
import TeamPayments from "@/pages/TeamPayments";
import History from "@/pages/History";
import HistoryBukuKas from "@/pages/HistoryBukuKas";
import Team from "@/pages/Team";
import "@/App.css";

function Root() {
  const { user } = useAuth();
  if (user === undefined) return null;
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors closeButton />
        <Routes>
          <Route path="/" element={<Root />} />
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/users" element={<ProtectedRoute roles={["owner"]}><Users /></ProtectedRoute>} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/locations" element={<ProtectedRoute roles={["owner", "bendahara", "tim"]}><Locations /></ProtectedRoute>} />
            <Route path="/activities" element={<ProtectedRoute roles={["owner"]}><Activities /></ProtectedRoute>} />
            <Route path="/tagihan" element={<ProtectedRoute roles={["owner", "penagihan", "bendahara"]}><Tagihan /></ProtectedRoute>} />
            <Route path="/cashbook" element={<ProtectedRoute roles={["owner", "bendahara", "tim"]}><CashBook /></ProtectedRoute>} />
            <Route path="/kasbon" element={<Kasbon />} />
            <Route path="/team-payments" element={<ProtectedRoute roles={["owner", "bendahara"]}><TeamPayments /></ProtectedRoute>} />
            <Route path="/history" element={<History />} />
            <Route path="/history-bukukas" element={<HistoryBukuKas />} />
            <Route path="/team" element={<Team />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
