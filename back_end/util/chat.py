import requests

class GPTChat:
    def __init__(self, model="gpt-4o", token="E4ywH0oIhzJ9Vf", temperature=0.1):
        self.model = model
        self.token = token
        self.temperature = temperature
        self.messages = []  # 用于存储对话的历史记录

    def add_message(self, role, content):
        """向对话记录中添加一条消息。"""
        self.messages.append({
            "role": role,
            "content": content
        })

    def chat(self, prompt):
        """与GPT进行对话，记录上下文。"""
        url = "https://ai-gateway.corp.kuaishou.com/v2/chat/completions"
        headers = {
            "authorization": f"Bearer {self.token}",
            "x-dmo-provider": "openai",
            "Content-Type": "application/json"
        }

        # 添加用户输入到消息历史中
        self.add_message("user", prompt)

        data = {
            "model": self.model,
            "messages": self.messages,  # 包含整个对话历史
            "stream": False,  # 如果你需要流式输出，可以改为True
            "temperature": self.temperature
        }

        response = requests.post(url, headers=headers, json=data)
        
        if response.status_code == 200:
            result = response.json()
            reply = result['choices'][0]['message']['content']
            # 将GPT的回复也添加到消息历史中
            self.add_message("assistant", reply)
            return reply
        else:
            return f"Error: {response.status_code}, {response.text}"

# 示例使用
gpt_chat = GPTChat()

# 第一次对话
response = gpt_chat.chat("空客A320如果彻底断电，电传飞控还能操作飞机吗，能安全着陆吗？")
print(response)

# 第二次对话，自动带上上下文
response = gpt_chat.chat("那如果没有外部电源支援，备用电源能用多久？")
print(response)
