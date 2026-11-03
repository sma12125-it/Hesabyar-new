/**
 * Universal Mobile Audio Recorder for iOS Safari, Android Chrome, and Desktop browsers.
 * Records audio using standard MediaRecorder with AudioContext PCM WAV fallback.
 */

export interface RecorderHandle {
  stop: () => Promise<{ blob: Blob; base64: string; mimeType: string }>
  cancel: () => void
}

export function isAudioRecordingSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
}

function getSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
  ]
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Creates a standard 16-bit PCM WAV Blob from audio buffer data
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF identifier
  writeString(0, 'RIFF')
  // file length minus 8 bytes
  view.setUint32(4, 36 + samples.length * 2, true)
  // RIFF type
  writeString(8, 'WAVE')
  // format chunk identifier
  writeString(12, 'fmt ')
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (1 = PCM)
  view.setUint16(20, 1, true)
  // channel count (1 = mono)
  view.setUint16(22, 1, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true)
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true)
  // bits per sample
  view.setUint16(34, 16, true)
  // data chunk identifier
  writeString(36, 'data')
  // data chunk length
  view.setUint32(40, samples.length * 2, true)

  // Write samples (float32 to 16-bit signed PCM)
  let offset = 44
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]!))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export async function startAudioRecording(
  onLevel?: (level: number) => void,
): Promise<RecorderHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('دستگاه یا مرورگر شما دسترسی به ضبط صدا را پشتیبانی نمی‌کند.')
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })

  // Setup AnalyserNode for live sound meter visualization
  let audioCtx: AudioContext | null = null
  let animFrameId: number | null = null

  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 64
      const source = audioCtx.createMediaStreamSource(stream)
      source.connect(analyser)

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        let sum = 0
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i]!
        }
        const avg = sum / dataArray.length
        onLevel?.(Math.min(100, Math.round((avg / 128) * 100)))
        animFrameId = requestAnimationFrame(updateLevel)
      }
      updateLevel()
    }
  } catch {}

  const cleanupAudioGraph = () => {
    if (animFrameId) {
      cancelAnimationFrame(animFrameId)
      animFrameId = null
    }
    if (audioCtx && audioCtx.state !== 'closed') {
      try {
        void audioCtx.close()
      } catch {}
      audioCtx = null
    }
    stream.getTracks().forEach((track) => track.stop())
  }

  const mimeType = getSupportedMimeType()

  if (typeof MediaRecorder !== 'undefined' && mimeType) {
    const mediaRecorder = new MediaRecorder(stream, { mimeType })
    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunks.push(e.data)
      }
    }

    mediaRecorder.start(100) // collect chunks every 100ms

    return {
      stop: async () => {
        return new Promise((resolve, reject) => {
          mediaRecorder.onstop = async () => {
            cleanupAudioGraph()
            try {
              const blob = new Blob(chunks, { type: mimeType })
              const base64 = await blobToBase64(blob)
              resolve({ blob, base64, mimeType })
            } catch (err) {
              reject(err)
            }
          }
          try {
            mediaRecorder.stop()
          } catch (err) {
            cleanupAudioGraph()
            reject(err)
          }
        })
      },
      cancel: () => {
        try {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
        } catch {}
        cleanupAudioGraph()
      },
    }
  }

  // Fallback: Web Audio WAV Recorder
  const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) {
    cleanupAudioGraph()
    throw new Error('سیستم صوتی مرورگر فعال نیست.')
  }

  const pcmCtx = new AudioContextClass()
  const sampleRate = pcmCtx.sampleRate || 44100
  const sourceNode = pcmCtx.createMediaStreamSource(stream)
  const processor = pcmCtx.createScriptProcessor(4096, 1, 1)

  const leftChannelChunks: Float32Array[] = []
  let totalLength = 0

  processor.onaudioprocess = (e) => {
    const input = e.inputBuffer.getChannelData(0)
    const copy = new Float32Array(input.length)
    copy.set(input)
    leftChannelChunks.push(copy)
    totalLength += copy.length
  }

  sourceNode.connect(processor)
  processor.connect(pcmCtx.destination)

  return {
    stop: async () => {
      sourceNode.disconnect()
      processor.disconnect()
      cleanupAudioGraph()
      try {
        void pcmCtx.close()
      } catch {}

      const merged = new Float32Array(totalLength)
      let offset = 0
      for (const chunk of leftChannelChunks) {
        merged.set(chunk, offset)
        offset += chunk.length
      }

      const wavBlob = encodeWav(merged, sampleRate)
      const base64 = await blobToBase64(wavBlob)
      return { blob: wavBlob, base64, mimeType: 'audio/wav' }
    },
    cancel: () => {
      try {
        sourceNode.disconnect()
        processor.disconnect()
        void pcmCtx.close()
      } catch {}
      cleanupAudioGraph()
    },
  }
}
