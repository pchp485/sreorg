import {
  Box,
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
import type { DeviceInfo } from "../types";

export default function Devices() {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listDevices().then(setDevices).catch((e) => setErr(String(e)));
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Devices
      </Typography>
      {err && <Typography color="error">{err}</Typography>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Device</TableCell>
            <TableCell>Provider</TableCell>
            <TableCell>State</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {devices.map((d, i) => {
            const { provider, id, ...rest } = d;
            return (
              <TableRow key={`${id}-${i}`}>
                <TableCell>{id}</TableCell>
                <TableCell>
                  <Chip size="small" label={provider} />
                </TableCell>
                <TableCell>
                  <code>{JSON.stringify(rest)}</code>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
