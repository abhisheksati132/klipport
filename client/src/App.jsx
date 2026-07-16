import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import QuickShare from "./pages/QuickShare";
import ShareViewer from "./pages/ShareViewer";
import ProtectedRoute from "./components/ProtectedRoute";

export default function App() {
  return (
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
              primary: "#a855f7",
              secondary: "#14151b",
            },
          },
        }}
      />
      <Routes>
        <Route
          path="/"
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
      </Routes>
    </Router>
  );
}
