import {
  Box,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { AuditEvent } from "../types";

const outcomeColor: Record<string, "success" | "error" | "warning" | "default"> = {
  verified: "success",
  success: "success",
  unauthorized: "error",
  denied: "error",
  ignored: "warning",
};

export default function Logs() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.audit(200).then(setEvents).catch((e) => setErr(String(e)));
  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between" }}>
        <Typography variant="h4" gutterBottom>
          Audit Logs
        </Typography>
        <Button onClick={load}>Refresh</Button>
      </Box>
      {err && <Typography color="error">{err}</Typography>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Time</TableCell>
            <TableCell>Event</TableCell>
            <TableCell>User</TableCell>
            <TableCell>Outcome</TableCell>
            <TableCell>Detail</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {events.map((e, i) => (
            <TableRow key={i}>
              <TableCell>{new Date(e.timestamp).toLocaleTimeString()}</TableCell>
              <TableCell>{e.event}</TableCell>
              <TableCell>{e.user_id ?? "—"}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={e.outcome}
                  color={outcomeColor[e.outcome] ?? "default"}
                />
              </TableCell>
              <TableCell>
                <code>{JSON.stringify(e.detail)}</code>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
