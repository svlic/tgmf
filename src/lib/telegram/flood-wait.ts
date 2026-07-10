const TELEGRAM_FLOOD_WAIT_ERROR_CODE = 420;
const FLOOD_WAIT_SECONDS_PATTERN = /(?:FLOOD_WAIT_|A wait of )(\d+)/;

export function getTelegramFloodWaitSeconds(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const isFloodError = "errorCode" in error && error.errorCode === TELEGRAM_FLOOD_WAIT_ERROR_CODE;
  const message = error instanceof Error ? error.message : "";
  if ("seconds" in error && typeof error.seconds === "number" && error.seconds > 0) {
    return isFloodError || message.includes("ForwardMessages") || message.includes("FLOOD_WAIT_") ? error.seconds : null;
  }

  const matchedSeconds = FLOOD_WAIT_SECONDS_PATTERN.exec(message)?.[1];
  if (!matchedSeconds) {
    return null;
  }

  const waitSeconds = Number.parseInt(matchedSeconds, 10);
  if (!Number.isSafeInteger(waitSeconds) || waitSeconds <= 0) {
    return null;
  }

  return isFloodError || message.includes("ForwardMessages") || message.includes("FLOOD_WAIT_") ? waitSeconds : null;
}
