import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
import ObsidianAiPlugin from './main';

export interface ObsidianAIPluginSettings {
  peopleFolder: string;
  meetingsFolder: string;
  projectsFolder: string;
  mocFolder: string;
  summariesFolder: string;
  fallbackMOC: string;
  assemblyAIKey: string;
  transcriptionSettings: {
    language: string;
    accuracySpeed: string;
  };
  audioFolderPath: string;
  transcriptionFolderPath: string;
  openAIKey?: string; // Legacy compatibility
  openAiApiKey: string;
  openAiModel: string;
  openAiApiBaseUrl: string;
  autoSummarise: boolean;
}

export const DEFAULT_SETTINGS: ObsidianAIPluginSettings = {
  peopleFolder: 'People/',
  meetingsFolder: 'Meetings/',
  projectsFolder: 'Projects/',
  mocFolder: 'MOCs/',
  summariesFolder: 'Summaries/',
  fallbackMOC: 'MOCs/Miscellaneous.md',
  assemblyAIKey: '',
  transcriptionSettings: {
    language: 'en-US',
    accuracySpeed: 'balanced',
  },
  audioFolderPath: 'Audio',
  transcriptionFolderPath: 'Transcriptions',
  openAIKey: '',
  openAiApiKey: '',
  openAiModel: 'gpt-4.1-mini',
  openAiApiBaseUrl: 'https://api.openai.com/v1',
  autoSummarise: true,
};

export async function loadSettings(plugin: Plugin): Promise<ObsidianAIPluginSettings> {
  const stored = await plugin.loadData();
  const merged = Object.assign({}, DEFAULT_SETTINGS, stored);

  // Preserve legacy key if the new one has not been set.
  if (!merged.openAiApiKey && merged.openAIKey) {
    merged.openAiApiKey = merged.openAIKey;
  }

  return merged;
}

export async function saveSettings(plugin: Plugin, settings: ObsidianAIPluginSettings): Promise<void> {
  await plugin.saveData(settings);
}

export class ObsidianAISettingTab extends PluginSettingTab {
  plugin: ObsidianAiPlugin;

  constructor(app: App, plugin: ObsidianAiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Recording & Storage' });
    this.addTextSetting(
      containerEl,
      'Audio folder path',
      'Folder in this vault where audio recordings are stored',
      'audioFolderPath',
      'Audio'
    );
    this.addTextSetting(
      containerEl,
      'Transcription folder path',
      'Folder where transcription notes will be created',
      'transcriptionFolderPath',
      'Transcriptions'
    );

    containerEl.createEl('h2', { text: 'AssemblyAI' });
    new Setting(containerEl)
      .setName('AssemblyAI API key')
      .setDesc('Required for sending recordings to AssemblyAI for transcription')
      .addText((text) => {
        text.setPlaceholder('Paste AssemblyAI key')
          .setValue(this.plugin.settings.assemblyAIKey || '')
          .onChange(async (value) => {
            this.plugin.settings.assemblyAIKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    new Setting(containerEl)
      .setName('Transcription language')
      .setDesc('Language code sent to AssemblyAI (e.g., en-US)')
      .addText((text) =>
        text
          .setPlaceholder('en-US')
          .setValue(this.plugin.settings.transcriptionSettings.language)
          .onChange(async (value) => {
            this.plugin.settings.transcriptionSettings.language = value.trim() || 'en-US';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Transcription accuracy vs speed')
      .setDesc('Balanced setting is recommended; tweak if you prefer speed')
      .addDropdown((dropdown) => {
        dropdown.addOption('balanced', 'Balanced');
        dropdown.addOption('accurate', 'Accurate');
        dropdown.addOption('fast', 'Fast');
        dropdown.setValue(this.plugin.settings.transcriptionSettings.accuracySpeed);
        dropdown.onChange(async (value) => {
          this.plugin.settings.transcriptionSettings.accuracySpeed = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl('h2', { text: 'OpenAI' });
    new Setting(containerEl)
      .setName('OpenAI API key')
      .setDesc('Used to generate AI meeting summaries')
      .addText((text) => {
        text
          .setPlaceholder('Paste OpenAI key')
          .setValue(this.plugin.settings.openAiApiKey || '')
          .onChange(async (value) => {
            this.plugin.settings.openAiApiKey = value.trim();
            await this.plugin.saveSettings();
          });
        text.inputEl.type = 'password';
      });

    new Setting(containerEl)
      .setName('OpenAI model')
      .setDesc('Model name to use for meeting summaries')
      .addText((text) =>
        text
          .setPlaceholder('gpt-4.1-mini')
          .setValue(this.plugin.settings.openAiModel)
          .onChange(async (value) => {
            this.plugin.settings.openAiModel = value.trim() || 'gpt-4.1-mini';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('OpenAI API base URL')
      .setDesc('Override the base URL if you are using a compatible proxy')
      .addText((text) =>
        text
          .setPlaceholder('https://api.openai.com/v1')
          .setValue(this.plugin.settings.openAiApiBaseUrl)
          .onChange(async (value) => {
            this.plugin.settings.openAiApiBaseUrl = value.trim() || 'https://api.openai.com/v1';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Auto summarise meetings')
      .setDesc('When enabled, meeting transcripts are sent to OpenAI for automatic summaries')
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoSummarise);
        toggle.onChange(async (value) => {
          this.plugin.settings.autoSummarise = value;
          await this.plugin.saveSettings();
        });
      });

    containerEl.createEl('h2', { text: 'Legacy folders' });
    this.addTextSetting(containerEl, 'People folder', 'Optional legacy setting', 'peopleFolder', 'People/');
    this.addTextSetting(containerEl, 'Meetings folder', 'Optional legacy setting', 'meetingsFolder', 'Meetings/');
    this.addTextSetting(containerEl, 'Projects folder', 'Optional legacy setting', 'projectsFolder', 'Projects/');
    this.addTextSetting(containerEl, 'MOC folder', 'Optional legacy setting', 'mocFolder', 'MOCs/');
    this.addTextSetting(containerEl, 'Summaries folder', 'Used by note summaries', 'summariesFolder', 'Summaries/');
    this.addTextSetting(containerEl, 'Fallback MOC', 'Used by note summaries', 'fallbackMOC', 'MOCs/Miscellaneous.md');
  }

  private addTextSetting(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    key: keyof ObsidianAIPluginSettings,
    placeholder: string,
  ) {
    new Setting(containerEl)
      .setName(name)
      .setDesc(desc)
      .addText((text) =>
        text
          .setPlaceholder(placeholder)
          .setValue(String(this.plugin.settings[key] || ''))
          .onChange(async (value) => {
            // @ts-ignore - dynamic assignment
            this.plugin.settings[key] = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
