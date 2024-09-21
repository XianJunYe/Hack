// script.js

let mediaRecorder;
let socket;
let socket2;
let socket3;
let socket4;
let audioContext;
let startButton = document.getElementById('startButton');
let stopButton = document.getElementById('stopButton');
let statusDiv = document.getElementById('status');

let inputField = document.getElementById('inputField');
let inputField2 = document.getElementById('inputField2');

const newInputContainer = document.getElementById('newInputContainer');
const addInputButton = document.getElementById('addInputButton');
const removeInputButton = document.getElementById('removeInputButton');


// 添加问题的按钮
addInputButton.addEventListener('click', () => {
    // 创建一个新的容器
    const container = document.createElement('div'); // 创建一个 div 容器

    // 创建问题内容的文本节点
    const label = document.createElement('span');
    label.textContent = '问题内容：';

    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.placeholder = '请输入内容';
    newInput.className = 'dynamic-input'; // 添加样式类

    const deleteButton = document.createElement('button'); // 创建删除按钮
    deleteButton.textContent = '删除';
    deleteButton.className = 'small-button'; // 添加样式类

    // 添加删除按钮的事件监听器
    deleteButton.addEventListener('click', () => {
        newInputContainer.removeChild(container); // 删除整个容器
    });

    // 将问题内容、输入框和删除按钮添加到容器中
    container.appendChild(label);
    container.appendChild(newInput);
    container.appendChild(deleteButton);

    // 将容器添加到输入框容器中
    newInputContainer.appendChild(container);
});
// 调用 OpenAI API 函数
function callOpenAI(imageDataURL) {
    const apiUrl = 'https://ai-gateway.corp.kuaishou.com/v2/chat/completions';
    const bearerToken = 'E4ywH0oIhzJ9Vf';  // 替换为你的Bearer Token
    // 构建请求参数
    const requestData = {
        model: 'gpt-4o',
        messages: [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: '这个图片有哪些文字？要求回复要详细一些！不需要解释，只需要图片上的文字'
                    },
                    {
                        type: 'image_url',
                        image_url: {
                            url: imageDataURL  // 将图片DataURL作为图片URL发送
                        }
                    }
                ]
            }
        ],
        stream: false
    };
    // 发送POST请求到OpenAI API
    const loadingElement = document.getElementById('loading');
    loadingElement.style.display = 'block'; // 显示加载状态
    // 发送POST请求到OpenAI API
    fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${bearerToken}`,
            'x-dmo-provider': 'openai',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    }).then(response => {
           return response.json();
    }).then(data => {
            const apiResponseDiv = document.getElementById('apiResponse');
            apiResponseDiv.textContent = data?.choices[0]?.message?.content;
        }).catch(error => {
            console.error('Error calling OpenAI API:', error);
        }).finally(() => {
        loadingElement.textContent = '解析完成'; // 显示加载完成
    });
}
// 选择下拉框的值发生变化时触发
document.getElementById("optionSelect").addEventListener("change", function()   {
    // 获取选择的值
    const selectedValue = this.value;
    // 当前页面的URL
    const currentUrl = window.location.href;
    // 创建新的URL对象
    const url = new URL(currentUrl);
    // 添加或更新查询参数 "option"
    url.searchParams.set('option', selectedValue);
    // 修改浏览器的URL而不重新加载页面
    window.history.pushState({}, '', url);
    // 你可以在这里执行其他操作，比如根据选项更新页面内容
    console.log("URL updated to: " + url.href);
});
// 监听上传简历按钮的变化
document.getElementById('uploadResume').addEventListener('change', function(event) {
    const file = event.target.files[0];  // 获取上传的文件
    if (file && file.type.startsWith('image/')) {  // 检查文件类型是否为图片
        const reader = new FileReader();  // 使用FileReader读取文件
        reader.onload = function(e) {
            // 将上传的图片显示在页面上
            const resumeImage = document.getElementById('resumeImage');
            resumeImage.src = e.target.result;  // 将图片数据设置为img元素的src
            resumeImage.style.display = 'block';  // 显示图片
            callOpenAI(e.target.result);  // 将图片数据URL传递给调用函数
        };
        reader.readAsDataURL(file);  // 读取文件内容并将其转换为Data URL
    } else {
        alert('请上传一个有效的图片文件。');
    }
});
// 开始通话按钮
startButton.addEventListener('click', async () => {
    // 请求麦克风权限并获取音频流
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        statusDiv.textContent = '麦克风权限获取成功，正在连接服务器...';
        socket3 = new WebSocket('ws://localhost:8080/output');
        socket4 = new WebSocket('ws://localhost:8080/result');
        // 初始化 WebSocket 连接
        socket = new WebSocket('ws://localhost:8080');
        socket.addEventListener('open', () => {
            statusDiv.textContent = '服务器连接成功，开始录音...';
            // 创建 MediaRecorder 实例
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
            // 当有音频数据可用时发送到服务器
            mediaRecorder.addEventListener('dataavailable', event => {
                console.log('音频数据可用:', event.data.size)
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            });
            // 开始录音，设置数据可用事件触发间隔为250毫秒
            mediaRecorder.start(250);
            startButton.disabled = true;
            stopButton.disabled = false;
        });
        socket.onmessage = (event) => {
            // 播放接收到的音频数据
            const audioBlob = new Blob([event.data], { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            statusDiv.textContent = '音频播放完毕';
        };
        socket.addEventListener('error', error => {
            console.error('WebSocket 错误:', error);
            statusDiv.textContent = '服务器连接错误，请检查服务器是否运行。';
        });
        socket3.onmessage = function (event) {
            const receivedData = event.data; // 从 WebSocket 获取的数据
            // 将接收到的数据添加到文本框中
            inputField.value += receivedData + '\n'; // 换行，便于查看每条数据
            this.style.height = 'auto';  // 先重置高度，防止折叠问题
            this.style.height = this.scrollHeight + 'px';  // 根据内容设置高度
        };
        // 监听 WebSocket 错误事件
        socket3.onerror = function (error) {
            console.error('WebSocket error:', error);
        };
        // 当 WebSocket 关闭时触发
        socket3.onclose = function (event) {
            console.log('WebSocket connection closed',event.code, event.reason);
        };
        socket4.onmessage = function (event) {
            const receivedData = event.data; // 从 WebSocket 获取的数据
            // 将接收到的数据添加到文本框中
            inputField2.value += receivedData + '\n'; // 换行，便于查看每条数据
            this.style.height = 'auto';  // 先重置高度，防止折叠问题
            this.style.height = this.scrollHeight + 'px';  // 根据内容设置高度
        };
        // 监听 WebSocket 错误事件
        socket4.onerror = function (error) {
            console.error('WebSocket error:', error);
        };
        // 当 WebSocket 关闭时触发
        socket4.onclose = function (event) {
            console.log('WebSocket connection closed',event.code, event.reason);
        };
    } catch (err) {
        console.error('获取麦克风权限失败:', err);
        statusDiv.textContent = '无法获取麦克风权限。';
    }
});
// 我说完了按钮
pauseButton.addEventListener('click', () => {
    //socket2 = new WebSocket('ws://localhost:8080/pause');
    // 获取所有动态生成的输入框
    const inputFields = document.querySelectorAll('.dynamic-input');
    const inputValues = [];

    // 遍历每个输入框，获取其值
    inputFields.forEach(input => {
        inputValues.push(input.value); // 将每个输入框的值添加到数组中
    });

    // 输出所有输入框的值
    console.log(inputValues);
    const apiResponseDiv = document.getElementById('apiResponse');
    console.log(apiResponseDiv.textContent);

    // 获取下拉选择器的值和标签
    const selectElement = document.getElementById('optionSelect'); // 选择下拉框
    const selectedValue = selectElement.value; // 选中的值
    const selectedLabel = selectElement.options[selectElement.selectedIndex].text; // 选中的标签

    console.log('输入框的内容:', inputValues);
    console.log('下拉选择器的值:', selectedValue);
    console.log('下拉选择器的标签:', selectedLabel);


});
// 结束通话按钮
stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
    //socket.close();
    //socket2.close();
    statusDiv.textContent = '录音已停止。';



    startButton.disabled = false;
    stopButton.disabled = true;
});