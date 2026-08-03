import { db, ref, push, set, onValue, remove, update, onDisconnect } from "./firebase.js";

const VALID_USERS = {
  "baraa": "baraa",
  "hams": "hams"
};

const currentUser = localStorage.getItem("chat_user");
const currentPath = window.location.pathname;

// تحديد نوع الصفحة بدقة لتجنب أي حلقات توجيه (Redirect Loops) على GitHub Pages
const isIndexPage = currentPath.endsWith("index.html") || currentPath.endsWith("/") || (!currentPath.includes("chat.html") && !currentPath.includes("index.html"));
const isChatPage = currentPath.includes("chat.html");

if (!currentUser && isChatPage) {
  window.location.replace("index.html");
}

if (currentUser && isIndexPage) {
  window.location.replace("chat.html");
}

// معالجة نموذج تسجيل الدخول
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById("username").value.trim().toLowerCase();
    const passwordInput = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    if (VALID_USERS[usernameInput] && VALID_USERS[usernameInput] === passwordInput) {
      localStorage.setItem("chat_user", usernameInput);
      window.location.replace("chat.html");
    } else {
      if (errorMsg) errorMsg.classList.remove("hidden");
    }
  });
}

// معالجة واجهة الشات
if (currentUser && isChatPage) {
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const chatMessages = document.getElementById("chat-messages");
  const logoutBtn = document.getElementById("logout-btn");
  const statusIndicator = document.getElementById("status-indicator");
  const typingIndicator = document.getElementById("typing-indicator");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const myStatusRef = ref(db, `status/${currentUser}`);
      set(myStatusRef, false).finally(() => {
        localStorage.removeItem("chat_user");
        window.location.replace("index.html");
      });
    });
  }

  const myStatusRef = ref(db, `status/${currentUser}`);
  set(myStatusRef, true);
  onDisconnect(myStatusRef).set(false);

  const otherUser = currentUser === "baraa" ? "hams" : "baraa";
  const otherStatusRef = ref(db, `status/${otherUser}`);
  onValue(otherStatusRef, (snapshot) => {
    const isOnline = snapshot.val();
    if (statusIndicator) {
      if (isOnline) {
        statusIndicator.textContent = "متصل الآن";
        statusIndicator.className = "status-online";
      } else {
        statusIndicator.textContent = "غير متصل";
        statusIndicator.className = "status-offline";
      }
    }
  });

  const myTypingRef = ref(db, `typing/${currentUser}`);
  let typingTimeout;

  if (messageInput) {
    messageInput.addEventListener("input", () => {
      set(myTypingRef, true);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        set(myTypingRef, false);
      }, 1500);
    });
  }

  window.addEventListener("beforeunload", () => {
    set(myTypingRef, false);
    set(myStatusRef, false);
  });

  const otherTypingRef = ref(db, `typing/${otherUser}`);
  onValue(otherTypingRef, (snapshot) => {
    const isTyping = snapshot.val();
    if (typingIndicator) {
      if (isTyping) {
        typingIndicator.classList.remove("hidden");
      } else {
        typingIndicator.classList.add("hidden");
      }
    }
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  });

  const messagesRef = ref(db, "messages");

  const sendMessage = () => {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text) return;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessageRef = push(messagesRef);
    set(newMessageRef, {
      sender: currentUser,
      text: text,
      time: timeFormatted,
      timestamp: Date.now()
    });

    messageInput.value = "";
    set(myTypingRef, false);
  };

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      sendMessage();
    });
  }

  if (messageInput) {
    messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  onValue(messagesRef, (snapshot) => {
    if (!chatMessages) return;
    chatMessages.innerHTML = "";
    const data = snapshot.val();
    
    if (!data) return;

    const messagesArray = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    })).sort((a, b) => a.timestamp - b.timestamp);

    messagesArray.forEach((msg) => {
      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message");
      
      if (msg.sender === currentUser) {
        messageDiv.classList.add("sent");
      } else {
        messageDiv.classList.add("received");
      }

      messageDiv.innerHTML = `
        <div class="message-text">${escapeHtml(msg.text)}</div>
        <div class="message-meta">
          <span>${msg.time}</span>
        </div>
      `;

      if (msg.sender === currentUser) {
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "message-actions";
        
        actionsDiv.innerHTML = `
          <button type="button" title="تعديل" class="edit-btn"><i class="fa-solid fa-pen"></i></button>
          <button type="button" title="حذف" class="delete-btn"><i class="fa-solid fa-trash"></i></button>
        `;

        actionsDiv.querySelector(".delete-btn").addEventListener("click", () => {
          remove(ref(db, `messages/${msg.id}`));
        });

        actionsDiv.querySelector(".edit-btn").addEventListener("click", () => {
          const newText = prompt("عدل رسالتك:", msg.text);
          if (newText !== null && newText.trim() !== "") {
            update(ref(db, `messages/${msg.id}`), { text: newText.trim() });
          }
        });

        messageDiv.appendChild(actionsDiv);
      }

      chatMessages.appendChild(messageDiv);
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
      }
    
