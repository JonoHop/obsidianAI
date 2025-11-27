// Import necessary modules
import { App, TFile, Notice } from 'obsidian';
import { settings } from './settings';
import generateSummaryContent from './utils/summaryGenerator';

// This string will contain the generated summary of a note or a meeting.
let summaryContent: string;

// This string will contain the text selected by the user for summary generation.
let selectedText: string;

// Function for generating a summary of a note or a meeting.
export async function generateSummary(app: App, file: TFile, selectedOnly: boolean = false) {
  // If selectedOnly flag is true, use selected text. Otherwise, use entire note content.
  const content = selectedOnly ? selectedText : await app.vault.read(file);

  // Generate the summary content using the utility function
  summaryContent = await generateSummaryContent(content);

  // Show a notice to the user that the summary has been generated
  new Notice('Summary has been generated.');

  // Emit a custom event to notify that the summary has been generated
  app.workspace.trigger('summaryGenerated', {file, summaryContent});

  // Save the summary
  saveSummary(app, file);
}

// Function for saving the generated summary into the '/Summaries' folder.
async function saveSummary(app: App, file: TFile) {
  // Construct the filename for the summary file
  const summaryFilename = `${file.basename}-summary.md`;

  // Construct the path for the summary file
  const summaryPath = `${settings.summariesFolder}/${summaryFilename}`;

  // Save the summary into the '/Summaries' folder
  await app.vault.create(summaryPath, summaryContent);
  
  // Show a notice to the user that the summary has been saved
  new Notice(`Summary has been saved into ${summaryPath}.`);
}

// Export the selectedText variable so that it can be updated from other modules
export { selectedText };
