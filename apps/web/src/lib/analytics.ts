import { track, trackError } from "@databuddy/sdk";

export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  track(name, properties);
}

export function trackAnalysisError(
  message: string,
  properties?: Record<string, string | number | boolean | null | undefined>
): void {
  trackError(message, properties);
}
