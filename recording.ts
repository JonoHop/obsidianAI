import axios from 'axios';
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { ObsidianAIPluginSettings } from './settings';
import { generateMeetingSummary } from './summary';

export interface ActiveRecordingSession {
  parentFile?: TFile;
  startedAt: Date;
  audioFilePath?: string;
  isPaused?: boolean;
  pauseStartedAt?: number;
  totalPausedMs?: number;
}

export interface TranscriptionResult {
  text: string;
  utterances: Utterance[];
}

export interface Utterance {
  start?: number;
  speaker?: string;
  text?: string;
}

export class RecordingManager {
  private app: App;
  private getSettings: () => ObsidianAIPluginSettings;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private currentStream: MediaStream | null = null;
  private session: ActiveRecordingSession | null = null;
  private recordingPanel: RecordingStatusPanel | null = null;

  constructor(app: App, getSettings: () => ObsidianAIPluginSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }

  public get isRecording(): boolean {
    return !!this.session;
  }

  public async startRecording(parentFile?: TFile): Promise<void> {
    if (this.session) {
      new Notice('Recording already in progress.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.currentStream = stream;
      this.mediaRecorder = new MediaRecorder(stream);
      this.chunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };

      this.mediaRecorder.start();
      this.session = { parentFile, startedAt: new Date(), totalPausedMs: 0, isPaused: false };
      this.openRecordingPanel();
      new Notice('Recording started. Click the mic again or run stop command to finish.');
    } catch (error) {
      console.error('Failed to start recording', error);
      new Notice('Unable to access microphone. Please check permissions.');
      this.cleanupStream();
    }
  }

  public async stopRecording(): Promise<void> {
    if (!this.session || !this.mediaRecorder) {
      this.closeRecordingPanel();
      new Notice('No recording is currently running.');
      return;
    }

    const session = this.session;
    this.session = null;
    this.closeRecordingPanel();

    const audioBlob = await this.collectAudioBlob();
    this.cleanupStream();

    let audioFilePath: string | undefined;
    try {
      audioFilePath = await this.saveAudioFile(audioBlob, session.startedAt);
    } catch (error) {
      console.error('Failed to save audio', error);
      new Notice('Could not save audio file; continuing with transcription.');
    }

    const transcription = await this.transcribeAudio(audioBlob);
    if (!transcription) {
      new Notice('Transcription failed or skipped. Audio saved if possible.');
      return;
    }

    const noteFile = await this.createTranscriptionNote(transcription, session.parentFile, audioFilePath, session.startedAt);
    if (noteFile && session.parentFile) {
      await this.appendLinkToParent(session.parentFile, noteFile);
    }

    if (noteFile) {
      await this.appendMeetingSummary(noteFile, transcription);
    }

    new Notice('Recording complete. Transcription note created.');
  }

  private collectAudioBlob(): Promise<Blob> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(new Blob());
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        this.chunks = [];
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  private cleanupStream(): void {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach((track) => track.stop());
    }
    this.currentStream = null;
    this.mediaRecorder = null;
  }

  private pauseRecording(): void {
    if (!this.mediaRecorder || !this.session || this.session.isPaused) return;
    try {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      this.session.isPaused = true;
      this.session.pauseStartedAt = Date.now();
      this.recordingPanel?.setPaused(true);
    } catch (error) {
      console.error('Failed to pause recording', error);
    }
  }

  private resumeRecording(): void {
    if (!this.mediaRecorder || !this.session || !this.session.isPaused) return;
    try {
      if (this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }

      if (this.session.pauseStartedAt) {
        const pausedDuration = Date.now() - this.session.pauseStartedAt;
        this.session.totalPausedMs = (this.session.totalPausedMs || 0) + pausedDuration;
      }

      this.session.pauseStartedAt = undefined;
      this.session.isPaused = false;
      this.recordingPanel?.setPaused(false);
    } catch (error) {
      console.error('Failed to resume recording', error);
    }
  }

  private getElapsedRecordingMs(): number {
    if (!this.session) return 0;
    const started = this.session.startedAt.getTime();
    const pausedAlready = this.session.totalPausedMs || 0;
    const currentPause = this.session.isPaused && this.session.pauseStartedAt ? Date.now() - this.session.pauseStartedAt : 0;
    return Math.max(0, Date.now() - started - pausedAlready - currentPause);
  }

  private openRecordingPanel(): void {
    this.closeRecordingPanel();
    this.recordingPanel = new RecordingStatusPanel(this.app, {
      onStop: () => this.stopRecording(),
      onPause: () => this.pauseRecording(),
      onResume: () => this.resumeRecording(),
      getElapsedMs: () => this.getElapsedRecordingMs(),
      isPaused: () => !!this.session?.isPaused,
    });
    this.recordingPanel.open();
  }

  private closeRecordingPanel(): void {
    if (this.recordingPanel) {
      this.recordingPanel.close();
      this.recordingPanel = null;
    }
  }

  private async saveAudioFile(blob: Blob, startedAt: Date): Promise<string> {
    const settings = this.getSettings();
    const folder = normalizePath(settings.audioFolderPath || 'Audio');
    await ensureFolderExists(this.app, folder);

    // Persist the raw audio in the vault so it can be linked from the transcript note.
    const timestamp = formatDateForFilename(startedAt);
    const fileName = `${timestamp}_meeting-audio.webm`;
    const path = await uniquePath(this.app, normalizePath(`${folder}/${fileName}`));

    const arrayBuffer = await blob.arrayBuffer();
    await this.app.vault.createBinary(path, arrayBuffer);
    return path;
  }

  private async transcribeAudio(blob: Blob): Promise<TranscriptionResult | null> {
    const settings = this.getSettings();
    const apiKey = settings.assemblyAIKey;
    if (!apiKey) {
      new Notice('AssemblyAI API key missing; skipping transcription.');
      return null;
    }

    try {
      const uploadUrl = await uploadAudio(blob, apiKey);
      const transcriptId = await requestTranscript(uploadUrl, settings);
      const transcript = await waitForTranscript(transcriptId, apiKey);
      return transcript;
    } catch (error) {
      const response = (error as any)?.response;
      const status = response?.status;
      const data = response?.data;
      console.error('AssemblyAI transcription failed', { status, data, error });
      new Notice(`Transcription failed: ${data?.error || status || 'see console for details'}`);
      return null;
    }
  }

  private async createTranscriptionNote(
    transcript: TranscriptionResult,
    parentFile: TFile | undefined,
    audioFilePath: string | undefined,
    startedAt: Date,
  ): Promise<TFile | null> {
    const settings = this.getSettings();
    const folder = normalizePath(settings.transcriptionFolderPath || 'Transcriptions');
    await ensureFolderExists(this.app, folder);

    // Build the transcription note (frontmatter, audio link, and formatted transcript).
    const parentName = parentFile ? parentFile.basename : 'Meeting';
    const filename = `${parentName} - Meeting Transcript ${formatReadableDate(startedAt)}.md`;
    const sanitizedName = sanitizeFileName(filename);
    const notePath = await uniquePath(this.app, normalizePath(`${folder}/${sanitizedName}`));

    const formattedTranscript = formatTranscript(transcript);
    const frontmatter = buildFrontmatter(parentFile, audioFilePath, startedAt);
    const audioLink = audioFilePath ? `**Audio:** [[${basename(audioFilePath)}]]\n\n` : '';

    const content = `${frontmatter}\n${audioLink}## Transcript\n\n${formattedTranscript}`;

    const note = await this.app.vault.create(notePath, content);
    return note;
  }

  private async appendLinkToParent(parentFile: TFile, transcriptionFile: TFile): Promise<void> {
    const link = `[[${transcriptionFile.basename}]]`;
    const content = await this.app.vault.read(parentFile);

    if (content.includes(link)) {
      return;
    }

    let updated = content;
    if (!content.match(/###\s+Recording/)) {
      updated += '\n\n### Recording\n\n';
    } else {
      updated += '\n';
    }

    updated += `- ${link}\n`;
    await this.app.vault.modify(parentFile, updated);
  }

  private async appendMeetingSummary(noteFile: TFile, transcript: TranscriptionResult): Promise<void> {
    const settings = this.getSettings();
    const transcriptText = formatTranscript(transcript);
    const summary = await generateMeetingSummary(transcriptText, settings, transcript.utterances.length > 0);
    if (!summary) return;

    // Attach the AI-generated meeting summary beneath the saved transcript.
    const content = await this.app.vault.read(noteFile);
    if (content.includes('## AI Meeting Summary')) return;

    const updated = `${content}\n\n## AI Meeting Summary\n\n${summary}\n`;
    await this.app.vault.modify(noteFile, updated);
  }
}

async function uploadAudio(blob: Blob, apiKey: string): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const response = await axios.post('https://api.assemblyai.com/v2/upload', arrayBuffer, {
    headers: {
      authorization: apiKey,
      'content-type': 'application/octet-stream',
    },
    maxBodyLength: Infinity,
  });

  if (!response.data?.upload_url) {
    throw new Error('AssemblyAI did not return an upload URL.');
  }

  return response.data.upload_url;
}

async function requestTranscript(uploadUrl: string, settings: ObsidianAIPluginSettings): Promise<string> {
  const transcriptionSettings = settings.transcriptionSettings || {};

  let language = (transcriptionSettings.language || '').trim();
  if (!language) {
    language = 'en_us';
  } else {
    language = language.toLowerCase().replace(/-/g, '_');
  }

  const body = {
    audio_url: uploadUrl,
    speaker_labels: true,
    language_code: language,
    punctuate: true,
    format_text: true,
    dual_channel: false,
    // enable disfluencies only if we're in "accurate" mode
    disfluencies: transcriptionSettings.accuracySpeed === 'accurate',
  };

  const response = await axios.post(
    'https://api.assemblyai.com/v2/transcript',
    body,
    {
      headers: {
        authorization: settings.assemblyAIKey,
        'content-type': 'application/json',
      },
    },
  );

  if (!response.data?.id) {
    console.error('AssemblyAI transcript response missing id', response.data);
    throw new Error('AssemblyAI did not return a transcript id.');
  }

  return response.data.id;
}


async function waitForTranscript(transcriptId: string, apiKey: string): Promise<TranscriptionResult> {
  const url = `https://api.assemblyai.com/v2/transcript/${transcriptId}`;
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await axios.get(url, {
      headers: {
        authorization: apiKey,
      },
    });

    const data = response.data;
    console.log('AssemblyAI poll', { attempt, status: data.status });

    if (data.status === 'completed') {
      return {
        text: data.text || '',
        utterances: (data.utterances || []) as Utterance[],
      };
    }

    if (data.status === 'error') {
      console.error('AssemblyAI returned error', data);
      throw new Error(data.error || 'AssemblyAI returned an error.');
    }

    await delay(3000);
  }

  throw new Error('Transcription timed out.');
}

class RecordingStatusPanel {
  private app: App;
  private onStop: () => void;
  private onPause: () => void;
  private onResume: () => void;
  private getElapsedMs: () => number;
  private isPausedFn: () => boolean;
  private timerId: number | null = null;
  private containerEl: HTMLElement | null = null;
  private timerEl!: HTMLElement;
  private statusEl!: HTMLElement;
  private pauseButton!: HTMLButtonElement;
  private stopButton!: HTMLButtonElement;
  private indicatorEl!: HTMLElement;

  constructor(
    app: App,
    options: {
      onStop: () => void;
      onPause: () => void;
      onResume: () => void;
      getElapsedMs: () => number;
      isPaused: () => boolean;
    },
  ) {
    this.app = app;
    this.onStop = options.onStop;
    this.onPause = options.onPause;
    this.onResume = options.onResume;
    this.getElapsedMs = options.getElapsedMs;
    this.isPausedFn = options.isPaused;
  }

  open(): void {
    if (this.containerEl) {
      this.close();
    }

    const doc = this.app.workspace.containerEl.ownerDocument;
    const container = doc.createElement('div');
    container.style.position = 'fixed';
    container.style.bottom = '16px';
    container.style.right = '16px';
    container.style.zIndex = '1000';
    container.style.backgroundColor = 'var(--background-primary)';
    container.style.border = '1px solid var(--background-modifier-border)';
    container.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
    container.style.borderRadius = '10px';
    container.style.padding = '12px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '10px';
    container.style.minWidth = '240px';
    container.style.pointerEvents = 'auto';

    const header = container.createDiv();
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '8px';

    this.indicatorEl = header.createDiv();
    this.indicatorEl.style.width = '12px';
    this.indicatorEl.style.height = '12px';
    this.indicatorEl.style.borderRadius = '50%';

    this.statusEl = header.createDiv();
    this.statusEl.style.fontWeight = '600';
    this.statusEl.style.fontSize = '15px';

    this.timerEl = container.createDiv();
    this.timerEl.style.fontFamily = 'monospace';
    this.timerEl.style.fontSize = '18px';

    const buttons = container.createDiv();
    buttons.style.display = 'flex';
    buttons.style.gap = '8px';
    buttons.style.justifyContent = 'flex-end';

    this.pauseButton = buttons.createEl('button', { text: 'Pause' });
    this.pauseButton.style.minWidth = '80px';
    this.pauseButton.onclick = () => this.handlePauseResume();

    this.stopButton = buttons.createEl('button', { text: 'Stop' });
    this.stopButton.style.minWidth = '80px';
    this.stopButton.style.backgroundColor = '#e63946';
    this.stopButton.style.color = '#ffffff';
    this.stopButton.onclick = () => this.handleStop();

    doc.body.appendChild(container);
    this.containerEl = container;

    this.refreshState();
    this.updateTimerDisplay();
    this.timerId = window.setInterval(() => this.updateTimerDisplay(), 500);
  }

  close(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.containerEl) {
      this.containerEl.detach();
      this.containerEl = null;
    }
  }

  public setPaused(paused: boolean): void {
    this.refreshState(paused);
  }

  private refreshState(paused: boolean = this.isPausedFn()): void {
    this.statusEl?.setText(paused ? 'Paused' : 'Recording');
    if (this.pauseButton) {
      this.pauseButton.setText(paused ? 'Resume' : 'Pause');
    }
    if (this.indicatorEl) {
      this.indicatorEl.style.backgroundColor = paused ? '#b32d2d' : '#e63946';
      this.indicatorEl.style.boxShadow = paused
        ? '0 0 6px rgba(230, 57, 70, 0.45)'
        : '0 0 12px rgba(230, 57, 70, 0.75)';
    }
  }

  private updateTimerDisplay(): void {
    if (!this.timerEl) return;
    const elapsed = this.getElapsedMs();
    this.timerEl.setText(formatTimestamp(elapsed));
  }

  private handlePauseResume(): void {
    if (this.isPausedFn()) {
      this.onResume();
    } else {
      this.onPause();
    }
    this.refreshState();
  }

  private handleStop(): void {
    this.pauseButton?.setAttribute('disabled', 'true');
    this.stopButton?.setAttribute('disabled', 'true');
    this.onStop();
    this.close();
  }
}


function formatTranscript(result: TranscriptionResult): string {
  if (result.utterances && result.utterances.length > 0) {
    const speakerMap = new Map<string, number>();
    let nextSpeakerNumber = 1;

    return result.utterances
      .map((utterance) => {
        if (!utterance.text) return null;
        const parts: string[] = [];

        if (typeof utterance.start === 'number') {
          parts.push(`[${formatTimestamp(utterance.start)}]`);
        }

        if (utterance.speaker) {
          if (!speakerMap.has(utterance.speaker)) {
            speakerMap.set(utterance.speaker, nextSpeakerNumber++);
          }
          const label = speakerMap.get(utterance.speaker);
          parts.push(`**Speaker ${label}:**`);
        }

        parts.push(utterance.text.trim());
        return parts.join(' ');
      })
      .filter(Boolean)
      .join('\n');
  }

  return result.text || '';
}

function buildFrontmatter(parentFile: TFile | undefined, audioFilePath: string | undefined, startedAt: Date): string {
  const lines = ['---', 'type: meeting-transcript'];

  if (parentFile) {
    lines.push(`source_note: [[${parentFile.basename}]]`);
  }

  if (audioFilePath) {
    lines.push(`audio_file: [[${basename(audioFilePath)}]]`);
  }

  lines.push(`created: ${startedAt.toISOString()}`);
  lines.push('---');

  return lines.join('\n');
}

async function ensureFolderExists(app: App, folder: string): Promise<void> {
  const normalized = normalizePath(folder);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (!existing) {
    await app.vault.createFolder(normalized);
  }
}

async function uniquePath(app: App, initialPath: string): Promise<string> {
  let candidate = initialPath;
  let counter = 1;

  while (app.vault.getAbstractFileByPath(candidate)) {
    const parts = candidate.split('.');
    const ext = parts.pop();
    const base = parts.join('.');
    candidate = `${base}-${counter}.${ext}`;
    counter++;
  }

  return candidate;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  const second = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

function formatReadableDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}.${minute}`;
}

function sanitizeFileName(name: string): string {
  return name.replace(/[\\/:"*?<>|]+/g, '').trim();
}

function basename(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
