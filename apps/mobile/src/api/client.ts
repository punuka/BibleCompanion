import EventSource from 'react-native-sse';
import type {
  AdminStats,
  AuthResponse,
  Citation,
  ComfortResponse,
  Connection,
  ConnectionMessage,
  Conversation,
  ConversationDetail,
  CounselorApplication,
  CounselorProfile,
  CounselorStatus,
  PublicUser,
  SafetyNotice,
  TranscribeResponse,
  Verse,
} from '@bible/shared';

/**
 * Inlined at bundle time. A change requires restarting the Expo dev server —
 * see .env.example for which host to use where.
 */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8787';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let authToken: string | null = null;
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    // The single most common failure in this app, and the generic
    // "Network request failed" tells the developer nothing useful.
    throw new ApiError(
      `Could not reach the API at ${API_URL}. On an Android emulator use http://10.0.2.2:8787, not localhost.`,
      0,
    );
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message: unknown }).message)
        : `Request failed (${response.status})`;
    throw new ApiError(message, response.status);
  }

  return payload as T;
}

/* ------------------------------- endpoints ------------------------------- */

export const api = {
  register: (body: {
    email: string;
    password: string;
    displayName: string;
    language: string;
  }) => request<AuthResponse>('/auth/register', { method: 'POST', body, auth: false }),

  login: (body: { email: string; password: string }) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body, auth: false }),

  me: () => request<PublicUser>('/auth/me'),

  updateMe: (body: { displayName?: string; language?: string }) =>
    request<PublicUser>('/auth/me', { method: 'PATCH', body }),

  conversations: () => request<Conversation[]>('/chat/conversations'),

  createConversation: (body: { language?: string } = {}) =>
    request<ConversationDetail>('/chat/conversations', { method: 'POST', body }),

  conversation: (id: string) => request<ConversationDetail>(`/chat/conversations/${id}`),

  deleteConversation: (id: string) =>
    request<void>(`/chat/conversations/${id}`, { method: 'DELETE' }),

  comfort: (body: { situation: string | null; freeText: string; language?: string }) =>
    request<ComfortResponse>('/comfort', { method: 'POST', body }),

  comfortHistory: () => request<ComfortResponse[]>('/comfort'),

  comfortSession: (id: string) => request<ComfortResponse>(`/comfort/${id}`),

  searchVerses: (params: { q?: string; theme?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.theme) qs.set('theme', params.theme);
    if (params.limit) qs.set('limit', String(params.limit));
    return request<{ count: number; verses: Verse[] }>(`/bible/search?${qs.toString()}`);
  },

  counselors: (params: { language?: string; specialty?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.language) qs.set('language', params.language);
    if (params.specialty) qs.set('specialty', params.specialty);
    const suffix = qs.toString();
    return request<CounselorProfile[]>(`/counselors${suffix ? `?${suffix}` : ''}`);
  },

  counselor: (id: string) => request<CounselorProfile>(`/counselors/${id}`),

  applyAsCounselor: (body: Record<string, unknown>) =>
    request<CounselorProfile>('/counselors/apply', { method: 'POST', body }),

  myApplication: () =>
    request<CounselorProfile & { reviewNote: string | null }>('/counselors/me/application'),

  requestConnection: (counselorId: string, body: { topic: string; language?: string }) =>
    request<Connection>(`/counselors/${counselorId}/connect`, { method: 'POST', body }),

  connections: () => request<(Connection & { role: 'seeker' | 'counselor' })[]>('/connections'),

  connection: (id: string) => request<Connection>(`/connections/${id}`),

  decideConnection: (id: string, status: 'ACCEPTED' | 'DECLINED' | 'CLOSED') =>
    request<Connection>(`/connections/${id}`, { method: 'PATCH', body: { status } }),

  connectionMessages: (id: string) =>
    request<ConnectionMessage[]>(`/connections/${id}/messages`),

  sendConnectionMessage: (id: string, body: string) =>
    request<ConnectionMessage>(`/connections/${id}/messages`, {
      method: 'POST',
      body: { body },
    }),

  transcribe: (body: { audio: string; mimeType: string; language?: string }) =>
    request<TranscribeResponse>('/speech/transcribe', { method: 'POST', body }),

  adminStats: () => request<AdminStats>('/admin/stats'),

  adminCounselors: (status?: CounselorStatus) =>
    request<CounselorApplication[]>(`/admin/counselors${status ? `?status=${status}` : ''}`),

  adminDecideCounselor: (
    id: string,
    status: Exclude<CounselorStatus, 'PENDING'>,
    note?: string,
  ) =>
    request<CounselorApplication>(`/admin/counselors/${id}/decision`, {
      method: 'POST',
      body: { status, note },
    }),
};

/* ------------------------------ chat streaming ---------------------------- */

export interface ChatStreamHandlers {
  onSafety?: (notice: SafetyNotice) => void;
  onDelta: (text: string) => void;
  onCitation?: (citation: Citation) => void;
  onDone?: (payload: { messageId: string; citations: Citation[] }) => void;
  onError?: (message: string) => void;
}

type ChatEventType = 'safety' | 'delta' | 'citation' | 'done' | 'chatError';

/**
 * Consumes the SSE stream from POST /chat/conversations/:id/messages.
 *
 * Uses react-native-sse rather than hand-rolled XMLHttpRequest parsing:
 * Android's XHR does not reliably fire `onprogress` per-chunk for chunked
 * responses without a Content-Length (it can deliver everything in one
 * `onload`, or in rare cases drop buffered-but-unflushed data entirely),
 * which showed up as replies that streamed fine against curl but arrived
 * empty in the app. react-native-sse's native SSE handling doesn't have
 * that gap on either platform.
 */
export function streamChatMessage(
  conversationId: string,
  content: string,
  handlers: ChatStreamHandlers,
): () => void {
  const es = new EventSource<ChatEventType>(
    `${API_URL}/v1/chat/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: JSON.stringify({ content }),
      // One-shot request tied to a specific message — a dropped connection
      // should surface as an error, not silently reconnect and resend it.
      pollingInterval: 0,
    },
  );

  function parse<T>(raw: string | null): T | null {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  es.addEventListener('safety', (event) => {
    const data = parse<SafetyNotice>(event.data);
    if (data) handlers.onSafety?.(data);
  });
  es.addEventListener('delta', (event) => {
    const data = parse<{ text: string }>(event.data);
    if (data) handlers.onDelta(data.text);
  });
  es.addEventListener('citation', (event) => {
    const data = parse<Citation>(event.data);
    if (data) handlers.onCitation?.(data);
  });
  es.addEventListener('done', (event) => {
    const data = parse<{ messageId: string; citations: Citation[] }>(event.data);
    es.close();
    if (data) handlers.onDone?.(data);
  });
  es.addEventListener('chatError', (event) => {
    es.close();
    const data = parse<{ message: string }>(event.data);
    handlers.onError?.(data?.message ?? 'The reply could not be generated.');
  });
  // Built-in EventSource error: bad HTTP status, network drop, timeout —
  // distinct from the app-level `chatError` event above.
  es.addEventListener('error', (event) => {
    es.close();
    const message = 'message' in event ? event.message : undefined;
    handlers.onError?.(
      message ||
        `Could not reach the API at ${API_URL}. On an Android emulator use http://10.0.2.2:8787.`,
    );
  });

  return () => es.close();
}
