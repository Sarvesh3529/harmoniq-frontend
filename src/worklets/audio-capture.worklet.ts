class AudioCaptureWorklet extends AudioWorkletProcessor {
  process(inputs: Float32Array[][]): boolean {
    const inputChannelGroup = inputs[0];
    const inputChannel = inputChannelGroup?.[0];

    if (inputChannel && inputChannel.length > 0) {
      this.port.postMessage(new Float32Array(inputChannel));
    }

    return true;
  }
}

registerProcessor("audio-capture-worklet", AudioCaptureWorklet);
