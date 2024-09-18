from openai import OpenAI

client = OpenAI(api_key="sk-2qufi8q3XB1jsFcQAb67252875024c419fA51fD25e8c4cE5", base_url="https://api.bltcy.ai/")

response = client.audio.speech.create(
    model="tts-1-hd-1106",
    voice="alloy",
    input="Hello world! This is a streaming test.",
    response_format="mp3",
)
print(response)
print(response.read())
response.write_to_file("output.mp3")