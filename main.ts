import { Notice, Plugin, TFile } from 'obsidian';
import { RecordingManager } from './recording';
import {
  ObsidianAIPluginSettings,
  ObsidianAISettingTab,
  loadSettings,
  saveSettings,
} from './settings';
import { generateSummaryForFile, saveSummary } from './summary';

export default class ObsidianAiPlugin extends Plugin {
  settings!: ObsidianAIPluginSettings;
  recordingManager!: RecordingManager;

  async onload() {
    await this.loadSettings();
    this.recordingManager = new RecordingManager(this.app, () => this.settings);

    this.addRibbonIcon('microphone', 'Start meeting recording (global)', async () => {
      if (this.recordingManager.isRecording) {
        await this.recordingManager.stopRecording();
      } else {
        await this.recordingManager.startRecording();
      }
    });

    this.addCommand({
      id: 'obsidian-ai:start-meeting-recording',
      name: 'Start meeting recording (global)',
      callback: () => this.startGlobalRecording(),
    });

    this.addCommand({
      id: 'obsidian-ai:stop-meeting-recording',
      name: 'Stop meeting recording',
      callback: () => this.recordingManager.stopRecording(),
    });

    this.addCommand({
      id: 'obsidian-ai:start-recording-for-current-note',
      name: 'Start recording for current note',
      callback: () => this.startRecordingForActiveFile(),
    });

    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        if (!(file instanceof TFile)) return;

        menu.addItem((item) => {
          item
            .setTitle('Categorize and Summarize')
            .setIcon('dot-network')
            .onClick(async () => {
              const summaryContent = await generateSummaryForFile(this.app, file, this.settings);
              await saveSummary(this.app, summaryContent, this.settings.summariesFolder, file.basename);
              new Notice('Summary saved.');
            });
        });

        menu.addItem((item) => {
          item
            .setTitle('Record Meeting')
            .setIcon('microphone')
            .onClick(async () => {
              if (this.recordingManager.isRecording) {
                new Notice('Recording already in progress.');
                return;
              }
              await this.recordingManager.startRecording(file);
            });
        });
      }),
    );

    this.addSettingTab(new ObsidianAISettingTab(this.app, this));
  }

  async onunload() {
    if (this.recordingManager.isRecording) {
      await this.recordingManager.stopRecording();
    }
  }

  async startGlobalRecording(): Promise<void> {
    if (this.recordingManager.isRecording) {
      new Notice('Recording already in progress.');
      return;
    }
    await this.recordingManager.startRecording();
  }

  async startRecordingForActiveFile(): Promise<void> {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile) {
      new Notice('No active file. Open a note before starting a recording.');
      return;
    }

    if (this.recordingManager.isRecording) {
      new Notice('Recording already in progress.');
      return;
    }

    await this.recordingManager.startRecording(activeFile);
  }

  async loadSettings(): Promise<void> {
    this.settings = await loadSettings(this);
  }

  async saveSettings(): Promise<void> {
    await saveSettings(this, this.settings);
  }
}
