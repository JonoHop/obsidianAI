import { Plugin } from 'obsidian';
import { loadSettings, saveSettings } from './settings';
import { generateSummary, saveSummary } from './summary';
import { startRecording, stopRecording, transcribeAudio } from './recording';

export default class ObsidianAiPlugin extends Plugin {
  settings = {
    peopleFolder: "People/",
    meetingsFolder: "Meetings/",
    projectsFolder: "Projects/",
    mocFolder: "MOCs/",
    summariesFolder: "Summaries/",
    fallbackMOC: "MOCs/Miscellaneous.md",
    openAIKey: "",
    assemblyAIKey: "",
    transcriptionSettings: {
      language: "en",
      accuracySpeed: "high"
    }
  };

  async onload() {
    await this.loadSettings();

    // Register context menu actions
    this.registerEvent(
      this.app.workspace.on('file-menu', (menu, file) => {
        menu.addItem((item) => {
          item.setTitle('Categorize and Summarize')
            .setIcon('dot-network')
            .onClick(async () => {
              const summaryContent = await generateSummary(file, this.settings);
              saveSummary(summaryContent, this.settings.summariesFolder);
            });
        });

        menu.addItem((item) => {
          item.setTitle('Record Meeting')
            .setIcon('microphone')
            .onClick(async () => {
              startRecording();
              this.registerEvent(this.app.workspace.on('app:unload', stopRecording));
            });
        });
      })
    );

    // Register settings tab
    this.addSettingTab(new ObsidianAiSettingTab(this.app, this));
  }

  async onunload() {
    console.log('unloading plugin');
  }

  async loadSettings() {
    const loadedSettings = await loadSettings();
    if (loadedSettings) {
      this.settings = loadedSettings;
    }
  }

  async saveSettings() {
    await saveSettings(this.settings);
  }
}

class ObsidianAiSettingTab extends PluginSettingTab {
  plugin: ObsidianAiPlugin;

  constructor(app: App, plugin: ObsidianAiPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    let { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Settings for Obsidian AI Plugin' });

    new Setting(containerEl)
      .setName('People folder')
      .setDesc('The folder where people notes are stored.')
      .addText(text => text
        .setPlaceholder('Enter folder name')
        .setValue(this.plugin.settings.peopleFolder)
        .onChange(async (value) => {
          this.plugin.settings.peopleFolder = value;
          await this.plugin.saveSettings();
        }));

    // Additional settings can be added here following the same pattern
  }
}
