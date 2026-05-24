export interface Transcription {
  id: string;
  title: string;
  status: "pending" | "processing" | "completed" | "failed";
  midiUrl: string | null;
  musicXmlUrl: string | null;
  createdAt: number;
}