import select

import numpy as np
import soundfile
from ppasr.infer_utils.vad_predictor import VADPredictor
import os
import websockets
import asyncio
import threading
import io
from pydub import AudioSegment
import wave
import ffmpeg


def read_ffmpeg_output(process, wav_file, stop_event, start_event):
    """从 ffmpeg 进程的 stdout 中读取数据并写入 WAV 文件，直到 stop_event 被设置"""
    while not stop_event.is_set():
        # 使用 select 来检查 stdout 是否有数据可读
        rlist, _, _ = select.select([process.stdout], [], [], 0.1)
        if process.stdout in rlist:
            wav_data = process.stdout.read(4096)  # 从 stdout 读取数据
            if wav_data:
                wav_file.write(wav_data)
                start_event.set()
            else:
                break


async def audio_handler(websocket, path):
    if path == "/":  # 检查请求的路径
        print("Connection established")
        process = (
                ffmpeg
                .input('pipe:0', format='webm')  # 从标准输入接收 WebM 数据
                .output('pipe:1', format='wav')  # 实时输出 WAV 格式
                .run_async(pipe_stdin=True, pipe_stdout=True, pipe_stderr=True)
            )

        output_wav_path = 'speaker/output_audio.wav'  # WAV 文件保存路径
        stop_event = threading.Event()  # 线程同步事件，用于通知读取线程停止
        start_event = threading.Event()  # 线程同步事件，用于通知读取线程开始
        audio_task = asyncio.create_task(process_audio(start_event))
        try:
            with open(output_wav_path, 'wb') as wav_file:
                # 创建一个线程来读取 ffmpeg 输出并写入文件
                read_thread = threading.Thread(target=read_ffmpeg_output, args=(process, wav_file, stop_event, start_event))
                read_thread.start()

                # 主线程处理 WebSocket 的数据写入 ffmpeg
                while True:
                    try:
                        message = await websocket.recv()
                        if message:
                            process.stdin.write(message)
                    except websockets.ConnectionClosed:
                        print("WebSocket connection closed")
                        break


        except Exception as e:
            print(f"Error occurred: {e}")
        finally:
            print("Connection closed")
            # 通知读取线程停止工作
            stop_event.set()

            # 等待读取线程结束
            read_thread.join()
            process.stdin.close()
    if path == "/audio":
        await send_wav(websocket, path)


async def process_audio(start_event):
    while not start_event.is_set():
        await asyncio.sleep(0.1)




    processed_samples = 0  # 用于跟踪已经处理的样本数量
    vad = VADPredictor()
    output_dir = 'output_segments'
    os.makedirs(output_dir, exist_ok=True)
    file_counter = 0
    vad = VADPredictor()

    while True:
        wav, sr = soundfile.read('speaker/output_audio.wav', dtype=np.float32)
        start = 0
        file_counter = 0
        output_dir = 'output_segments'
        for i in range(processed_samples, len(wav), vad.window_size_samples):
            print(i)
            processed_samples = i
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
