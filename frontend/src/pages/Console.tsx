import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  MenuItem,
  Select,
  Slider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { api } from "../api/client";
import type { CommandResponse } from "../types";

// Interactive tester for the secure pipeline: pick a "speaker", type a spoken
// command, and watch the authorization decision. Demonstrates the security
// gate without needing a microphone.
const SPEAKERS = [
  { id: "harish", label: "Harish (parent)" },
  { id: "spouse", label: "Spouse (parent)" },
  { id: "child_leo", label: "Leo (child)" },
  { id: "guest", label: "Guest" },
  { id: "stranger", label: "Unknown / stranger" },
];

const EXAMPLES = [
  "Hey ParentAI, turn off the downstairs lights",
  "Hey ParentAI, set the AC to 72",
  "Hey ParentAI, lock the front door",
  "Hey ParentAI, open the garage",
  "Hey ParentAI, buy me a new video game",
  "Hey Jarvis, why is the sky blue?",
];

export default function Console() {
  const [speaker, setSpeaker] = useState("harish");
  const [confidence, setConfidence] = useState(0.99);
  const [text, setText] = useState(EXAMPLES[0]);
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setError(null);
    try {
      const speakerId = speaker === "stranger" ? "stranger" : speaker;
      setResult(await api.command(text, speakerId, confidence));
    } catch (e) {
      setError(String(e));
    }
  };

  const severity = (r: CommandResponse) =>
    r.executed ? "success" : r.authorized ? "warning" : "error";

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Voice Console
      </Typography>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
              <Select
                size="small"
                value={speaker}
                onChange={(e) => setSpeaker(e.target.value)}
              >
                {SPEAKERS.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.label}
                  </MenuItem>
                ))}
              </Select>
              <Box sx={{ width: 220 }}>
                <Typography variant="caption">
                  Match confidence: {confidence.toFixed(2)}
                </Typography>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={confidence}
                  onChange={(_, v) => setConfidence(v as number)}
                />
              </Box>
            </Box>
            <TextField
              label="Spoken command (include the wake word)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              fullWidth
            />
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {EXAMPLES.map((ex) => (
                <Chip key={ex} label={ex} size="small" onClick={() => setText(ex)} />
              ))}
            </Box>
            <Button variant="contained" onClick={send}>
              Send to pipeline
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {result && (
        <Alert severity={severity(result)} sx={{ mt: 2 }}>
          <Typography fontWeight={700}>
            {result.spoken_response || "(no wake word detected — ignored)"}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            authorized={String(result.authorized)} · executed=
            {String(result.executed)} · confidence={result.confidence} · role=
            {result.role ?? "—"}
            {result.denial_reason ? ` · reason=${result.denial_reason}` : ""}
          </Typography>
          {result.intent && (
            <Typography variant="body2">
              intent: {result.intent.category}/{result.intent.action} →{" "}
              {result.intent.target ?? "—"}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}
