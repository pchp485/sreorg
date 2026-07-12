import {
  Box,
  Button,
  Chip,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { User } from "../types";

const roleColor: Record<string, "primary" | "secondary" | "warning" | "default"> = {
  admin: "secondary",
  parent: "primary",
  child: "warning",
  guest: "default",
};

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const load = () => api.listUsers().then(setUsers).catch((e) => setErr(String(e)));
  useEffect(() => {
    load();
  }, []);

  const toggle = async (u: User) => {
    await api.setEnabled(u.id, !u.enabled);
    load();
  };

  const enroll = async (userId: string, file?: File) => {
    if (!file) return;
    await api.enroll(userId, file);
    load();
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Authorized Users
      </Typography>
      {err && <Typography color="error">{err}</Typography>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Voice profiles</TableCell>
            <TableCell>Enabled</TableCell>
            <TableCell>Enroll voice</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.name}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={u.role}
                  color={roleColor[u.role] ?? "default"}
                />
              </TableCell>
              <TableCell>{u.voice_profiles}</TableCell>
              <TableCell>
                <Switch checked={u.enabled} onChange={() => toggle(u)} />
              </TableCell>
              <TableCell>
                <input
                  hidden
                  type="file"
                  accept="audio/*"
                  ref={(el) => (fileRefs.current[u.id] = el)}
                  onChange={(e) => enroll(u.id, e.target.files?.[0])}
                />
                <Button size="small" onClick={() => fileRefs.current[u.id]?.click()}>
                  Upload sample
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
