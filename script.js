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

document.getElementById("connectButton").addEventListener("click", async () => {
    try {
        if (port && port.readable) {
            alert("Уже подключено!");
            return;
        }
        
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 9600 });
        writer = port.writable.getWriter();
        
        document.getElementById("connectButton").style.display = 'none';
        document.getElementById("disconnectButton").style.display = 'inline-block';
        alert("Успешно подключено!");
    } catch (error) {
        alert("Ошибка подключения: " + error);
    }
});

document.getElementById("disconnectButton").addEventListener("click", async () => {
    try {
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
    if (writer) {
        await writer.releaseLock();
    }
    if (port) {
        await port.close();
    }
});