export interface HealthStatus {
  status: "ok";
  service: string;
  uptime: number;
}

export function makeHealth(service: string): HealthStatus {
  return {
    status: "ok",
    service,
    uptime: process.uptime(),
  };
}
