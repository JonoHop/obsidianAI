import { Plugin } from 'obsidian';
import { settings } from './settings';
import axios from 'axios';

export class Recording {
  private plugin: Plugin;
  private isRecording: boolean = false;
  private mediaRecorder: MediaRecorder;
  private chunks: Blob[] = [];

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  // Start recording audio
  public startRecording(): void {
    this.isRecording = true;
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      this.mediaRecorder = new MediaRecorder(stream);
      this.mediaRecorder.start();

      this.mediaRecorder.ondataavailable = e => {
        this.chunks.push(e.data);
      };
    });
  }
  
  // Stop recording audio
  public async stopRecording(): Promise<string> {
    this.isRecording = false;
    this.mediaRecorder.stop();

    const blob = new Blob(this.chunks, { 'type' : 'audio/ogg; codecs=opus' });
    const audioURL = window.URL.createObjectURL(blob);
    this.chunks = [];
    
    return audioURL;
  }
  
  // Transcribe the recorded audio using AssemblyAI
  public async transcribeAudio(audioURL: string): Promise<string> {
    const response = await axios.post('https://api.assemblyai.com/v2/transcript', {
      audio_url: audioURL,
    }, {
      headers: {
        authorization: settings.assemblyAIKey,
      },
    });

    return response.data.transcript_text;
  }
}
export default Recording;
