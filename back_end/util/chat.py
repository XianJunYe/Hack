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

    def chat(self, role, prompt):
        """与GPT进行对话，记录上下文。"""
        url = "https://ai-gateway.corp.kuaishou.com/v2/chat/completions"
        headers = {
            "authorization": f"Bearer {self.token}",
            "x-dmo-provider": "openai",
            "Content-Type": "application/json"
        }

        # 添加用户输入到消息历史中
        self.add_message(role, prompt)

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


if __name__ == "__main__":
    gpt_chat = GPTChat()
    response = gpt_chat.chat("system",
                             "你是一个面试预约助手，你现在作为 快手 公司的"
                             "hr，现在你正在与候选人进行通话，你可以根据一些基础信息向候选人提出问一些问题，"
                             "每次只提问其中的一个问题，这是面试预约单的内容：\{"
                             "地点:（线上?、线下?）,空闲时间:?,\}，这是候选者的基本信息：{姓名：张三}，"
                             "面试官空闲时间：{20240921 10：00-18：00& 20240922 10：00-18:00}下面请你开始与访谈者的第一句话。")
    print(response)

    # 第一次对话
    response = gpt_chat.chat("user", "你好，我是张三")
    print(response)

    # 第二次对话，自动带上上下文
    response = gpt_chat.chat("user", "我现在在北京工作")
    print(response)
