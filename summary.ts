import axios from 'axios';
import { App, Notice, TFile, normalizePath } from 'obsidian';
import { ObsidianAIPluginSettings } from './settings';

const MEETING_SUMMARY_PROMPT = `You are an assistant that summarises meeting transcripts.
The user is a busy operations manager who needs clear outcomes and actions.
Given a transcript with speakers and optional timestamps, produce structured Markdown with:
- A brief 3–5 line summary of the meeting.
- Key outcomes / decisions.
- Detailed notes organised by topic.
- Topics list with timestamps if timestamps are present.
- Action items including owner (if mentioned) and due dates (if mentioned).
Keep the tone neutral and concise. Use bullet points where appropriate.`;

export async function generateSummaryForFile(app: App, file: TFile, settings: ObsidianAIPluginSettings): Promise<string> {
  const content = await app.vault.read(file);
  if (!settings.openAiApiKey) {
    return fallbackSummary(content);
  }

  try {
    const response = await axios.post(
      `${settings.openAiApiBaseUrl}/chat/completions`,
      {
        model: settings.openAiModel || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'Provide a concise summary of the given Obsidian note.' },
          { role: 'user', content },
        ],
        temperature: 0.2,
      },
      {
        headers: {
          Authorization: `Bearer ${settings.openAiApiKey}`,
        },
      },
    );

    return response.data?.choices?.[0]?.message?.content?.trim() || fallbackSummary(content);
  } catch (error) {
    console.error('OpenAI summary failed', error);
    new Notice('Note summary failed; using fallback text.');
    return fallbackSummary(content);
  }
}

export async function saveSummary(
  app: App,
  content: string,
  summariesFolder: string,
  baseName: string,
): Promise<TFile> {
  const folder = normalizePath(summariesFolder || 'Summaries');
  await ensureFolderExists(app, folder);
  const targetPath = normalizePath(`${folder}/${baseName}-summary.md`);
  const existing = app.vault.getAbstractFileByPath(targetPath);
  if (existing) {
    await app.vault.modify(existing as TFile, content);
    return existing as TFile;
  }
  return app.vault.create(targetPath, content);
}

export async function generateMeetingSummary(
  transcript: string,
  settings: ObsidianAIPluginSettings,
  hasTimestamps: boolean,
): Promise<string | null> {
  if (!settings.autoSummarise) return null;
  const apiKey = settings.openAiApiKey || settings.openAIKey;
  if (!apiKey) return null;

  try {
    const response = await axios.post(
      `${settings.openAiApiBaseUrl}/chat/completions`,
      {
        model: settings.openAiModel || 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: MEETING_SUMMARY_PROMPT },
          {
            role: 'user',
            content: `${hasTimestamps ? 'The transcript below includes timestamps in [HH:MM:SS] format.\n\n' : ''}${transcript}`,
          },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );
    return response.data?.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error('OpenAI meeting summary failed', error);
    new Notice('Meeting summary generation failed; transcript saved without AI summary.');
    return null;
  }
}

async function ensureFolderExists(app: App, folder: string): Promise<void> {
  const normalized = normalizePath(folder);
  const existing = app.vault.getAbstractFileByPath(normalized);
  if (!existing) {
    await app.vault.createFolder(normalized);
  }
}

function fallbackSummary(content: string): string {
  const preview = content.slice(0, 240).replace(/\s+/g, ' ').trim();
  return `Summary unavailable. Preview:\n\n${preview}`;
}
