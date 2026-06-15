// Список пользователей (загружается из JSON)
let users = {};

// Элементы DOM
const authContainer = document.getElementById("authContainer");
const ledControl = document.getElementById("ledControl");
const loginButton = document.getElementById("loginButton");
const logoutButton = document.getElementById("logoutButton");
const errorMessage = document.getElementById("errorMessage");
const loggedInUser = document.getElementById("loggedInUser");
const colorPicker = document.getElementById("colorPicker");
const colorPreview = document.querySelector(".color-preview");
const colorHex = document.getElementById("colorHex");
const connectionStatus = document.getElementById("connectionStatus");
const sensorStatus = document.getElementById("sensorStatus");
const sendButton = document.getElementById("sendButton");

// Загрузить пользователей из JSON файла
async function loadUsers() {
    try {
        const response = await fetch('users.json');
        const data = await response.json();
        
        // Преобразуем массив пользователей в объект для быстрого поиска
        users = {};
        data.users.forEach(user => {
            users[user.login] = user.password;
        });
        
        console.log("Users loaded from JSON");
    } catch (error) {
        console.error("Error loading users:", error);
        // Fallback на встроенные пользователи
        users = {
            "artem2008markelov@yandex.ru": "Ad345ggg",
            "user": "123456"
        };
    }
}

// Проверить сохраненную авторизацию при загрузке
window.addEventListener('load', async () => {
    await loadUsers();
    checkSavedLogin();
});

// Сохранить авторизацию в localStorage
function saveLogin(username) {
    localStorage.setItem('loggedInUser', username);
}

// Получить сохраненного пользователя
function getSavedLogin() {
    return localStorage.getItem('loggedInUser');
}

// Удалить авторизацию
function clearLogin() {
    localStorage.removeItem('loggedInUser');
}

// Проверить сохраненную авторизацию
function checkSavedLogin() {
    const savedUser = getSavedLogin();
    if (savedUser && users[savedUser]) {
        loginUser(savedUser);
    }
}

// Обновление превью цвета
colorPicker.addEventListener("input", () => {
    const hexColor = colorPicker.value;
    colorPreview.style.backgroundColor = hexColor;
    colorHex.value = hexColor;
});

// Авторизация
loginButton.addEventListener("click", () => {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();

    if (users[username] && users[username] === password) {
        loginUser(username);
    } else {
        // Ошибка авторизации
        errorMessage.classList.remove("hidden");
        document.getElementById("password").value = "";
    }
});

// Функция для входа пользователя
function loginUser(username) {
    authContainer.classList.add("hidden");
    ledControl.classList.remove("hidden");
    loggedInUser.textContent = username;
    errorMessage.classList.add("hidden");
    document.getElementById("username").value = "";
    document.getElementById("password").value = "";
    
    // Сохраняем авторизацию
    saveLogin(username);
    
    // Инициализируем LED управление
    updateConnectionStatus();
    console.log("User logged in:", username);
}

// Обработчик выхода
logoutButton.addEventListener("click", () => {
    logoutUser();
});

function logoutUser() {
    authContainer.classList.remove("hidden");
    ledControl.classList.add("hidden");
    clearLogin();
    
    // Отключаемся от Arduino если подключены
    if (port) {
        document.getElementById("disconnectButton").click();
    }
    
    console.log("User logged out");
}

let port;
let writer;
let reader;
let readingData = false;
let inputBuffer = ""; // Буфер для неполных строк

// Функция для переключения вкладок
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Удаляем активный класс со всех кнопок и содержимого
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // Добавляем активный класс текущим
        button.classList.add('active');
        document.getElementById(tabName).classList.add('active');
    });
});

// Обновить статус соединения
function updateConnectionStatus(isConnected = false) {
    if (isConnected) {
        connectionStatus.innerHTML = '<span class="status-icon">🟢</span> Подключено к Arduino';
        sendButton.disabled = false;
        document.getElementById("connectButton").style.display = 'none';
        document.getElementById("disconnectButton").classList.remove('hidden');
    } else {
        connectionStatus.innerHTML = '<span class="status-icon">⚫</span> Не подключено';
        sendButton.disabled = true;
        document.getElementById("connectButton").style.display = 'inline-flex';
        document.getElementById("disconnectButton").classList.add('hidden');
    }
}

// Обновить статус датчика
function updateSensorStatus(isReceiving = false) {
    if (isReceiving) {
        sensorStatus.innerHTML = '<span class="status-icon">🟢</span> Датчик подключен, получение данных...';
    } else {
        sensorStatus.innerHTML = '<span class="status-icon">⏳</span> Ожидание подключения...';
    }
}

// Функция для чтения данных из Serial порта
async function readSerialData() {
    try {
        const textDecoder = new TextDecoder();
        
        while (readingData && port.readable) {
            try {
                reader = port.readable.getReader();
                
                try {
                    while (readingData) {
                        const { value, done } = await reader.read();
                        
                        if (done) {
                            console.log("Stream закрыт");
                            break;
                        }

                        if (value) {
                            const text = textDecoder.decode(value);
                            console.log("Raw received:", text);
                            
                            // Добавляем новые данные в буфер
                            inputBuffer += text;
                            
                            // Обрабатываем полные строки
                            const lines = inputBuffer.split('\n');
                            
                            // Последняя строка может быть неполной
                            inputBuffer = lines[lines.length - 1];
                            
                            // Обрабатываем все полные строки
                            for (let i = 0; i < lines.length - 1; i++) {
                                const line = lines[i].trim();
                                if (line.length > 0) {
                                    parseAndUpdateSensorData(line);
                                }
                            }
                        }
                    }
                } finally {
                    reader.releaseLock();
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log("Read абортирован");
                } else {
                    console.error("Ошибка чтения:", error);
                }
                break;
            }
        }
    } catch (error) {
        console.error("Ошибка в readSerialData:", error);
    }
}

// Функция для парсинга и обновления данных датчиков
function parseAndUpdateSensorData(line) {
    if (!line) return;

    console.log("Parsing sensor data:", line);

    // Парсинг температуры
    if (line.includes("Температура:")) {
        const match = line.match(/Температура:\s*([\d.]+)\s*°?C?/);
        if (match) {
            const temperature = parseFloat(match[1]);
            console.log("Temperature parsed:", temperature);
            updateTemperatureDisplay(temperature);
        } else {
            console.log("Temperature regex didn't match");
        }
    }

    // Парсинг влажности
    if (line.includes("Влажность:")) {
        const match = line.match(/Влажность:\s*([\d.]+)\s*%?/);
        if (match) {
            const humidity = parseFloat(match[1]);
            console.log("Humidity parsed:", humidity);
            updateHumidityDisplay(humidity);
        } else {
            console.log("Humidity regex didn't match");
        }
    }
}

// Функция обновления отображения температуры
function updateTemperatureDisplay(temperature) {
    const tempElement = document.getElementById("temperatureValue");
    if (tempElement) {
        // Проверяем, что значение валидно
        if (!isNaN(temperature) && temperature >= -50 && temperature <= 150) {
            tempElement.textContent = temperature.toFixed(2);
            console.log("Temperature display updated:", temperature.toFixed(2));
            updateSensorStatus(true);
        } else {
            console.warn("Invalid temperature value:", temperature);
        }
    } else {
        console.warn("Temperature element not found");
    }
}

// Функция обновления отображения влажности
function updateHumidityDisplay(humidity) {
    const humElement = document.getElementById("humidityValue");
    if (humElement) {
        // Проверяем, что значение валидно (0-100%)
        if (!isNaN(humidity) && humidity >= 0 && humidity <= 100) {
            humElement.textContent = humidity.toFixed(2);
            console.log("Humidity display updated:", humidity.toFixed(2));
            updateSensorStatus(true);
        } else {
            console.warn("Invalid humidity value:", humidity);
        }
    } else {
        console.warn("Humidity element not found");
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
        await port.open({ baudRate: 115200 });
        
        writer = port.writable.getWriter();
        inputBuffer = ""; // Очищаем буфер при новом подключении
        
        console.log("Connected successfully to port");
        
        // Обновляем статус
        updateConnectionStatus(true);
        
        // Запускаем чтение данных асинхронно (не ждем)
        readingData = true;
        readSerialData().catch(error => {
            console.error("readSerialData error:", error);
            readingData = false;
            updateConnectionStatus(false);
        });
        
        console.log("UI updated - connected state");
    } catch (error) {
        console.error("Connection error:", error);
        alert("Ошибка подключения: " + error.message);
        
        // Очищаем переменные при ошибке
        port = null;
        writer = null;
        reader = null;
        updateConnectionStatus(false);
    }
});

// Отключение от Arduino
document.getElementById("disconnectButton").addEventListener("click", async () => {
    try {
        readingData = false;
        
        // Даем время на завершение чтения
        await new Promise(resolve => setTimeout(resolve, 100));
        
        if (reader) {
            try {
                await reader.cancel();
            } catch (e) {
                console.log("Reader cancel error:", e);
            }
            reader = null;
        }
        
        if (writer) {
            try {
                await writer.releaseLock();
            } catch (e) {
                console.log("Writer release error:", e);
            }
            writer = null;
        }
        
        if (port) {
            try {
                await port.close();
            } catch (e) {
                console.log("Port close error:", e);
            }
            port = null;
        }
        
        updateConnectionStatus(false);
        updateSensorStatus(false);
        
        console.log("Disconnected successfully");
    } catch (error) {
        console.error("Ошибка отключения:", error);
        alert("Ошибка отключения: " + error);
    }
});

// Отправка команды LED
document.getElementById("sendButton").addEventListener("click", async () => {
    if (!writer) {
        alert("Сначала подключитесь к Arduino!");
        updateConnectionStatus(false);
        return;
    }

    try {
        let hexColor = document.getElementById("colorPicker").value.substring(1);
        let mode = document.getElementById("modeSelect").value;
        
        console.log("Hex color:", hexColor);
        console.log("Mode:", mode);
        
        // Парсим HEX в RGB
        let r = parseInt(hexColor.substring(0, 2), 16);
        let g = parseInt(hexColor.substring(2, 4), 16);
        let b = parseInt(hexColor.substring(4, 6), 16);

        console.log("RGB values:", r, g, b);

        // Формируем команду: mode,r,g,b
        let command = `${mode},${r},${g},${b}\n`;
        
        console.log("SEND:", command);
        
        // Отправляем команду
        await writer.write(new TextEncoder().encode(command));
        
        console.log("Command sent successfully");
        alert("✅ Команда отправлена: " + command.trim());
    } catch (error) {
        console.error("Ошибка отправки команды:", error);
        alert("❌ Ошибка отправки команды: " + error);
        updateConnectionStatus(false);
    }
});

// Обработка закрытия страницы
window.addEventListener('beforeunload', async () => {
    readingData = false;
    
    if (reader) {
        try {
            await reader.cancel();
        } catch (e) {
            console.log("Reader cancel on unload:", e);
        }
    }
    
    if (writer) {
        try {
            await writer.releaseLock();
        } catch (e) {
            console.log("Writer release on unload:", e);
        }
    }
    
    if (port) {
        try {
            await port.close();
        } catch (e) {
            console.log("Port close on unload:", e);
        }
    }
});

// Инициализировать статусы при загрузке
window.addEventListener('load', () => {
    updateConnectionStatus(false);
    updateSensorStatus(false);
});