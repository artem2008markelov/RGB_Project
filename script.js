// Список пользователей (логин: пароль)
const users = {
    "artem2008markelov@yandex.ru": "Ad345ggg",
    "user": "123456"
};

// Элементы DOM
const authContainer = document.getElementById("authContainer");
const ledControl = document.getElementById("ledControl");
const loginButton = document.getElementById("loginButton");
const errorMessage = document.getElementById("errorMessage");
const loggedInUser = document.getElementById("loggedInUser");
const colorPicker = document.getElementById("colorPicker");
const colorPreview = document.querySelector(".color-preview");

// Обновление превью цвета
colorPicker.addEventListener("input", () => {
    colorPreview.style.backgroundColor = colorPicker.value;
});

// Авторизация
loginButton.addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (users[username] && users[username] === password) {
        // Успешный вход
        authContainer.classList.add("hidden");
        ledControl.classList.remove("hidden");
        loggedInUser.textContent = username;
        errorMessage.classList.add("hidden");
    } else {
        // Ошибка авторизации
        errorMessage.classList.remove("hidden");
    }
});

let port;
let writer;
let reader;
let readingData = false;

// Функция для чтения данных из Serial порта
async function readSerialData() {
    try {
        const textDecoder = new TextDecoderStream();
        const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();

        let inputBuffer = "";

        while (readingData) {
            const { value, done } = await reader.read();
            if (done) break;

            inputBuffer += value;
            const lines = inputBuffer.split("\n");
            
            // Обрабатываем все полные строки
            for (let i = 0; i < lines.length - 1; i++) {
                parseAndUpdateSensorData(lines[i].trim());
            }
            
            // Оставляем неполную строку в буфере
            inputBuffer = lines[lines.length - 1];
        }
    } catch (error) {
        console.error("Ошибка чтения Serial данных:", error);
    }
}

// Функция для парсинга и обновления данных датчиков
function parseAndUpdateSensorData(line) {
    if (!line) return;

    // Парсинг температуры
    if (line.includes("Температура:")) {
        const match = line.match(/Температура:\s*([\d.]+)/);
        if (match) {
            const temperature = parseFloat(match[1]);
            updateTemperatureDisplay(temperature);
        }
    }

    // Парсинг влажности
    if (line.includes("Влажность:")) {
        const match = line.match(/Влажность:\s*([\d.]+)/);
        if (match) {
            const humidity = parseFloat(match[1]);
            updateHumidityDisplay(humidity);
        }
    }
}

// Функция обновления отображения температуры
function updateTemperatureDisplay(temperature) {
    const tempElement = document.getElementById("temperatureValue");
    if (tempElement) {
        tempElement.textContent = temperature.toFixed(2);
    }
}

// Функция обновления отображения влажности
function updateHumidityDisplay(humidity) {
    const humElement = document.getElementById("humidityValue");
    if (humElement) {
        humElement.textContent = humidity.toFixed(2);
    }
}

// Подключение к Arduino
document.getElementById("connectButton").addEventListener("click", async () => {
    try {
        if (port && port.readable) {
            alert("Уже подключено!");
            return;
        }
        
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        
        // Запускаем чтение данных
        readingData = true;
        readSerialData();
        
        document.getElementById("connectButton").style.display = 'none';
        document.getElementById("disconnectButton").style.display = 'inline-block';
        alert("Успешно подключено!");
    } catch (error) {
        alert("Ошибка подключения: " + error);
    }
});

// Отключение от Arduino
document.getElementById("disconnectButton").addEventListener("click", async () => {
    try {
        readingData = false;
        
        if (reader) {
            await reader.cancel();
            reader = null;
        }
        
        if (writer) {
            await writer.releaseLock();
            writer = null;
        }
        
        if (port) {
            await port.close();
            port = null;
        }
        
        document.getElementById("connectButton").style.display = 'inline-block';
        document.getElementById("disconnectButton").style.display = 'none';
        alert("Успешно отключено!");
    } catch (error) {
        alert("Ошибка отключения: " + error);
    }
});

// Отправка команды LED
document.getElementById("sendButton").addEventListener("click", async () => {
    if (!writer) {
        alert("Сначала подключитесь к Arduino!");
        return;
    }

    try {
        let color = document.getElementById("colorPicker").value.substring(1);
        let mode = document.getElementById("modeSelect").value;
        let r = parseInt(color.substring(0, 2), 16);
        let g = parseInt(color.substring(2, 4), 16);
        let b = parseInt(color.substring(4, 6), 16);

        let command = `${mode},${r},${g},${b}\n`;
        await writer.write(new TextEncoder().encode(command));
        alert("Команда отправлена: " + command);
    } catch (error) {
        alert("Ошибка отправки команды: " + error);
    }
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', async () => {
    readingData = false;
    
    if (reader) {
        await reader.cancel();
    }
    
    if (writer) {
        await writer.releaseLock();
    }
    
    if (port) {
        await port.close();
    }
});