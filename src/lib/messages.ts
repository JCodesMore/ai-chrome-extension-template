// Typed message protocol between the extension's pages (popup, options, content
// scripts) and the background service worker. Keeping every message shape in one
// union means the SW's handler and the UI's callers can never drift apart —
// add a new request/response pair here first, then handle it in background.ts.

// Requests: what a page can ask the service worker to do.
export type PingRequest = { type: 'ping' };

// Add more request variants to this union as the extension grows, e.g.
//   | { type: 'search'; query: string }
export type Msg = PingRequest;

// Responses, keyed by request type. Extend alongside Msg.
export type PingResponse = { pong: true; version: string };

export type MsgResponse = { ping: PingResponse };

// Runtime type guard: is this unknown value one of our messages? Used by the SW
// to reject anything it doesn't recognise, and unit-testable without chrome.*.
export function isMsg(value: unknown): value is Msg {
  if (typeof value !== 'object' || value === null) return false;
  const type = (value as { type?: unknown }).type;
  return type === 'ping';
}

// Typed wrapper so UI code gets inference on both the request and the response
// instead of the untyped chrome.runtime.sendMessage overloads.
export function sendMessage<T extends Msg>(message: T): Promise<MsgResponse[T['type']]> {
  return chrome.runtime.sendMessage(message);
}
