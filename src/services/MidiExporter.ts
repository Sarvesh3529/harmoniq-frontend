export interface RawNoteEvent {
  pitch: number;
  start: number;
  end: number;
  velocity: number;
}

export interface MidiExporterHeader {
  bpm: number;
  timeSignature: [number, number];
  instrument: string;
}

export interface MidiJsonNote {
  midi: number;
  time: number;
  duration: number;
  velocity: number;
}

export interface MidiJsonExport {
  header: MidiExporterHeader;
  notes: MidiJsonNote[];
}

const DEFAULT_HEADER: MidiExporterHeader = {
  bpm: 120,
  timeSignature: [4, 4],
  instrument: "Piano",
};

const TICKS_PER_QUARTER = 480;

export class MidiExporter {
  private readonly rawNoteEvents: RawNoteEvent[];
  private readonly header: MidiExporterHeader;

  constructor(rawNoteEvents: RawNoteEvent[], header: Partial<MidiExporterHeader> = {}) {
    this.rawNoteEvents = [...rawNoteEvents].sort((leftNote, rightNote) => {
      if (leftNote.start === rightNote.start) {
        return leftNote.pitch - rightNote.pitch;
      }

      return leftNote.start - rightNote.start;
    });
    this.header = {
      ...DEFAULT_HEADER,
      ...header,
    };
  }

  toJSON(): MidiJsonExport {
    return {
      header: this.header,
      notes: this.rawNoteEvents.map((rawNoteEvent) => ({
        midi: rawNoteEvent.pitch,
        time: rawNoteEvent.start,
        duration: Math.max(0, rawNoteEvent.end - rawNoteEvent.start),
        velocity: normalizeVelocity(rawNoteEvent.velocity),
      })),
    };
  }

  toMIDI(): Blob {
    const midiBytes = createMidiFile(this.rawNoteEvents, this.header);
    const midiBuffer = new ArrayBuffer(midiBytes.byteLength);
    const midiView = new Uint8Array(midiBuffer);
    midiView.set(midiBytes);
    return new Blob([midiView], { type: "audio/midi" });
  }
}

function createMidiFile(rawNoteEvents: RawNoteEvent[], header: MidiExporterHeader): Uint8Array {
  const trackEvents: TrackEvent[] = [];

  trackEvents.push({
    tick: 0,
    data: createTempoEvent(header.bpm),
  });
  trackEvents.push({
    tick: 0,
    data: createTimeSignatureEvent(header.timeSignature),
  });
  trackEvents.push({
    tick: 0,
    data: createTrackNameEvent(header.instrument),
  });
  trackEvents.push({
    tick: 0,
    data: createProgramChangeEvent(0, 0),
  });

  for (const rawNoteEvent of rawNoteEvents) {
    const startTick = secondsToTicks(rawNoteEvent.start, header.bpm);
    const endTick = Math.max(
      startTick + 1,
      secondsToTicks(Math.max(rawNoteEvent.end, rawNoteEvent.start + 0.001), header.bpm),
    );
    const velocity = normalizeMidiVelocity(rawNoteEvent.velocity);
    const clampedPitch = clampToByte(rawNoteEvent.pitch);

    trackEvents.push({
      tick: startTick,
      data: [0x90, clampedPitch, velocity],
    });
    trackEvents.push({
      tick: endTick,
      data: [0x80, clampedPitch, 0],
    });
  }

  trackEvents.sort((leftEvent, rightEvent) => {
    if (leftEvent.tick === rightEvent.tick) {
      return compareEventPriority(leftEvent.data, rightEvent.data);
    }

    return leftEvent.tick - rightEvent.tick;
  });

  const trackData: number[] = [];
  let previousTick = 0;

  for (const event of trackEvents) {
    const delta = Math.max(0, event.tick - previousTick);
    trackData.push(...encodeVariableLength(delta), ...event.data);
    previousTick = event.tick;
  }

  trackData.push(0x00, 0xff, 0x2f, 0x00);

  const headerChunk = [
    ...stringToBytes("MThd"),
    0x00,
    0x00,
    0x00,
    0x06,
    0x00,
    0x00,
    0x00,
    0x01,
    (TICKS_PER_QUARTER >> 8) & 0xff,
    TICKS_PER_QUARTER & 0xff,
  ];

  const trackLength = trackData.length;
  const trackChunk = [
    ...stringToBytes("MTrk"),
    (trackLength >> 24) & 0xff,
    (trackLength >> 16) & 0xff,
    (trackLength >> 8) & 0xff,
    trackLength & 0xff,
    ...trackData,
  ];

  return new Uint8Array([...headerChunk, ...trackChunk]);
}

type TrackEvent = {
  tick: number;
  data: number[];
};

function compareEventPriority(leftData: number[], rightData: number[]): number {
  const leftPriority = getEventPriority(leftData);
  const rightPriority = getEventPriority(rightData);
  return leftPriority - rightPriority;
}

function getEventPriority(data: number[]): number {
  const status = data[0] ?? 0;
  return status === 0x80 ? 0 : status === 0x90 ? 1 : 2;
}

function createTempoEvent(bpm: number): number[] {
  const microsecondsPerQuarter = Math.round(60000000 / Math.max(1, bpm));
  return [
    0xff,
    0x51,
    0x03,
    (microsecondsPerQuarter >> 16) & 0xff,
    (microsecondsPerQuarter >> 8) & 0xff,
    microsecondsPerQuarter & 0xff,
  ];
}

function createTimeSignatureEvent(timeSignature: [number, number]): number[] {
  const [numerator, denominator] = timeSignature;
  const denominatorPower = Math.log2(Math.max(1, denominator));
  return [
    0xff,
    0x58,
    0x04,
    clampToByte(numerator),
    clampToByte(Number.isFinite(denominatorPower) ? denominatorPower : 2),
    0x18,
    0x08,
  ];
}

function createTrackNameEvent(name: string): number[] {
  const nameBytes = stringToBytes(name);
  return [0xff, 0x03, ...encodeVariableLength(nameBytes.length), ...nameBytes];
}

function createProgramChangeEvent(channel: number, program: number): number[] {
  return [0xc0 | (channel & 0x0f), clampToByte(program)];
}

function secondsToTicks(seconds: number, bpm: number): number {
  const beats = Math.max(0, seconds) * Math.max(1, bpm) / 60;
  return Math.round(beats * TICKS_PER_QUARTER);
}

function normalizeVelocity(velocity: number): number {
  if (velocity <= 1) {
    return Math.max(0, Math.min(1, velocity));
  }

  return Math.max(0, Math.min(1, velocity / 127));
}

function normalizeMidiVelocity(velocity: number): number {
  return Math.max(1, Math.min(127, Math.round(normalizeVelocity(velocity) * 127)));
}

function clampToByte(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function encodeVariableLength(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes: number[] = [];

  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
      continue;
    }
    break;
  }

  return bytes;
}

function stringToBytes(value: string): number[] {
  return Array.from(new TextEncoder().encode(value));
}
