import { Box, Card, CardContent, Grid, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Health } from "../types";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch((e) => setErr(String(e)));
  }, []);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Status
      </Typography>
      {err && <Typography color="error">{err}</Typography>}
      {health && (
        <Grid container spacing={2}>
          <Grid item xs={6} md={3}>
            <Stat label="Status" value={health.status.toUpperCase()} />
          </Grid>
          <Grid item xs={6} md={3}>
            <Stat label="Environment" value={health.environment} />
          </Grid>
          {Object.entries(health.providers).map(([k, v]) => (
            <Grid item xs={6} md={3} key={k}>
              <Stat label={`${k} provider`} value={v} />
            </Grid>
          ))}
        </Grid>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        Use the Voice Console to exercise the secure pipeline as different
        speakers. Sign in as a parent/admin to manage users, devices,
        permissions, and view audit logs.
      </Typography>
    </Box>
  );
}
