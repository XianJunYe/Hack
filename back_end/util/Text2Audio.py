from gtts import gTTS
import os

def generate_audio(text, lang='zh-tw', output_path='output.wav'):
    """
    生成音频文件并返回文件路径。

    参数:
    - text (str): 要转换为音频的文本
    - lang (str): 语言代码，默认为中文（台湾）
    - output_path (str): 输出文件路径，默认为 'output.wav'

    返回:
    - str: 生成的音频文件路径
    """
    tts = gTTS(text=text, lang=lang)
    tts.save(output_path)
    return output_path

if __name__ == "__main__":
    # 示例使用
    text = """
    其实我觉得人是一个多重的社会属性的动物。
    """
    file_path = generate_audio(text)
    print(f"音频文件保存到: {file_path}")
