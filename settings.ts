import { PluginSettingTab, App, Setting } from 'obsidian';
import { Plugin } from 'obsidian';

export interface ObsidianAIPluginSettings {
  peopleFolder: string;
  meetingsFolder: string;
  projectsFolder: string;
  mocFolder: string;
  summariesFolder: string;
  fallbackMOC: string;
  openAIKey: string;
  assemblyAIKey: string;
  transcriptionSettings: {
    language: string;
    accuracySpeed: string;
  };
}

export const DEFAULT_SETTINGS: ObsidianAIPluginSettings = {
  peopleFolder: "People/",
  meetingsFolder: "Meetings/",
  projectsFolder: "Projects/",
  mocFolder: "MOCs/",
  summariesFolder: "Summaries/",
  fallbackMOC: "MOCs/Miscellaneous.md",
  openAIKey: "",
  assemblyAIKey: "",
  transcriptionSettings: {
    language: "en-US",
    accuracySpeed: "balanced"
  }
};

export class ObsidianAISettingTab extends PluginSettingTab {
  plugin: any;

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let {containerEl} = this;
    containerEl.empty();
    containerEl.createEl('h2', {text: 'Settings for AI Plugin'});
    
    this.addFolderSetting(containerEl, 'People Folder', 'peopleFolder');
    this.addFolderSetting(containerEl, 'Meetings Folder', 'meetingsFolder');
    this.addFolderSetting(containerEl, 'Projects Folder', 'projectsFolder');
    this.addFolderSetting(containerEl, 'MOC Folder', 'mocFolder');
    this.addFolderSetting(containerEl, 'Summaries Folder', 'summariesFolder');
    this.addFolderSetting(containerEl, 'Fallback MOC', 'fallbackMOC');

    new Setting(containerEl)
      .setName('OpenAI Key')
      .setDesc('API Key for OpenAI')
      .addText(text => text
        .setPlaceholder('Enter your OpenAI Key here')
        .setValue(this.plugin.settings.openAIKey || '')
        .onChange(async (value) => {
          this.plugin.settings.openAIKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('AssemblyAI Key')
      .setDesc('API Key for AssemblyAI')
      .addText(text => text
        .setPlaceholder('Enter your AssemblyAI Key here')
        .setValue(this.plugin.settings.assemblyAIKey || '')
        .onChange(async (value) => {
          this.plugin.settings.assemblyAIKey = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Transcription Language')
      .setDesc('Language for Transcription')
      .addDropdown(dropdown => {
        dropdown.addOption('en-US', 'English (United States)');
        // Add other languages here
        dropdown.setValue(this.plugin.settings.transcriptionSettings.language);
        dropdown.onChange(async (value) => {
          this.plugin.settings.transcriptionSettings.language = value;
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName('Transcription Accuracy vs Speed')
      .setDesc('Choose between more accurate transcription or faster transcription')
      .addDropdown(dropdown => {
        dropdown.addOption('accurate', 'Accurate');
        dropdown.addOption('fast', 'Fast');
        dropdown.setValue(this.plugin.settings.transcriptionSettings.accuracySpeed);
        dropdown.onChange(async (value) => {
          this.plugin.settings.transcriptionSettings.accuracySpeed = value;
          await this.plugin.saveSettings();
        });
      });
  }

  addFolderSetting(containerEl: HTMLElement, name: string, key: keyof ObsidianAIPluginSettings): void {
    new Setting(containerEl)
      .setName(name)
      .addText(text => text
        .setPlaceholder('Enter folder path here')
        .setValue(this.plugin.settings[key] || '')
        .onChange(async (value) => {
          this.plugin.settings[key] = value;
          await this.plugin.saveSettings();
        }));
  }
}


// Load settings from disk
export async function loadSettings(plugin: Plugin): Promise<ObsidianAIPluginSettings> {
  return Object.assign({}, DEFAULT_SETTINGS, await plugin.loadData());
}

// Save settings to disk
export async function saveSettings(plugin: Plugin, settings: ObsidianAIPluginSettings): Promise<void> {
  await plugin.saveData(settings);
}
