import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { useEffect, useState } from "react";
import { api } from "../api/client";

const CATEGORIES = [
  "home_automation",
  "security_action",
  "purchase",
  "educational_query",
  "general_query",
  "system_admin",
];

export default function Permissions() {
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.permissions().then(setMatrix).catch((e) => setErr(String(e)));
  }, []);

  const roles = Object.keys(matrix);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Permission Matrix
      </Typography>
      {err && <Typography color="error">{err}</Typography>}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            {CATEGORIES.map((c) => (
              <TableCell key={c} align="center">
                {c.replace(/_/g, " ")}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role}>
              <TableCell sx={{ fontWeight: 700 }}>{role}</TableCell>
              {CATEGORIES.map((c) => (
                <TableCell key={c} align="center">
                  {matrix[role].includes(c) ? (
                    <CheckIcon color="success" fontSize="small" />
                  ) : (
                    <CloseIcon color="disabled" fontSize="small" />
                  )}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
