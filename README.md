# Obsidian AI Plugin

Meeting recorder + transcription + summaries for Obsidian. This plugin adds a microphone button/commands to capture audio, send it to AssemblyAI for speaker-labelled transcripts with timestamps, and optionally generate AI meeting summaries via OpenAI. Recordings and transcripts are saved to your vault so they stay portable.

## Features
- Microphone ribbon button and commands to start/stop meeting recordings.
- Transcription via AssemblyAI with speaker labels and HH:MM:SS timestamps.
- Saves raw audio into a configurable vault folder and links it from the transcript note.
- Creates a transcription note in a configurable folder; adds frontmatter and transcript.
- “Start recording for current note” command: links transcript back to the parent note.
- Optional OpenAI meeting summary appended to the transcript note.
- Context-menu “Categorize and Summarize” for the current file (legacy summary helper).

## Install (development build)
1) Install dependencies:
```bash
npm install
```
2) Build the plugin:
```bash
npm run build
```
3) Copy the plugin files to your Obsidian vault’s plugins folder (usually `.obsidian/plugins/obsidian-ai-plugin/`). Include:
```
main.js
manifest.json
styles.css   # if present
```
4) Reload Obsidian, enable the plugin in Settings → Community Plugins.

## Commands and UI
- Ribbon mic button: toggles recording (start/stop).
- Command palette:
  - `Start meeting recording (global)`
  - `Stop meeting recording`
  - `Start recording for current note` (links transcript to the active note)
- File context menu:
  - `Record Meeting` (starts a recording tied to that file)
  - `Categorize and Summarize` (legacy note summary)

## Settings
### Recording & Storage
- **Audio folder path**: folder to store raw audio (default `Audio`).
- **Transcription folder path**: folder for transcript notes (default `Transcriptions`).

### AssemblyAI
- **AssemblyAI API key** (required for transcription).
- **Transcription language** (language_code, e.g. `en-US`).
- **Transcription accuracy vs speed** (`balanced`, `accurate`, `fast`).

### OpenAI
- **OpenAI API key** (optional; required for AI meeting summaries).
- **OpenAI model** (default `gpt-4.1-mini`).
- **OpenAI API base URL** (default `https://api.openai.com/v1`).
- **Auto summarise meetings** (toggle to enable/disable).

### Legacy folders
People, Meetings, Projects, MOCs, Summaries, Fallback MOC (kept for prior functionality).

## Usage flow
1) Set your AssemblyAI key (and OpenAI key if you want AI summaries) in plugin settings.
2) Click the mic ribbon or run `Start meeting recording (global)` to begin recording.
3) Click again or run `Stop meeting recording` to finish.
4) The plugin saves the audio file, transcribes it with speaker/timestamps, creates a transcript note (with frontmatter + audio link), and optionally appends an AI summary.
5) Use `Start recording for current note` to link the transcript back to the active note under a “Recording” section.

## Notes
- Audio filenames default to `YYYY-MM-DD_HH-mm-ss_meeting-audio.webm`.
- Transcript note names default to `<ParentNote> - Meeting Transcript YYYY-MM-DD HH.mm.md`.
- If API keys are missing or a network call fails, the plugin skips that step and shows a notice. Existing recording behavior is preserved.***
