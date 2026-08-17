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

/**
 * Consumes the SSE stream from POST /chat/conversations/:id/messages.
 *
 * React Native's fetch does not expose a readable body, so this uses
 * XMLHttpRequest, whose `onprogress` gives incremental `responseText` on every
 * platform Expo targets — including Android, where the streaming-fetch story
 * is still inconsistent. Slightly old-fashioned, reliably works everywhere.
 */
export function streamChatMessage(
  conversationId: string,
  content: string,
  handlers: ChatStreamHandlers,
): () => void {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', `${API_URL}/v1/chat/conversations/${conversationId}/messages`);
  xhr.setRequestHeader('Content-Type', 'application/json');
  if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

  // Byte offset of what we have already parsed. onprogress hands back the whole
  // response each time, so without this every chunk would be re-processed.
  let consumed = 0;
  let buffer = '';

  const dispatch = (rawEvent: string): void => {
    let event = 'message';
    const dataLines: string[] = [];

    for (const line of rawEvent.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length === 0) return;

    let data: unknown;
    try {
      data = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    switch (event) {
      case 'safety':
        handlers.onSafety?.(data as SafetyNotice);
        break;
      case 'delta':
        handlers.onDelta((data as { text: string }).text);
        break;
      case 'citation':
        handlers.onCitation?.(data as Citation);
        break;
      case 'done':
        handlers.onDone?.(data as { messageId: string; citations: Citation[] });
        break;
      case 'error':
        handlers.onError?.((data as { message: string }).message);
        break;
      default:
        break;
    }
  };

  const drain = (): void => {
    // Events are separated by a blank line. A trailing partial event stays in
    // the buffer until the rest of it arrives.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (rawEvent.trim()) dispatch(rawEvent);
      boundary = buffer.indexOf('\n\n');
    }
  };

  xhr.onprogress = () => {
    buffer += xhr.responseText.slice(consumed);
    consumed = xhr.responseText.length;
    drain();
  };

  xhr.onload = () => {
    buffer += xhr.responseText.slice(consumed);
    consumed = xhr.responseText.length;
    drain();
    if (xhr.status >= 400) {
      handlers.onError?.(`Request failed (${xhr.status}).`);
    }
  };

  xhr.onerror = () => {
    handlers.onError?.(
      `Could not reach the API at ${API_URL}. On an Android emulator use http://10.0.2.2:8787.`,
    );
  };

  xhr.send(JSON.stringify({ content }));

  return () => xhr.abort();
}
