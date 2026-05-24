"use client";

export async function convertBlobToWavFile(blob: Blob, outputFileName?: string): Promise<File> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    const wavBlob = encodeAudioBufferAsWav(audioBuffer);
    const fallbackName = `audio-${new Date().toISOString().replace(/[:.]/g, "-")}.wav`;
    return new File([wavBlob], outputFileName || fallbackName, { type: "audio/wav" });
  } finally {
    await audioContext.close();
  }
}

export function replaceExtension(filename: string, nextExtension: string): string {
  const sanitizedExtension = nextExtension.startsWith(".") ? nextExtension : `.${nextExtension}`;
  const lastDotIndex = filename.lastIndexOf(".");
  if (lastDotIndex < 0) {
    return `${filename}${sanitizedExtension}`;
  }

  return `${filename.slice(0, lastDotIndex)}${sanitizedExtension}`;
}

function encodeAudioBufferAsWav(audioBuffer: AudioBuffer): Blob {
  const channelData =
    audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array(0);
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const dataSize = channelData.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index] ?? 0));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += bytesPerSample;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
