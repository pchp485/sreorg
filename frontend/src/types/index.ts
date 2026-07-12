export type Role = "admin" | "parent" | "guest" | "child" | "unknown";

export interface User {
  id: string;
  name: string;
  role: Role;
  enabled: boolean;
  voice_profiles: number;
}

export interface CommandResponse {
  authorized: boolean;
  executed: boolean;
  spoken_response: string;
  transcript: string;
  denial_reason: string | null;
  confidence: number;
  user_id: string | null;
  role: string | null;
  intent: {
    category: string;
    action: string;
    target: string | null;
    parameters: Record<string, unknown>;
  } | null;
}

export interface AuditEvent {
  timestamp: string;
  event: string;
  user_id: string | null;
  role: string | null;
  outcome: string;
  session_id: string | null;
  detail: Record<string, unknown>;
}

export interface DeviceInfo {
  provider: string;
  id: string;
  [key: string]: unknown;
}

export interface Health {
  status: string;
  environment: string;
  providers: Record<string, string>;
}
