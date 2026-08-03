import { db, ref, push, set, onValue, remove, update, onDisconnect, get } from "./firebase.js";

const VALID_USERS = {
  "baraa": "baraa",
  "hams": "hams"
};

const currentUser = localStorage.getItem("chat_user");
const currentPath = window.location.pathname;
const isIndexPage = currentPath.endsWith("index.html") || currentPath.endsWith("/") || (!currentPath.includes("chat.html") && !currentPath.includes("index.html"));
const isChatPage = currentPath.includes("chat.html");

if (!currentUser && isChatPage) {
  window.location.replace("index.html");
}

if (currentUser && isIndexPage) {
  window.location.replace("chat.html");
}

// طلب إذن الإشعارات عند أول دخول
if (currentUser && isChatPage && "Notification" in window) {
  if (Notification.permission === "default") {
    Notification.requestPermission();
  }
}

// إدارة الثيم (فاتح/داكن)
const savedTheme = localStorage.getItem("chat_theme") || "dark";
document.body.setAttribute("data-theme", savedTheme);

const loginBtnAction = document.getElementById("login-btn-action");
if (loginBtnAction) {
  loginBtnAction.addEventListener("click", () => {
    const usernameInput = document.getElementById("username").value.trim().toLowerCase();
    const passwordInput = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    if (VALID_USERS[usernameInput] && VALID_USERS[usernameInput] === passwordInput) {
      localStorage.setItem("chat_user", usernameInput);
      window.location.href = "chat.html";
    } else {
      if (errorMsg) errorMsg.classList.remove("hidden");
    }
  });

  // السماح بالدخول عبر زر Enter
  document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      loginBtnAction.click();
    }
  });
}

if (currentUser && isChatPage) {
  const chatForm = document.getElementById("chat-form");
  const messageInput = document.getElementById("message-input");
  const chatMessages = document.getElementById("chat-messages");
  const logoutBtn = document.getElementById("logout-btn");
  const statusIndicator = document.getElementById("status-indicator");
  const typingIndicator = document.getElementById("typing-indicator");
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  const searchToggleBtn = document.getElementById("search-toggle-btn");
  const searchContainer = document.getElementById("search-container");
  const searchInput = document.getElementById("search-input");
  const closeSearchBtn = document.getElementById("close-search-btn");
  const emojiBtn = document.getElementById("emoji-btn");
  const emojiPicker = document.getElementById("emoji-picker");
  const fileInput = document.getElementById("file-input");
  const micBtn = document.getElementById("mic-btn");
  const replyPreview = document.getElementById("reply-preview");
  const replyPreviewText = document.getElementById("reply-preview-text");
  const cancelReplyBtn = document.getElementById("cancel-reply-btn");
  const pinnedBanner = document.getElementById("pinned-banner");
  const pinnedText = document.getElementById("pinned-text");
  const closePinnedBtn = document.getElementById("close-pinned-btn");

  let replyingTo = null;
  let pinnedMessageId = null;
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecording = false;
  let lastMessageCount = 0;

  const playSound = (type) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      if (type === "send") {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch (e) {}
  };

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = document.body.getAttribute("data-theme");
      const newTheme = currentTheme === "dark" ? "light" : "dark";
      document.body.setAttribute("data-theme", newTheme);
      localStorage.setItem("chat_theme", newTheme);
      themeToggleBtn.innerHTML = newTheme === "dark" ? '<i class="fa-solid fa-moon"></i>' : '<i class="fa-solid fa-sun"></i>';
    });
    if (savedTheme === "light") {
      themeToggleBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
    }
  }

  if (searchToggleBtn && searchContainer) {
    searchToggleBtn.addEventListener("click", () => {
      searchContainer.classList.toggle("hidden");
      if (!searchContainer.classList.contains("hidden")) {
        searchInput.focus();
      }
    });
    closeSearchBtn.addEventListener("click", () => {
      searchContainer.classList.add("hidden");
      searchInput.value = "";
      filterMessages("");
    });
    searchInput.addEventListener("input", (e) => {
      filterMessages(e.target.value.trim().toLowerCase());
    });
  }

  function filterMessages(query) {
    const msgDivs = chatMessages.querySelectorAll(".message");
    msgDivs.forEach(div => {
      const text = div.querySelector(".message-text")?.textContent.toLowerCase() || "";
      if (text.includes(query) || query === "") {
        div.style.display = "flex";
      } else {
        div.style.display = "none";
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      const myStatusRef = ref(db, `status/${currentUser}`);
      set(myStatusRef, { online: false, lastSeen: Date.now() }).finally(() => {
        localStorage.removeItem("chat_user");
        window.location.replace("index.html");
      });
    });
  }

  const myStatusRef = ref(db, `status/${currentUser}`);
  set(myStatusRef, { online: true, lastSeen: Date.now() });
  onDisconnect(myStatusRef).set({ online: false, lastSeen: Date.now() });

  const otherUser = currentUser === "baraa" ? "hams" : "baraa";
  const otherStatusRef = ref(db, `status/${otherUser}`);
  onValue(otherStatusRef, (snapshot) => {
    const data = snapshot.val();
    if (statusIndicator) {
      if (data && data.online) {
        statusIndicator.textContent = "متصل الآن";
        statusIndicator.className = "status-online";
      } else if (data && data.lastSeen) {
        const date = new Date(data.lastSeen);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        statusIndicator.textContent = `آخر ظهور في ${timeStr}`;
        statusIndicator.className = "status-offline";
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
      }, 1000);
    });
  }

  window.addEventListener("beforeunload", () => {
    set(myTypingRef, false);
    set(myStatusRef, { online: false, lastSeen: Date.now() });
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
  });

  if (emojiBtn && emojiPicker) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      emojiPicker.classList.toggle("hidden");
    });
    document.addEventListener("click", () => {
      emojiPicker.classList.add("hidden");
    });
    emojiPicker.addEventListener("click", (e) => {
      e.stopPropagation();
      if (e.target.classList.contains("emoji-item")) {
        messageInput.value += e.target.textContent;
        messageInput.focus();
        emojiPicker.classList.add("hidden");
      }
    });
  }

  if (cancelReplyBtn) {
    cancelReplyBtn.addEventListener("click", () => {
      replyingTo = null;
      replyPreview.classList.add("hidden");
    });
  }

  const pinnedRef = ref(db, "pinnedMessage");
  onValue(pinnedRef, (snapshot) => {
    const pId = snapshot.val();
    pinnedMessageId = pId;
    if (pId) {
      get(ref(db, `messages/${pId}`)).then((snap) => {
        const msg = snap.val();
        if (msg) {
          pinnedText.textContent = msg.text || "رسالة ميديا مثبتة";
          pinnedBanner.classList.remove("hidden");
        } else {
          pinnedBanner.classList.add("hidden");
        }
      });
    } else {
      pinnedBanner.classList.add("hidden");
    }
  });

  if (closePinnedBtn) {
    closePinnedBtn.addEventListener("click", () => {
      set(pinnedRef, null);
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(uploadEvent) {
        const base64Data = uploadEvent.target.result;
        const now = new Date();
        const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const isImage = file.type.startsWith("image/");

        const newMessageRef = push(ref(db, "messages"));
        set(newMessageRef, {
          sender: currentUser,
          text: isImage ? "" : `ملف: ${file.name}`,
          fileUrl: base64Data,
          fileType: isImage ? "image" : "file",
          fileName: file.name,
          time: timeFormatted,
          timestamp: Date.now(),
          seen: false,
          edited: false,
          deleted: false,
          replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, sender: replyingTo.sender } : null
        });

        playSound("send");
        set(myTypingRef, false);
        replyingTo = null;
        if (replyPreview) replyPreview.classList.add("hidden");
        fileInput.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  if (micBtn) {
    micBtn.addEventListener("click", async () => {
      if (!isRecording) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          mediaRecorder = new MediaRecorder(stream);
          audioChunks = [];

          mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
          };

          mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onload = function(e) {
              const base64Audio = e.target.result;
              const now = new Date();
              const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const newMessageRef = push(ref(db, "messages"));
              set(newMessageRef, {
                sender: currentUser,
                text: "رسالة صوتية",
                fileUrl: base64Audio,
                fileType: "audio",
                time: timeFormatted,
                timestamp: Date.now(),
                seen: false,
                edited: false,
                deleted: false,
                replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, sender: replyingTo.sender } : null
              });
              playSound("send");
              replyingTo = null;
              if (replyPreview) replyPreview.classList.add("hidden");
            };
            reader.readAsDataURL(audioBlob);
            stream.getTracks().forEach(track => track.stop());
          };

          mediaRecorder.start();
          isRecording = true;
          micBtn.style.color = "var(--error-color)";
        } catch (err) {
          alert("لا يمكن الوصول إلى الميكروفون.");
        }
      } else {
        mediaRecorder.stop();
        isRecording = false;
        micBtn.style.color = "var(--text-secondary)";
      }
    });
  }

  const sendMessage = () => {
    if (!messageInput) return;
    const text = messageInput.value.trim();
    if (!text || text.length > 2000) return;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMessageRef = push(ref(db, "messages"));
    set(newMessageRef, {
      sender: currentUser,
      text: escapeHtml(text),
      time: timeFormatted,
      timestamp: Date.now(),
      seen: false,
      edited: false,
      deleted: false,
      replyTo: replyingTo ? { id: replyingTo.id, text: replyingTo.text, sender: replyingTo.sender } : null
    });

    playSound("send");
    messageInput.value = "";
    set(myTypingRef, false);
    replyingTo = null;
    if (replyPreview) replyPreview.classList.add("hidden");
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

  const messagesRef = ref(db, "messages");
  onValue(messagesRef, (snapshot) => {
    if (!chatMessages) return;
    const data = snapshot.val();
    if (!data) {
      chatMessages.innerHTML = "";
      return;
    }

    const messagesArray = Object.keys(data).map(key => ({
      id: key,
      ...data[key]
    })).sort((a, b) => a.timestamp - b.timestamp);

    messagesArray.forEach(msg => {
      if (msg.sender !== currentUser && !msg.seen) {
        update(ref(db, `messages/${msg.id}`), { seen: true });
      }
    });

    if (messagesArray.length > lastMessageCount && lastMessageCount > 0) {
      const lastMsg = messagesArray[messagesArray.length - 1];
      if (lastMsg.sender !== currentUser) {
        playSound("receive");
        if (document.hidden && "Notification" in window && Notification.permission === "granted") {
          new Notification("رسالة جديدة", {
            body: lastMsg.text || "تم إرسال ملف جديد",
            icon: "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/svgs/solid/comments.svg"
          });
        }
      }
    }
    lastMessageCount = messagesArray.length;

    chatMessages.innerHTML = "";
    let lastDateStr = "";

    messagesArray.forEach((msg) => {
      const msgDate = new Date(msg.timestamp).toLocaleDateString();
      if (msgDate !== lastDateStr) {
        lastDateStr = msgDate;
        const dateDiv = document.createElement("div");
        dateDiv.className = "date-separator";
        dateDiv.textContent = msgDate === new Date().toLocaleDateString() ? "اليوم" : msgDate;
        chatMessages.appendChild(dateDiv);
      }

      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message");
      messageDiv.id = `msg-${msg.id}`;
      
      if (msg.sender === currentUser) {
        messageDiv.classList.add("sent");
      } else {
        messageDiv.classList.add("received");
      }

      let innerContent = "";

      if (msg.replyTo) {
        innerContent += `
          <div class="replied-box" data-id="${msg.replyTo.id}">
            <strong>${msg.replyTo.sender === currentUser ? "أنت" : otherUser}</strong>
            <p>${msg.replyTo.text || "ميديا"}</p>
          </div>
        `;
      }

      if (msg.deleted) {
        innerContent += `<div class="message-text" style="font-style:italic; color:var(--text-secondary);">تم حذف الرسالة</div>`;
      } else {
        if (msg.fileType === "image") {
          innerContent += `<img src="${msg.fileUrl}" class="message-image" alt="صورة">`;
        } else if (msg.fileType === "audio") {
          innerContent += `<audio src="${msg.fileUrl}" controls class="message-audio"></audio>`;
        }
        if (msg.text && msg.fileType !== "image") {
          innerContent += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
        } else if (msg.text && msg.fileType === "image" && msg.text !== "") {
          innerContent += `<div class="message-text">${escapeHtml(msg.text)}</div>`;
        }
      }

      let ticksHtml = "";
      if (msg.sender === currentUser) {
        if (msg.seen) {
          ticksHtml = `<span class="ticks read">✓✓</span>`;
        } else {
          ticksHtml = `<span class="ticks">✓</span>`;
        }
      }

      const editedText = msg.edited && !msg.deleted ? `(تم التعديل)` : "";

      innerContent += `
        <div class="message-meta">
          <span style="font-size:10px; margin-left:4px;">${editedText}</span>
          <span>${msg.time}</span>
          ${ticksHtml}
        </div>
      `;

      if (msg.reactions) {
        let reactionsHtml = `<div class="reactions-bar">`;
        Object.keys(msg.reactions).forEach(emoji => {
          reactionsHtml += `<span class="reaction-badge">${emoji}</span>`;
        });
        reactionsHtml += `</div>`;
        innerContent += reactionsHtml;
      }

      innerContent += `
        <button type="button" class="message-actions-trigger"><i class="fa-solid fa-chevron-down"></i></button>
        <div class="message-dropdown hidden">
          <button type="button" class="reply-action"><i class="fa-solid fa-reply"></i> رد</button>
          <button type="button" class="react-action"><i class="fa-regular fa-face-smile"></i> تفاعل</button>
          <button type="button" class="pin-action"><i class="fa-solid fa-thumbtack"></i> تثبيت</button>
          ${msg.sender === currentUser && !msg.deleted ? '<button type="button" class="edit-action"><i class="fa-solid fa-pen"></i> تعديل</button>' : ''}
          ${msg.sender === currentUser && !msg.deleted ? '<button type="button" class="delete-action"><i class="fa-solid fa-trash"></i> حذف</button>' : ''}
        </div>
      `;

      messageDiv.innerHTML = innerContent;

      const triggerBtn = messageDiv.querySelector(".message-actions-trigger");
      const dropdown = messageDiv.querySelector(".message-dropdown");

      triggerBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll(".message-dropdown").forEach(d => {
          if (d !== dropdown) d.classList.add("hidden");
        });
        dropdown.classList.toggle("hidden");
      });

      messageDiv.querySelector(".reply-action")?.addEventListener("click", () => {
        replyingTo = { id: msg.id, text: msg.text || "ميديا", sender: msg.sender };
        replyPreviewText.textContent = `رد على: ${replyingTo.text}`;
        replyPreview.classList.remove("hidden");
        dropdown.classList.add("hidden");
        messageInput.focus();
      });

      messageDiv.querySelector(".replied-box")?.addEventListener("click", () => {
        const targetId = msg.replyTo.id;
        const targetEl = document.getElementById(`msg-${targetId}`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          targetEl.classList.add("highlight");
          setTimeout(() => targetEl.classList.remove("highlight"), 2000);
        }
      });

      messageDiv.querySelector(".react-action")?.addEventListener("click", () => {
        const emoji = prompt("اختر إيموجي للتفاعل (❤️, 👍, 😂, 🔥):", "❤️");
        if (emoji) {
          update(ref(db, `messages/${msg.id}/reactions`), { [currentUser]: emoji });
        }
        dropdown.classList.add("hidden");
      });

      messageDiv.querySelector(".pin-action")?.addEventListener("click", () => {
        set(pinnedRef, msg.id);
        dropdown.classList.add("hidden");
      });

      messageDiv.querySelector(".edit-action")?.addEventListener("click", () => {
        const newText = prompt("تعديل الرسالة:", msg.text);
        if (newText !== null && newText.trim() !== "") {
          update(ref(db, `messages/${msg.id}`), { tex
