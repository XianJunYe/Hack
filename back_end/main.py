import asyncio
import io
import select
import threading
import websockets
import ffmpeg
import numpy as np
from ppasr.infer_utils.vad_predictor import VADPredictor
import os
import soundfile

# Asyncio queue for audio data
audio_queue = asyncio.Queue()


def read_ffmpeg_output(process):
    """从 ffmpeg 进程的 stdout 中读取数据并将其放入队列"""
    while True:
        rlist, _, _ = select.select([process.stdout], [], [], 0.1)
        if process.stdout in rlist:
            data = process.stdout.read(4096)
            if not data:
                asyncio.run(audio_queue.put(None))  # Signal the end of the data
                break
            asyncio.run(audio_queue.put(data))


def process_audio():
    """处理从队列中获取的音频数据"""
    vad = VADPredictor()
    output_dir = 'output_segments'
    os.makedirs(output_dir, exist_ok=True)
    file_counter = 0
    sample_buffer = bytes()

    processed_samples = 0
    while True:
        chunk = asyncio.run(audio_queue.get())
        if chunk is None:
            continue

        sample_buffer = sample_buffer + chunk
        wav, sr = soundfile.read(io.BytesIO(sample_buffer), dtype=np.float32)
        start = 0
        # Process available samples
        for i in range(processed_samples, len(wav), vad.window_size_samples):
            processed_samples = i
            print(processed_samples)
            chunk_wav = wav[i: i + vad.window_size_samples]
            speech_dict = vad.stream_vad(chunk_wav, sampling_rate=sr)
            if speech_dict:
                if 'start' in speech_dict:
                    start = int(speech_dict['start'])
                if 'end' in speech_dict:
                    end = int(speech_dict['end'])
                    save_path = os.path.join(output_dir, f"speech_segment_{file_counter}.wav")
                    soundfile.write(save_path, wav[start: end], sr)
                    file_counter += 1
                    start, end = 0, 0
                print(speech_dict, end=' ')
        if start != 0:
            save_path = os.path.join(output_dir, f"speech_segment_{file_counter}.wav")
            soundfile.write(save_path, wav[start:], sr)

async def audio_handler(websocket, path):
    if path == "/":
        print("Connection established")
        process = (
            ffmpeg
            .input('pipe:0', format='webm')
            .output('pipe:1', format='wav')
            .run_async(pipe_stdin=True, pipe_stdout=True, pipe_stderr=True)
        )

        # Start reading ffmpeg output
        read_thread = threading.Thread(target=read_ffmpeg_output, args=(process,))
        read_thread.start()
        read_thread = threading.Thread(target=process_audio)
        read_thread.start()
        print("task created")

        try:
            while True:
                message = await websocket.recv()
                if message:
                    process.stdin.write(message)
        except websockets.ConnectionClosed:
            print("WebSocket connection closed")
        finally:
            process.stdin.close()
            process.wait()

async def main():
    server = await websockets.serve(audio_handler, "localhost", 8080)
    await server.wait_closed()

if __name__ == "__main__":
    asyncio.run(main())
