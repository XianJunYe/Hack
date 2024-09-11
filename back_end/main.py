import asyncio
import websockets
import numpy as np
import soundfile
from ppasr.infer_utils.vad_predictor import VADPredictor
import os


async def audio_handler(websocket, path):
    if path == "/":  # 检查请求的路径
        print("Connection established")
        with open('speaker/input.wav', 'wb') as f:
            await process_audio()
            while True:
                try:
                    data = await websocket.recv()
                    f.write(data)
                except websockets.exceptions.ConnectionClosed:
                    print("Connection closed")
                    break
    if path == "/audio":
        await send_wav(websocket, path)


async def process_audio():
    vad = VADPredictor()

    wav, sr = soundfile.read('speaker/input.wav', dtype=np.float32)
    start = 0
    file_counter = 0
    output_dir = 'output_segments'
    for i in range(0, len(wav), vad.window_size_samples):
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


async def send_wav(websocket, path):
    # 打开 WAV 文件
    with open('output.wav', 'rb') as wav_file:
        # 读取文件并发送
        while True:
            data = wav_file.read(1024)  # 每次读取 1024 字节
            if not data:
                break
            await websocket.send(data)  # 通过 WebSocket 发送数据
            await asyncio.sleep(0.01)  # 控制发送速度


async def main():
    server = await websockets.serve(audio_handler, "localhost", 8080)
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
