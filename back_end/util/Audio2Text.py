import requests

class WhisperAPI:
    def __init__(self, token, model="whisper-1"):
        self.base_url = "https://ai-gateway.corp.kuaishou.com/v1/audio"
        self.token = token
        self.model = model
        self.headers = {
            "authorization": f"Bearer {self.token}",
            "x-dmo-provider": "openai"
        }

    def _send_request(self, endpoint, file_path):
        """发送请求并返回结果"""
        url = f"{self.base_url}/{endpoint}"
        with open(file_path, 'rb') as audio_file:
            files = {
                "file": audio_file
            }
            data = {
                "model": self.model
            }
            response = requests.post(url, headers=self.headers, files=files, data=data)
        
        if response.status_code == 200:
            return response.json()
        else:
            return f"Error: {response.status_code}, {response.text}"

    def translate(self, file_path):
        """翻译音频"""
        return self._send_request("translations", file_path)

    def transcribe(self, file_path):
        """转录音频"""
        return self._send_request("transcriptions", file_path)


if __name__ == "__main__":
    # 示例使用
    token = "E4ywH0oIhzJ9Vf"  # 替换为你的实际token
    file_path = "/Users/xiexianjun/Desktop/code/Hack/back_end/speaker/speaker2_a_cn_16k.wav"

    whisper = WhisperAPI(token)

    # 翻译音频
    translation_result = whisper.translate(file_path)
    print("翻译结果:", translation_result)

    # 转录音频
    transcription_result = whisper.transcribe(file_path)
    print("转录结果:", transcription_result)
