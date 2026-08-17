import { getLanguage } from '@bible/shared';

/**
 * UI strings. Verse text and AI replies are translated by the API; this covers
 * only chrome. Languages without a dictionary fall back to English chrome while
 * still receiving fully translated content — that is a deliberate tradeoff so a
 * language can be added to the registry before its UI copy is ready.
 */
export type StringKey =
  | 'appName'
  | 'tagline'
  | 'signIn'
  | 'signUp'
  | 'signOut'
  | 'email'
  | 'password'
  | 'displayName'
  | 'language'
  | 'createAccount'
  | 'haveAccount'
  | 'noAccount'
  | 'chat'
  | 'comfort'
  | 'counselors'
  | 'profile'
  | 'newConversation'
  | 'noConversations'
  | 'noConversationsHint'
  | 'askAnything'
  | 'send'
  | 'thinking'
  | 'comfortIntro'
  | 'chooseSituation'
  | 'describeSituation'
  | 'findComfort'
  | 'comfortHistory'
  | 'noComfortHistory'
  | 'noComfortHistoryHint'
  | 'acknowledgement'
  | 'scripture'
  | 'reflection'
  | 'prayer'
  | 'toSitWith'
  | 'counselorsIntro'
  | 'noCounselors'
  | 'requestConnection'
  | 'topic'
  | 'topicHint'
  | 'yearsExperience'
  | 'speaks'
  | 'myConnections'
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'accept'
  | 'decline'
  | 'writeMessage'
  | 'becomeCounselor'
  | 'applicationPending'
  | 'applicationApproved'
  | 'applicationRejected'
  | 'youAreNotAlone'
  | 'crisisTitle'
  | 'error'
  | 'retry'
  | 'loading'
  | 'cancel'
  | 'listen'
  | 'stopSpeaking'
  | 'recordVoice'
  | 'stopRecording'
  | 'micPermissionDenied'
  | 'help'
  | 'userManual';

type Dict = Record<StringKey, string>;

const en: Dict = {
  appName: 'Bible Companion',
  tagline: 'Scripture, and someone to read it with.',
  signIn: 'Sign in',
  signUp: 'Sign up',
  signOut: 'Sign out',
  email: 'Email',
  password: 'Password',
  displayName: 'Your name',
  language: 'Language',
  createAccount: 'Create account',
  haveAccount: 'Already have an account?',
  noAccount: "Don't have an account?",
  chat: 'Chat',
  comfort: 'Comfort',
  counselors: 'Counsellors',
  profile: 'Profile',
  newConversation: 'New conversation',
  noConversations: 'Nothing here yet',
  noConversationsHint: 'Ask a question, or just say how your day went.',
  askAnything: 'Say anything…',
  send: 'Send',
  thinking: 'Reading…',
  comfortIntro: 'Tell me what you are carrying, and I will find scripture that meets it.',
  chooseSituation: 'What is this about?',
  describeSituation: 'In your own words…',
  findComfort: 'Find comfort',
  comfortHistory: 'History',
  noComfortHistory: 'Nothing here yet',
  noComfortHistoryHint: 'Past reflections will show up here.',
  acknowledgement: '',
  scripture: 'Scripture',
  reflection: 'Reflection',
  prayer: 'A prayer',
  toSitWith: 'To sit with',
  counselorsIntro: 'Approved counsellors you can talk to.',
  noCounselors: 'No counsellors match yet.',
  requestConnection: 'Request a conversation',
  topic: 'What would you like to talk about?',
  topicHint: 'They will see this when they decide whether to accept.',
  yearsExperience: 'years',
  speaks: 'Speaks',
  myConnections: 'My conversations',
  pending: 'Waiting for a reply',
  accepted: 'Open',
  declined: 'Declined',
  accept: 'Accept',
  decline: 'Decline',
  writeMessage: 'Write a message…',
  becomeCounselor: 'Apply as a counsellor',
  applicationPending: 'Your application is being reviewed.',
  applicationApproved: 'You are an approved counsellor.',
  applicationRejected: 'Your application was not approved.',
  youAreNotAlone: 'You are not alone in this.',
  crisisTitle: 'Please reach one of these now',
  error: 'Something went wrong',
  retry: 'Try again',
  loading: 'Loading…',
  cancel: 'Cancel',
  listen: 'Listen',
  stopSpeaking: 'Stop',
  recordVoice: 'Record a voice message',
  stopRecording: 'Stop recording',
  micPermissionDenied: 'Microphone access is needed to record a voice message.',
  help: 'Help',
  userManual: 'User manual',
};

const es: Dict = {
  ...en,
  tagline: 'La Escritura, y alguien con quien leerla.',
  signIn: 'Iniciar sesión',
  signUp: 'Registrarse',
  signOut: 'Cerrar sesión',
  email: 'Correo',
  password: 'Contraseña',
  displayName: 'Tu nombre',
  language: 'Idioma',
  createAccount: 'Crear cuenta',
  haveAccount: '¿Ya tienes una cuenta?',
  noAccount: '¿No tienes cuenta?',
  chat: 'Conversar',
  comfort: 'Consuelo',
  counselors: 'Consejeros',
  profile: 'Perfil',
  newConversation: 'Nueva conversación',
  noConversations: 'Todavía no hay nada aquí',
  noConversationsHint: 'Haz una pregunta, o simplemente cuenta cómo fue tu día.',
  askAnything: 'Di lo que quieras…',
  send: 'Enviar',
  thinking: 'Leyendo…',
  comfortIntro: 'Cuéntame qué estás cargando y buscaré una Escritura que lo acompañe.',
  chooseSituation: '¿De qué se trata?',
  describeSituation: 'En tus propias palabras…',
  findComfort: 'Buscar consuelo',
  comfortHistory: 'Historial',
  noComfortHistory: 'Todavía no hay nada aquí',
  noComfortHistoryHint: 'Tus reflexiones pasadas aparecerán aquí.',
  scripture: 'Escritura',
  reflection: 'Reflexión',
  prayer: 'Una oración',
  toSitWith: 'Para meditar',
  counselorsIntro: 'Consejeros aprobados con quienes puedes hablar.',
  noCounselors: 'Aún no hay consejeros que coincidan.',
  requestConnection: 'Solicitar una conversación',
  topic: '¿De qué te gustaría hablar?',
  topicHint: 'Lo verán al decidir si aceptan.',
  yearsExperience: 'años',
  speaks: 'Habla',
  myConnections: 'Mis conversaciones',
  pending: 'Esperando respuesta',
  accepted: 'Abierta',
  declined: 'Rechazada',
  accept: 'Aceptar',
  decline: 'Rechazar',
  writeMessage: 'Escribe un mensaje…',
  becomeCounselor: 'Postularme como consejero',
  applicationPending: 'Tu solicitud está en revisión.',
  applicationApproved: 'Eres un consejero aprobado.',
  applicationRejected: 'Tu solicitud no fue aprobada.',
  youAreNotAlone: 'No estás solo en esto.',
  crisisTitle: 'Por favor comunícate con alguno de estos ahora',
  error: 'Algo salió mal',
  retry: 'Intentar de nuevo',
  loading: 'Cargando…',
  cancel: 'Cancelar',
  listen: 'Escuchar',
  stopSpeaking: 'Detener',
  recordVoice: 'Grabar un mensaje de voz',
  stopRecording: 'Detener grabación',
  micPermissionDenied: 'Se necesita acceso al micrófono para grabar un mensaje de voz.',
  help: 'Ayuda',
  userManual: 'Manual de usuario',
};

const pt: Dict = {
  ...en,
  tagline: 'A Escritura, e alguém para lê-la com você.',
  signIn: 'Entrar',
  signUp: 'Criar conta',
  signOut: 'Sair',
  email: 'E-mail',
  password: 'Senha',
  displayName: 'Seu nome',
  language: 'Idioma',
  createAccount: 'Criar conta',
  chat: 'Conversar',
  comfort: 'Conforto',
  counselors: 'Conselheiros',
  profile: 'Perfil',
  newConversation: 'Nova conversa',
  askAnything: 'Diga qualquer coisa…',
  send: 'Enviar',
  scripture: 'Escritura',
  reflection: 'Reflexão',
  prayer: 'Uma oração',
  findComfort: 'Buscar conforto',
  crisisTitle: 'Por favor procure um destes agora',
};

const fr: Dict = {
  ...en,
  tagline: "L'Écriture, et quelqu'un avec qui la lire.",
  signIn: 'Se connecter',
  signUp: "S'inscrire",
  signOut: 'Se déconnecter',
  email: 'E-mail',
  password: 'Mot de passe',
  displayName: 'Votre nom',
  language: 'Langue',
  createAccount: 'Créer un compte',
  chat: 'Discuter',
  comfort: 'Réconfort',
  counselors: 'Conseillers',
  profile: 'Profil',
  newConversation: 'Nouvelle conversation',
  askAnything: 'Dites ce que vous voulez…',
  send: 'Envoyer',
  scripture: 'Écriture',
  reflection: 'Réflexion',
  prayer: 'Une prière',
  findComfort: 'Chercher du réconfort',
  crisisTitle: "Contactez l'un de ces services maintenant",
};

const DICTS: Record<string, Dict> = { en, es, pt, fr };

export function dictFor(languageCode: string): Dict {
  return DICTS[languageCode] ?? en;
}

export function isRtl(languageCode: string): boolean {
  return getLanguage(languageCode).rtl;
}
