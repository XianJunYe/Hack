import time

from openai import OpenAI

client = OpenAI(api_key="sk-2qufi8q3XB1jsFcQAb67252875024c419fA51fD25e8c4cE5",
                base_url="https://api.bltcy.ai/v1/")

async def generate_audio(text, connection):
    start = time.time()
    with client.audio.speech.with_streaming_response.create(
        model="tts-1-1106",
        voice="shimmer", #Literal["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
        input=text,
        response_format="wav",
    ) as response:
        for chunk in response.iter_bytes():
            await connection.send(chunk)
    print("调用 chatgpt 获取音频，耗时： ，", time.time() - start)
    return


def generate_audio_without_stream(text, output_path='output.wav'):
    response = client.audio.speech.create(
        model="tts-1-hd-1106",
        voice="fable",
        input=text,
        response_format="wav",
    )
    response.write_to_file(output_path)
    return output_path