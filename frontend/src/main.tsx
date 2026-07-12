import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#7c5cff" },
    secondary: { main: "#00c2a8" },
    background: { default: "#0e0f1a", paper: "#171a2b" },
  },
  shape: { borderRadius: 12 },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
