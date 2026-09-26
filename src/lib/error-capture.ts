let lastCapturedError: unknown = null;

function captureError(error: unknown) {
  lastCapturedError = error;
}

export function consumeLastCapturedError(): unknown {
  const error = lastCapturedError;
  lastCapturedError = null;
  return error;
}

export function captureServerError(error: unknown) {
  captureError(error);
}

if (typeof process !== "undefined" && process.on) {
  process.on("uncaughtException", captureError);
  process.on("unhandledRejection", captureError);
}
