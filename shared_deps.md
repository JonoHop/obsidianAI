# Plan

## File Structure

The Obsidian plugin will be organized as follows:

- `main.ts` : This is the entry point of the plugin. This file will contain the `onload` and `onunload` functions that obsidian plugins require. It will also contain code to register the context menu actions and the settings tab.
- `summary.ts` : This file will contain the logic for generating a summary of a note and saving it into the `/Summaries` folder.
- `recording.ts` : This file will handle the recording of meetings and the transcription of the audio. It will also contain the logic for generating a summary of the meeting and saving it into the `/Meetings` folder.
- `settings.ts` : This file will handle the settings of the plugin. It will allow the user to configure the folders used by the plugin and the API keys for OpenAI or AssemblyAI.
- `manifest.json` : This is a configuration file required by obsidian plugins. It will specify the main script file (`main.ts`) and the version of the plugin.

## Variables

The following are the variables that the plugin will use:

- `defaultFolders`: This object will contain the default paths for the folders used by the plugin.
- `settings`: This object will contain the user-configured paths for the folders and the API keys for OpenAI or AssemblyAI.
- `summaryContent`: This string will contain the generated summary of a note or a meeting.
- `selectedText`: This string will contain the text selected by the user for summary generation.

## Data Schemas

The settings of the plugin will be stored in a JSON file with the following schema:

```json
{
  "peopleFolder": "string",
  "meetingsFolder": "string",
  "projectsFolder": "string",
  "mocFolder": "string",
  "summariesFolder": "string",
  "fallbackMOC": "string",
  "openAIKey": "string",
  "assemblyAIKey": "string",
  "transcriptionSettings": {
    "language": "string",
    "accuracySpeed": "string"
  }
}
```

## Function Names

The following are the function names that will be used in the plugin:

- `loadSettings`: This function will load the settings from the JSON file.
- `saveSettings`: This function will save the settings to the JSON file.
- `generateSummary`: This function will generate a summary of a note or a meeting.
- `saveSummary`: This function will save the generated summary into the `/Summaries` or `/Meetings` folder.
- `startRecording`: This function will start the recording of a meeting.
- `stopRecording`: This function will stop the recording of a meeting.
- `transcribeAudio`: This function will transcribe the recorded audio.
- `identifyPeople`: This function will identify people mentioned in a note or a meeting.
- `classifyTopics`: This function will classify the topics of a note or a meeting.

## DOM Elements

The plugin will use the following DOM elements:

- `contextMenu`: This is the context menu that appears when the user right-clicks a note or a meeting.
- `categorizeSummarize`: This is the menu item for generating a summary of a note or a meeting.
- `recordMeeting`: This is the menu item for starting the recording of a meeting.

## Message Names

The plugin will use the following message names:

- `summaryGenerated`: This message will be sent when a summary is generated.
- `recordingStarted`: This message will be sent when a meeting recording is started.
- `recordingStopped`: This message will be sent when a meeting recording is stopped.
- `transcriptionCompleted`: This message will be sent when the transcription of a meeting is completed.
- `peopleIdentified`: This message will be sent when people are identified in a note or a meeting.
- `topicsClassified`: This message will be sent when the topics of a note or a meeting are classified.