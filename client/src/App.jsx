import { lazy, Suspense } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";

// Lazy-loaded routes for optimal code splitting & bundle reduction
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const QuickShare = lazy(() => import("./pages/QuickShare"));
const ShareViewer = lazy(() => import("./pages/ShareViewer"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageLoader() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#070709]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent"></div>
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest animate-pulse">
          Loading Klipport...
        </span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: "#14151b",
              color: "#f3f4f6",
              border: "1px solid rgba(255, 255, 255, 0.05)",
              borderRadius: "12px",
            },
            success: {
              iconTheme: {
                primary: "#0078d4",
                secondary: "#14151b",
              },
            },
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/quick-share" element={<QuickShare />} />
            <Route path="/share/:token" element={<ShareViewer />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}
