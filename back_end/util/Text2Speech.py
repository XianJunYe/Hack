from openai import OpenAI

client = OpenAI(api_key="sk-2qufi8q3XB1jsFcQAb67252875024c419fA51fD25e8c4cE5",
                base_url="https://api.bltcy.ai/v1/")

def generate_audio(text, output_path='output.wav'):
    response = client.audio.speech.create(
        model="tts-1-1106",
        voice="shimmer", #Literal["alloy", "echo", "fable", "onyx", "nova", "shimmer"],
        input=text,
        response_format="wav",
    )
    response.stream_to_file(output_path)
    return output_path