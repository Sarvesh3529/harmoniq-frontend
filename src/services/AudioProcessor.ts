export interface AudioProcessorConfig {
  targetSampleRate: number;
  frameSize: number;
  hopSize: number;
  channelCount?: number;
  workletModuleUrl: string;
}

type PCMChunk = Float32Array<ArrayBufferLike>;

export interface AudioFrameWindow {
  frameIndex: number;
  timestampMs: number;
  sampleRate: number;
  samples: PCMChunk;
}

export type AudioFrameListener = (audioFrameWindow: AudioFrameWindow) => void;

class BufferQueue<T> {
  private readonly entries: T[] = [];

  enqueue(entry: T): void {
    this.entries.push(entry);
  }

  dequeue(): T | undefined {
    return this.entries.shift();
  }

  get size(): number {
    return this.entries.length;
  }

  clear(): void {
    this.entries.length = 0;
  }
}

export class AudioProcessor {
  private readonly config: AudioProcessorConfig;
  private readonly pcmChunkQueue = new BufferQueue<PCMChunk>();
  private readonly frameListeners = new Set<AudioFrameListener>();

  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private silentSinkNode: GainNode | null = null;
  private processingScheduled = false;
  private resampleCarry: PCMChunk = new Float32Array(0);
  private frameCarry: PCMChunk = new Float32Array(0);
  private emittedFrameCount = 0;

  constructor(config: AudioProcessorConfig) {
    this.config = {
      channelCount: 1,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.audioContext = new AudioContext({
      sampleRate: this.config.targetSampleRate,
      latencyHint: "interactive",
    });

    await this.audioContext.audioWorklet.addModule(this.config.workletModuleUrl);
  }

  async start(): Promise<void> {
    await this.initialize();
    if (!this.audioContext) {
      throw new Error("Audio context initialization failed.");
    }

    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: this.config.channelCount,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.audioWorkletNode = new AudioWorkletNode(this.audioContext, "audio-capture-worklet");
    this.silentSinkNode = this.audioContext.createGain();
    this.silentSinkNode.gain.value = 0;
    this.audioWorkletNode.port.onmessage = (messageEvent: MessageEvent<PCMChunk>) => {
      this.pcmChunkQueue.enqueue(messageEvent.data);
      this.scheduleQueueDrain();
    };

    this.mediaStreamSource.connect(this.audioWorkletNode);
    this.audioWorkletNode.connect(this.silentSinkNode);
    this.silentSinkNode.connect(this.audioContext.destination);
    await this.audioContext.resume();
  }

  onFrame(listener: AudioFrameListener): () => void {
    this.frameListeners.add(listener);
    return () => {
      this.frameListeners.delete(listener);
    };
  }

  async stop(): Promise<void> {
    this.audioWorkletNode?.disconnect();
    this.silentSinkNode?.disconnect();
    this.mediaStreamSource?.disconnect();
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.audioWorkletNode = null;
    this.silentSinkNode = null;
    this.mediaStreamSource = null;
    this.mediaStream = null;
  }

  async dispose(): Promise<void> {
    await this.stop();
    await this.audioContext?.close();
    this.audioContext = null;
    this.resetBuffers();
  }

  private resetBuffers(): void {
    this.pcmChunkQueue.clear();
    this.resampleCarry = new Float32Array(0);
    this.frameCarry = new Float32Array(0);
    this.emittedFrameCount = 0;
    this.processingScheduled = false;
  }

  private scheduleQueueDrain(): void {
    if (this.processingScheduled) {
      return;
    }

    this.processingScheduled = true;
    queueMicrotask(() => {
      this.processingScheduled = false;
      this.drainQueuedChunks();
    });
  }

  private drainQueuedChunks(): void {
    if (!this.audioContext) {
      return;
    }

    while (this.pcmChunkQueue.size > 0) {
      const inputChunk = this.pcmChunkQueue.dequeue();
      if (!inputChunk) {
        continue;
      }

      const resampledChunk = this.resampleChunk(
        inputChunk,
        this.audioContext.sampleRate,
        this.config.targetSampleRate,
      );
      this.frameCarry = concatenateFloat32Arrays(this.frameCarry, resampledChunk);

      while (this.frameCarry.length >= this.config.frameSize) {
        const frameSamples = this.frameCarry.slice(0, this.config.frameSize);
        const timestampMs =
          (this.emittedFrameCount * this.config.hopSize * 1000) / this.config.targetSampleRate;

        const audioFrameWindow: AudioFrameWindow = {
          frameIndex: this.emittedFrameCount,
          timestampMs,
          sampleRate: this.config.targetSampleRate,
          samples: frameSamples,
        };

        for (const listener of this.frameListeners) {
          listener(audioFrameWindow);
        }

        this.frameCarry = this.frameCarry.slice(this.config.hopSize);
        this.emittedFrameCount += 1;
      }
    }
  }

  private resampleChunk(
    inputChunk: PCMChunk,
    sourceSampleRate: number,
    targetSampleRate: number,
  ): PCMChunk {
    if (sourceSampleRate === targetSampleRate) {
      return inputChunk;
    }

    const sourceWithCarry = concatenateFloat32Arrays(this.resampleCarry, inputChunk);
    const ratio = sourceSampleRate / targetSampleRate;
    const targetLength = Math.floor(sourceWithCarry.length / ratio);
    const resampledChunk = new Float32Array(targetLength);

    for (let outputIndex = 0; outputIndex < targetLength; outputIndex += 1) {
      const sourceIndex = outputIndex * ratio;
      const leftIndex = Math.floor(sourceIndex);
      const rightIndex = Math.min(leftIndex + 1, sourceWithCarry.length - 1);
      const interpolationWeight = sourceIndex - leftIndex;
      const leftSample = sourceWithCarry[leftIndex] ?? 0;
      const rightSample = sourceWithCarry[rightIndex] ?? leftSample;
      resampledChunk[outputIndex] =
        leftSample + (rightSample - leftSample) * interpolationWeight;
    }

    const consumedSourceSamples = Math.floor(targetLength * ratio);
    this.resampleCarry = sourceWithCarry.slice(consumedSourceSamples);
    return resampledChunk;
  }
}

function concatenateFloat32Arrays(leftChunk: PCMChunk, rightChunk: PCMChunk): PCMChunk {
  const mergedChunk = new Float32Array(leftChunk.length + rightChunk.length);
  mergedChunk.set(leftChunk, 0);
  mergedChunk.set(rightChunk, leftChunk.length);
  return mergedChunk;
}
