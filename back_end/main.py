import asyncio
import io
import os
import time

import websockets
import ffmpeg
import numpy as np
import soundfile

from ppasr.infer_utils.vad_predictor import VADPredictor
from back_end.util.Audio2Text import WhisperAPI
from back_end.util.Text2Audio import generate_audio
from back_end.util.chat import GPTChat

# Asyncio queue for audio data
audio_queue = asyncio.Queue()

gpt_chat = GPTChat()
connections = {}

last_pause = 0

async def read_ffmpeg_output(process, audio_queue):
    """从 ffmpeg 进程的 stdout 中异步读取数据并将其放入队列"""
    try:
        while True:
            data = await process.stdout.read(4096)
            if not data:
                await audio_queue.put(None)  # Signal the end of the data
                break
            await audio_queue.put(data)
    except asyncio.CancelledError:
        pass
    finally:
        process.stdout.close()


sample_buffer = bytes()
async def process_audio(audio_queue):
    """异步处理从队列中获取的音频数据"""
    global sample_buffer
    vad = VADPredictor()
    output_dir = 'output_segments'
    os.makedirs(output_dir, exist_ok=True)
    file_counter = 0
    start_time = int(time.time() * 1000)
    processed_samples = 0
    start = 0
    end = 0

    try:
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                # 处理剩余的样本
                # if sample_buffer:
                #     wav, sr = soundfile.read(io.BytesIO(sample_buffer), dtype=np.float32)
                #     save_path = os.path.join(output_dir, f"speech_segment_{file_counter}.wav")
                #     soundfile.write(save_path, wav, sr)
                break

            sample_buffer += chunk

            # 尝试读取音频数据
            try:
                wav, sr = soundfile.read(io.BytesIO(sample_buffer), dtype=np.float32)
            except RuntimeError:
                # 数据不足以解码，继续收集
                continue

            # 分割数据
            # for i in range(0, len(wav), vad.window_size_samples):
            #     chunk_wav = wav[i: i + vad.window_size_samples]
            #     speech_dict = vad.stream_vad(chunk_wav, sampling_rate=sr)
            #     if speech_dict:
            #         if 'start' in speech_dict:
            #             start = int(speech_dict['start'])
            #         if 'end' in speech_dict:
            #             end = int(speech_dict['end'])
            #             save_path = os.path.join(output_dir, f"speech_segment_{file_counter}.wav")
            #             soundfile.write(save_path, wav[start: end], sr)
            #             file_counter += 1
            #             start, end = 0, 0
            #         print(speech_dict, end=' ')
    except asyncio.CancelledError:
        pass


async def audio_handler(websocket, path):
    connections[path] = websocket  # 存储当前路径的连接对象
    if path == "/":
        print("Connection established")
        # 启动 ffmpeg 子进程
        process = await asyncio.create_subprocess_exec(
            'ffmpeg',
            '-i', 'pipe:0',
            '-f', 'wav',
            'pipe:1',
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )

        # 创建并启动任务
        ffmpeg_task = asyncio.create_task(read_ffmpeg_output(process, audio_queue))
        audio_task = asyncio.create_task(process_audio(audio_queue))
        print("Tasks created")

        # response = gpt_chat.chat(
        #     "system",
        #     "你是一个背调助手，我们是 ks 公司的 hr，现在你正在与被访谈者进行通话，你可以根据背调清单向访谈者提出问一些问题，每次只提问其中的一个问题，这是背调清单的内容：{姓名:?,工作地点:?}，下面请你开始与访谈者的第一句话。"
        # )

        response = gpt_chat.chat("system",
                                 "你是一个面试预约助手，你现在作为 快手 公司的"
                                 "hr，现在你正在与候选人进行通话，你可以根据一些基础信息向候选人提出问一些问题，"
                                 "每次只提问其中的一个问题，这是面试预约单的内容：\{"
                                 "地点:（线上?、线下?）,空闲时间:?,\}，这是候选者的基本信息：{姓名：张三}，"
                                 "面试官空闲时间：{20240921 10：00-18：00& 20240922 10：00-18:00}下面请你开始与访谈者的第一句话。")
        print(response)
        await connections["/output"].send("AI:"+response)
        file_path = generate_audio(response, lang="zh-cn")

        # Send the audio file bytes to the client
        with open(file_path, 'rb') as audio_file:
            audio_bytes = audio_file.read()
            await websocket.send(audio_bytes)

        try:
            async for message in websocket:
                if message:
                    process.stdin.write(message)
                    await process.stdin.drain()
        except websockets.ConnectionClosed:
            print("WebSocket connection closed")
        finally:
            # 关闭 ffmpeg 进程的 stdin
            process.stdin.close()
            await process.wait()

            # 取消任务
            ffmpeg_task.cancel()
            audio_task.cancel()
            try:
                await ffmpeg_task
            except asyncio.CancelledError:
                pass
            try:
                await audio_task
            except asyncio.CancelledError:
                pass
            # 确保队列结束
            await audio_queue.put(None)


    elif path == '/pause':
        global sample_buffer
        global last_pause
        # 处理暂停逻辑（需要确保 sample_buffer 是可访问的）
        wav, sr = soundfile.read(io.BytesIO(sample_buffer), dtype=np.float32)

        soundfile.write('output.wav', wav[last_pause:], sr)
        last_pause = len(wav)
        whisper = WhisperAPI("E4ywH0oIhzJ9Vf")
        # 翻译音频
        translation_result = whisper.transcribe("output.wav")
        print("翻译结果:", translation_result)
        await connections["/output"].send("User:"+translation_result["text"])
        response = gpt_chat.chat("user", translation_result["text"])
        print(response)
        await connections["/output"].send("AI:"+response)
        response_file = generate_audio(response, lang="zh-cn", output_path="generated.wav")
        with open(response_file, 'rb') as audio_file:
            audio_bytes = audio_file.read()
            await connections["/"].send(audio_bytes)
        pass  # 根据您的需求实现

    elif path == '/output':
        pass


async def main():
    server = await websockets.serve(audio_handler, "localhost", 8080)
    print("WebSocket server started on ws://localhost:8080")
    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped by user")
