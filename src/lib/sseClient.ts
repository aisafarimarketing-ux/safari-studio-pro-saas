// ─── SSE consumer for autopilot streaming ──────────────────────────────
//
// EventSource only does GET. Our autopilot endpoint takes a POST body
// (the trip setup proposal), so we use fetch + ReadableStream and
// parse the SSE wire format ourselves: events are blocks separated by
// \n\n, with `event: <name>` and `data: <json>` lines inside each.
//
// Usage:
//   const result = await streamAutopilot({
//     body: { proposal },
//     signal: abortController.signal,
//     onDayProgress: (entry) => updateUI(entry),
//   });
//
// Resolves with the `done` event payload (the full proposal response).
// Rejects with an Error on any `error` event or transport failure.
// Aborts when `signal` aborts; the upstream Anthropic call is cancelled
// server-side so token spend stops too.

export interface StreamedDayProgress {
  dayNumber: number;
  destination: string;
  country: string;
  description: string;
}

export interface StreamAutopilotOptions {
  body: unknown;
  signal?: AbortSignal;
  onDayProgress?: (entry: StreamedDayProgress) => void;
}

export async function streamAutopilot<T = unknown>(
  opts: StreamAutopilotOptions,
): Promise<T> {
  const res = await fetch("/api/ai/autopilot", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify(opts.body),
    signal: opts.signal,
  });

  if (!res.ok) {
    // Server bailed before opening the stream (auth, billing, bad
    // body). Try to read JSON for a useful error; fall back to status.
    try {
      const detail = (await res.json()) as { error?: string };
      throw new Error(detail.error || `HTTP ${res.status}`);
    } catch {
      throw new Error(`HTTP ${res.status}`);
    }
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by blank lines (\n\n).
    let sepIdx = buffer.indexOf("\n\n");
    while (sepIdx !== -1) {
      const block = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const event = parseSSEBlock(block);
      if (event) {
        if (event.name === "day-progress" && opts.onDayProgress) {
          opts.onDayProgress(event.data as StreamedDayProgress);
        } else if (event.name === "done") {
          return event.data as T;
        } else if (event.name === "error") {
          const message =
            (event.data as { error?: string })?.error ?? "Unknown autopilot error";
          throw new Error(message);
        }
      }
      sepIdx = buffer.indexOf("\n\n");
    }
  }

  // Stream closed without a `done` or `error` event — treat as failure.
  throw new Error("Autopilot stream ended unexpectedly");
}

function parseSSEBlock(block: string): { name: string; data: unknown } | null {
  const lines = block.split("\n");
  let name = "message";
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      name = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  const dataStr = dataLines.join("\n");
  try {
    return { name, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}
