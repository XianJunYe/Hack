import asyncio
import io
import json
import os
import time

import websockets
import ffmpeg
import numpy as np
import soundfile

from ppasr.infer_utils.vad_predictor import VADPredictor
from back_end.util.Audio2Text import WhisperAPI
from back_end.util.Text2Speech import generate_audio
from back_end.util.Text2Speech import generate_audio_without_stream
from back_end.util.chat import GPTChat

# Asyncio queue for audio data
audio_queue = asyncio.Queue()

gpt_for_response = GPTChat()
connections = {}

last_pause = 0

knowledge_form = {}


# 启动 ffmpeg 子进程
process = None
ffmpeg_task = None
audio_task = None

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
    last_speech = time.time()

    try:
        while True:
            chunk = await audio_queue.get()
            if chunk is None:
                break

            sample_buffer += chunk

            # 尝试读取音频数据
            try:
                wav, sr = soundfile.read(io.BytesIO(sample_buffer), dtype=np.float32)
            except RuntimeError:
                # 数据不足以解码，继续收集
                continue
            # 分割数据
            for i in range(processed_samples, len(wav), vad.window_size_samples):
                if i + vad.window_size_samples > len(wav):
                    break
                processed_samples += vad.window_size_samples
                chunk_wav = wav[i: i + vad.window_size_samples]
                speech_dict = vad.stream_vad(chunk_wav, sampling_rate=sr)
                if speech_dict:
                    if 'start' in speech_dict:
                        start = int(speech_dict['start'])
                    if 'end' in speech_dict:
                        end = int(speech_dict['end'])
                        save_path = os.path.join(output_dir, f"speech_segment_{file_counter}.wav")

                        # 记录时间
                        last_speech = time.time()
                        soundfile.write(save_path, wav[start: end], sr)

                        asyncio.run(handle_audio_text(save_path))
                        file_counter += 1
                        start, end = 0, 0
    except asyncio.CancelledError as e:
        #打印错误信息
        print("error", e)
        pass


async def handle_audio_text(save_path):
    whisper = WhisperAPI()
    # 翻译音频
    translation_result = whisper.transcribe(save_path)
    print("翻译结果:", translation_result)
    try:  # 如果翻译结果为空，忽略
        talk_history.append({"role": "user", "text": translation_result["text"]})
        await connections["/output"].send("User:" + translation_result["text"])
    except:
        return
    gpt_for_check = GPTChat()
    check_prompt = """
                        You are conducting a voice call with a user. Based on the following conversation history, please determine whether the user has answered the question in their latest response. The conversation history may include multiple consecutive user responses formatted as multiple "user: xxx" lines. Even if there are spelling mistakes, typos, or the user speaks multiple consecutive sentences, please try to understand and make a judgment based on the context. If the user has answered, please output only "true"; in other scenarios, please output only "false". Do not include any other text or explanations.
                        
                        Below is the conversation history:
                        """
    check_prompt_append = ""
    for talk in talk_history:
        if talk["role"] == "assistant":
            check_prompt_append = ""
        check_prompt_append = check_prompt_append + "\n" + talk["role"] + ":" + talk["text"]
    gpt_for_check.clear()
    response = gpt_for_check.chat("system",
                                  check_prompt + check_prompt_append, 0)
    print(response)
    if response.__contains__("true"):
        response = gpt_for_response.chat("user", translation_result["text"])
        print(response)

        talk_history.append({"role": "assistant", "text": response})
        await connections["/output"].send("AI:" + response)
        # asyncio.run(generate_audio(response, connections["/"]))
        response_file = generate_audio_without_stream(response, output_path="generated.wav")
        with open(response_file, 'rb') as audio_file:
            audio_bytes = audio_file.read()
            await connections["/"].send(audio_bytes)

        gpt_chat_for_json = GPTChat()
        gpt_chat_for_json.add_message("system",
                                      "你是一个信息收集助手，你需要收集对话中的信息并将所有的信息填入表单中，最后以 纯json 的形式返回给我，不需要包含 markdown 标记.表单定义如下{"
                                      "InterviewLocation:（线上?、线下?）,InterviewTime:?}")
        for talk in talk_history:
            gpt_chat_for_json.add_message(talk["role"], talk["text"])
        response = gpt_chat_for_json.chat("system",
                                          "以上是所有的对话记录，请生成 json")

        await connections["/result"].send(response)
    else:
        gpt_for_response.add_message("user", translation_result["text"])


talk_history = [];


async def audio_handler(websocket, path):
    connections[path] = websocket  # 存储当前路径的连接对象
    if path == "/":
        print("Connection established")
        global process
        global ffmpeg_task
        global audio_task
        global knowledge_form
        response = gpt_for_response.chat("system",
                                 "你现在作为 快手 公司的 hr AI 助手，现在你正在进行通话，你应该先询问对方是否方便接听电话，"
                                 "然后你可以根据一些基础信息向对方提出一些问题，最终完成所有问题的收集" +
                                 "每次只提问其中的一个问题，这是面试预约相关的背景信息：" + json.dumps(knowledge_form) +
                                 "下面请你开始与访谈者的第一句话。")
        print(response)
        talk_history.append({"role": "assistant", "text": response})
        await connections["/output"].send("AI:" + response)
        # await generate_audio(response, connections["/"])
        file_path = generate_audio_without_stream(response)

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

    elif path == '/output':
        try:
            async for message in websocket:
                if message:
                    continue
        except websockets.ConnectionClosed:
            print("WebSocket connection closed")
    elif path == '/result':
        try:
            async for message in websocket:
                if message:
                    continue
        except websockets.ConnectionClosed:
            print("WebSocket connection closed")
    elif path == '/init':
        try:
            async for message in websocket:
                if message:
                    print("init message: ", message)
                    knowledge_form = json.loads(message)
                    pass
        except websockets.ConnectionClosed:
            print("WebSocket connection closed")


async def main():
    global process
    global ffmpeg_task
    global audio_task
    process = await asyncio.create_subprocess_exec(
        'ffmpeg',
        '-i', 'pipe:0',
        '-ar', '16000',  # 设置输出采样率为 8000 Hz
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
    server = await websockets.serve(audio_handler, "localhost", 8080)
    print("WebSocket server started on ws://localhost:8080")
    await server.wait_closed()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped by user")
