import {
  AppBar,
  Box,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleIcon from "@mui/icons-material/People";
import DevicesIcon from "@mui/icons-material/Devices";
import HistoryIcon from "@mui/icons-material/History";
import SecurityIcon from "@mui/icons-material/Security";
import MicIcon from "@mui/icons-material/Mic";
import { useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { api, clearToken, getToken, setToken } from "./api/client";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Devices from "./pages/Devices";
import Logs from "./pages/Logs";
import Permissions from "./pages/Permissions";
import Console from "./pages/Console";

const DRAWER_WIDTH = 232;

const NAV = [
  { to: "/", label: "Dashboard", icon: <DashboardIcon /> },
  { to: "/console", label: "Voice Console", icon: <MicIcon /> },
  { to: "/users", label: "Authorized Users", icon: <PeopleIcon /> },
  { to: "/devices", label: "Devices", icon: <DevicesIcon /> },
  { to: "/permissions", label: "Permissions", icon: <SecurityIcon /> },
  { to: "/logs", label: "Audit Logs", icon: <HistoryIcon /> },
];

export default function App() {
  const [authed, setAuthed] = useState(Boolean(getToken()));
  const [loginAs, setLoginAs] = useState("admin");
  const location = useLocation();

  const login = async () => {
    const { access_token } = await api.login(loginAs);
    setToken(access_token);
    setAuthed(true);
  };
  const logout = () => {
    clearToken();
    setAuthed(false);
  };

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700 }}>
            🛡️ ParentAI
          </Typography>
          {authed ? (
            <Button color="inherit" onClick={logout}>
              Sign out
            </Button>
          ) : (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Select
                size="small"
                value={loginAs}
                onChange={(e) => setLoginAs(e.target.value)}
                sx={{ bgcolor: "background.paper", minWidth: 120 }}
              >
                <MenuItem value="admin">admin</MenuItem>
                <MenuItem value="harish">harish (parent)</MenuItem>
                <MenuItem value="spouse">spouse (parent)</MenuItem>
              </Select>
              <Button color="inherit" variant="outlined" onClick={login}>
                Sign in
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: "border-box" },
        }}
      >
        <Toolbar />
        <List>
          {NAV.map((item) => (
            <ListItemButton
              key={item.to}
              component={Link}
              to={item.to}
              selected={location.pathname === item.to}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        {!authed ? (
          <Typography color="text.secondary">
            Sign in (top-right) to view protected data. The Voice Console works
            without signing in.
          </Typography>
        ) : null}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/console" element={<Console />} />
          <Route path="/users" element={authed ? <Users /> : <Navigate to="/" />} />
          <Route path="/devices" element={authed ? <Devices /> : <Navigate to="/" />} />
          <Route
            path="/permissions"
            element={authed ? <Permissions /> : <Navigate to="/" />}
          />
          <Route path="/logs" element={authed ? <Logs /> : <Navigate to="/" />} />
        </Routes>
      </Box>
    </Box>
  );
}
