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
    gpt_chat.add_message("system",
                             "你是一个信息收集助手，你需要收集对话中的信息并将所有的信息填入表单中，最后以 纯json 的形式返回给我，不需要包含 markdown 标记.表单定义如下{"
                             "InterviewLocation:（线上?、线下?）,InterviewTime:?}")
    gpt_chat.add_message("assistant", "您好，张三。我是快手公司的HR。请问您更倾向于线上还是线下面试呢？")
    gpt_chat.add_message("user", "我个人更倾向于线上面是")
    gpt_chat.add_message("assistant", "好的，张三。请问您在2024年9月21日或22日的10:00到18:00之间，哪个时间段比较方便进行线上面试呢？")
    gpt_chat.add_message("user", "我个人的话会更倾向于 9月22号的下午两点开始先上面试")
    response = gpt_chat.chat("assistant", "好的，张三。我已经为您安排了9月22日下午2点的线上面试。稍后我会发送相关的会议链接和详细信息给您。如果您有任何问题，请随时联系我。祝您面试顺利！")

    print("收集到的表单信息如下")
    print(response)
