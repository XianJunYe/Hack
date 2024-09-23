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

let final_json = ""

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
                if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
                    socket.send(event.data);
                }
            });
            // 开始录音，设置数据可用事件触发间隔为250毫秒
            mediaRecorder.start(250);
            startButton.disabled = true;
            stopButton.disabled = false;
        });




        /*socket.onmessage = (event) => {
            // 播放接收到的音频数据
            const audioBlob = new Blob([event.data], { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.play();
            statusDiv.textContent = '音频播放完毕';
        };*/

        const audioElement = document.getElementById('audioElement');
        const statusDiv = document.getElementById('status');

        if (window.MediaSource) {
            const mediaSource = new MediaSource();
            audioElement.src = URL.createObjectURL(mediaSource);

            mediaSource.addEventListener('sourceopen', () => {
                const sourceBuffer = mediaSource.addSourceBuffer('audio/wav; codecs="vorbis"'); // 根据流的格式更改 mime 类型

                socket.binaryType = 'arraybuffer';  // 接收二进制数据

                socket.onmessage = (event) => {
                    if (sourceBuffer.updating) {
                        // 等待当前更新完成再追加新数据
                        sourceBuffer.addEventListener('updateend', () => {
                            sourceBuffer.appendBuffer(event.data);  // 更新结束时，追加新数据
                        }, { once: true });  // 只监听一次事件
                    } else {
                        // 如果没有在更新，直接追加数据
                        sourceBuffer.appendBuffer(event.data);
                    }
                };

                socket.onclose = () => {
                    // 关闭媒体源
                    mediaSource.endOfStream();
                };
            });
        } else {
            console.error('MediaSource API is not supported on this browser.');
        }





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
            final_json = receivedData;
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
// 初始化按钮
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

    const params = JSON.stringify({
        question: inputValues,
        scene: selectedLabel,
        resume: apiResponseDiv.textContent
    });


    const socket22 = new WebSocket('ws://localhost:8080/init');
    socket22.addEventListener('open', () => {
        socket22.send(params);
    });
    socket22.onmessage(function (event) {
        loadingElement.textContent = '初始化完成';
    })


});
// 结束通话按钮
stopButton.addEventListener('click', () => {
    mediaRecorder.stop();
    //socket.close();
    //socket2.close();
    statusDiv.textContent = '录音已停止。';


    // 假设后端返回的消息是一个 JSON 字符串
    const jsonString = final_json;
    const jsonData = JSON.parse(jsonString); // 解析 JSON 字符串

    const table = document.getElementById('jsonTable');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    tbody.innerHTML = ''; // 清空现有的表格数据
    thead.innerHTML = ''; // 清空现有的表头

    // 生成表头
    const headerRow = document.createElement('tr');
    headerRow.appendChild(document.createElement('th')).textContent = '问题';
    headerRow.appendChild(document.createElement('th')).textContent = '答案';
    thead.appendChild(headerRow);

    // 遍历 JSON 对象生成表格行
    for (const question in jsonData) {
        if (jsonData.hasOwnProperty(question)) {
            const answer = jsonData[question]; // 获取对应的答案
            const row = document.createElement('tr');

            // 创建问题单元格
            const questionCell = document.createElement('td');
            questionCell.textContent = question;
            row.appendChild(questionCell);

            // 创建答案单元格
            const answerCell = document.createElement('td');
            answerCell.textContent = answer;
            row.appendChild(answerCell);

            // 将新行添加到表格中
            tbody.appendChild(row);
        }
    }


    startButton.disabled = false;
    stopButton.disabled = true;
});
