import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/** Voice notes for transcription, not music — HIGH_QUALITY's m4a/AAC is plenty. */
const RECORDING_OPTIONS = Audio.RecordingOptionsPresets.HIGH_QUALITY;

/** Confirmed against the live Gemini API: it sniffs the container regardless
 * of this label, and "audio/aac" is one of Gemini's documented audio types. */
export const RECORDING_MIME_TYPE = 'audio/aac';

/**
 * expo-av's web shim records through MediaRecorder using the preset's `.web`
 * config (RecordingConstants.ts), which is hardcoded to audio/webm — not the
 * native m4a/AAC container declared above.
 */
const WEB_RECORDING_MIME_TYPE = 'audio/webm';

/**
 * expo-file-system has no web implementation (ExponentFileSystemShim is a
 * stub — see node_modules/expo-file-system/src/ExponentFileSystemShim.ts),
 * so readAsStringAsync throws there. On web, recording.getURI() is a
 * blob: URL instead of a native file path anyway, so fetch it directly and
 * convert via FileReader.
 */
async function blobUriToBase64(uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read recording blob.'));
    reader.readAsDataURL(blob);
  });
}

export class MicPermissionError extends Error {
  constructor() {
    super('Microphone permission was not granted.');
    this.name = 'MicPermissionError';
  }
}

export interface ActiveRecording {
  /** Stops recording and returns the clip as base64, ready to POST. */
  stop(): Promise<{ base64: string; mimeType: string }>;
  /** Stops and discards — used when the user cancels mid-recording. */
  cancel(): Promise<void>;
}

export async function startRecording(): Promise<ActiveRecording> {
  const permission = await Audio.getPermissionsAsync();
  if (!permission.granted) {
    const requested = await Audio.requestPermissionsAsync();
    if (!requested.granted) throw new MicPermissionError();
  }

  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

  const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);

  const teardown = async () => {
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  };

  return {
    async stop() {
      await recording.stopAndUnloadAsync();
      await teardown();
      const uri = recording.getURI();
      if (!uri) throw new Error('Recording produced no file.');
      if (Platform.OS === 'web') {
        return { base64: await blobUriToBase64(uri), mimeType: WEB_RECORDING_MIME_TYPE };
      }
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return { base64, mimeType: RECORDING_MIME_TYPE };
    },
    async cancel() {
      await recording.stopAndUnloadAsync().catch(() => {});
      await teardown();
    },
  };
}
