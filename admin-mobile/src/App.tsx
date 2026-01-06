import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./ui/Layout";
import AuthGuard from "./auth/AuthGuard";
import Login from "./pages/Login";
import UsersList from "./pages/UsersList";
import UserCreate from "./pages/UserCreate";
import UserEdit from "./pages/UserEdit";
import ForcePasswordChange from "./pages/ForcePasswordChange";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<AuthGuard />}>
          <Route path="/force-password-change" element={<ForcePasswordChange />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/users" replace />} />
            <Route path="/users" element={<UsersList />} />
            <Route path="/users/new" element={<UserCreate />} />
            <Route path="/users/:id" element={<UserEdit />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
