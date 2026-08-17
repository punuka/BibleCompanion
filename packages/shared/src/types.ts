/** Shared API contract types. Imported by both the Fastify API and the Expo app. */

export type Role = 'USER' | 'COUNSELOR' | 'ADMIN';
export type CounselorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type ConnectionStatus = 'REQUESTED' | 'ACCEPTED' | 'DECLINED' | 'CLOSED';
export type SafetyLevel = 'none' | 'concern' | 'crisis';

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  language: string;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface Verse {
  ref: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
  translation: string;
  language: string;
  themes: string[];
}

export interface Citation {
  ref: string;
  text: string;
  translation: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: Citation[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ConversationDetail extends Conversation {
  messages: ChatMessage[];
}

export interface CrisisResource {
  name: string;
  contact: string;
  region: string;
  note?: string;
}

export interface SafetyNotice {
  level: SafetyLevel;
  resources: CrisisResource[];
  message: string;
}

/** Structured output of POST /v1/comfort. Mirrors the JSON schema in comfort.ts. */
export interface ComfortResponse {
  id: string;
  situation: string | null;
  acknowledgement: string;
  verses: Citation[];
  reflection: string;
  prayer: string;
  followUp: string[];
  safety: SafetyNotice | null;
  createdAt: string;
}

export interface CounselorProfile {
  id: string;
  displayName: string;
  headline: string;
  bio: string;
  languages: string[];
  specialties: string[];
  organization: string | null;
  yearsExperience: number;
  status: CounselorStatus;
  approvedAt: string | null;
  createdAt: string;
}

/** Admin-only view; adds fields never exposed in the public directory. */
export interface CounselorApplication extends CounselorProfile {
  credentials: string;
  contactEmail: string;
  userId: string;
  reviewNote: string | null;
}

export interface AdminStats {
  users: number;
  approvedCounselors: number;
  pendingApplications: number;
  conversations: number;
  comfortSessions: number;
  activeConnections: number;
}

export interface Connection {
  id: string;
  status: ConnectionStatus;
  topic: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  counselor: Pick<CounselorProfile, 'id' | 'displayName' | 'headline'>;
  user: Pick<PublicUser, 'id' | 'displayName'>;
  lastMessageAt: string | null;
}

export interface ConnectionMessage {
  id: string;
  connectionId: string;
  senderId: string;
  senderName: string;
  body: string;
  createdAt: string;
}

/* ---- SSE events emitted by POST /v1/chat/conversations/:id/messages ---- */

export type ChatStreamEvent =
  | { event: 'meta'; data: { messageId: string; language: string } }
  | { event: 'safety'; data: SafetyNotice }
  | { event: 'delta'; data: { text: string } }
  | { event: 'citation'; data: Citation }
  | { event: 'done'; data: { messageId: string; citations: Citation[] } }
  | { event: 'error'; data: { message: string } };

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

/** Response of POST /v1/speech/transcribe. */
export interface TranscribeResponse {
  text: string;
}
