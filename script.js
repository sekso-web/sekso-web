import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  onValue,
  query,
  orderByChild,
  equalTo,
  set,
  update,
  onDisconnect,
  serverTimestamp,
  remove, // buraya ekle
} from "https://www.gstatic.com/firebasejs/10.4.0/firebase-database.js";

// --- Firebase Config (senin verdiğin) ---
const firebaseConfig = {
  apiKey: "AIzaSyCkNo7zhYAZZgymJt071y9SNK0wE98Ps3s",
  authDomain: "seksoweb-53dad.firebaseapp.com",
  databaseURL:
    "https://seksoweb-53dad-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "seksoweb-53dad",
  storageBucket: "seksoweb-53dad.firebasestorage.app",
  messagingSenderId: "907607119823",
  appId: "1:907607119823:web:1b9f7a9a57bc8af2c264ba",
  measurementId: "G-W7FS0E73XZ",
};

// --- Cloudinary Config ---
const cloudinaryCloudName = "diiznmzls";
const cloudinaryUploadPreset = "chat_preset";

// --- Initialize Firebase ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// --- DOM Elements ---
const sidebarBoards = document.querySelectorAll("#sidebar .board-item");
const chatMessagesEl = document.getElementById("chat-messages");
const chatMessages = document.getElementById("chat-messages");
const messageInput = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const mediaUploadBtn = document.getElementById("mediaUploadBtn");
const mediaInput = document.getElementById("mediaInput");
const mediaPreviewBox = document.getElementById("mediaPreviewBox");
const gifBtn = document.getElementById("gifBtn");
const searchInput = document.getElementById("searchInput");
const searchUserSelect = document.getElementById("searchUserSelect");

const userPfp = document.getElementById("userPfp");
const userDisplayName = document.getElementById("userDisplayName");
const authButtons = document.getElementById("authButtons");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const profileEdit = document.getElementById("profileEdit");
const displayNameInput = document.getElementById("displayNameInput");
const colorPicker = document.getElementById("colorPicker");
const pfpUpload = document.getElementById("pfpUpload");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const logoutBtn = document.getElementById("logoutBtn");

const appElement = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const profilePanel = document.getElementById("profile-panel");
const chatPanel = document.getElementById("chat-panel");

const activeUsersList = document.getElementById("activeUsersList");

let currentBoard = "genel";
let currentUser = null;
let activeUsers = {};
let anonCount = 0; // Arka planda kaç anon var, localStorage ile takip edilecek
let lastMessageIds = new Set();

// Mesaj veritabanı yolu: /messages/genel, /messages/pol, ...
// Aktif kullanıcılar yolu: /activeUsers

// -----------------------
// UTILS
// -----------------------

// Tarihi okunabilir yap
function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleString("tr-TR", {
    hour12: false,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

mediaInput.addEventListener("change", () => {
  if (mediaInput.files.length > 0) {
    mediaPreviewBox.style.display = "block"; // medya var → göster
  } else {
    mediaPreviewArea.style.display = "none"; // medya yok → gizle
  }
});


// Scroll aşağı in
function scrollChatToBottom(force = false) {
  const el = chatMessagesEl;
  const threshold = 100; // ne kadar yukarıdaysa fırlatma

  const shouldScroll = force ||
    el.scrollHeight - el.scrollTop - el.clientHeight < threshold;

  if (shouldScroll) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const lastMessage = el.lastElementChild;
        if (lastMessage) {
          lastMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });
  }
}

// Firebase push hata ayıklama için
function logError(e) {
  console.error("Hata:", e);
}

// -----------------------
// AUTH / USER MANAGEMENT
// -----------------------
// Modallar ve ilgili DOM elementleri
const loginModal = document.getElementById("loginModal");
const registerModal = document.getElementById("registerModal");
const errorModal = document.getElementById("errorModal");
const errorMessageEl = document.getElementById("errorMessage");

const loginUsernameInput = document.getElementById("loginUsername");
const loginPasswordInput = document.getElementById("loginPassword");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");

const registerUsernameInput = document.getElementById("registerUsername");
const registerEmailInput = document.getElementById("registerEmail");
const registerPasswordInput = document.getElementById("registerPassword");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

const modalCloseBtns = document.querySelectorAll(".modalCloseBtn");

// Modal açma-kapama fonksiyonları
function openModal(modal) {
  modal.style.display = "flex";
}
function closeModal(modal) {
  modal.style.display = "none";
}

// Kapanma butonlarını bağla
modalCloseBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    btn.closest(".modal").style.display = "none";
  });
});

// Hata modalı göster
function showError(msg) {
  errorMessageEl.textContent = msg;
  openModal(errorModal);
}

// Login modal butonu event
loginBtn.addEventListener("click", () => {
  openModal(loginModal);
});

// Register modal butonu event
registerBtn.addEventListener("click", () => {
  openModal(registerModal);
});

sidebarBoards.forEach(board => {
  board.addEventListener("click", () => {
    // Tüm boardlardan active classını kaldır
    sidebarBoards.forEach(b => b.classList.remove("active"));

    // Tıklanan boarda active class ekle
    board.classList.add("active");

    // currentBoard değiştir
    currentBoard = board.getAttribute("data-board");

    console.log("Seçilen board: ", currentBoard); // Bunu ekle, test için

    // Chat mesajlarını temizle
    chatMessages.innerHTML = "";

    lastMessageIds = new Set(); // Son mesaj ID'lerini sıfırla
    listenMessages();          // Yeni board mesajlarını dinlemeye başla
    scrollChatToBottom(true);  // Scroll'u aşağıya çek
  });
});


loginSubmitBtn.addEventListener("click", async () => {
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;

  if (!username) return showError("Kullanıcı adı gerekli.");
  if (!password) return showError("Şifre gerekli.");

  try {
    // Kullanıcı adı ile email bul (users node içinde username'e göre sorgu)
    const usersRef = ref(db, "users");
    let foundEmail = null;

    await new Promise((resolve, reject) => {
      onValue(
        usersRef,
        (snapshot) => {
          const users = snapshot.val() || {};
          for (const uid in users) {
            if (users[uid].username === username) {
              foundEmail = users[uid].email;
              break;
            }
          }
          resolve();
        },
        { onlyOnce: true }
      );
    });

    if (!foundEmail) {
      return showError("Kullanıcı bulunamadı.");
    }

    // Email bulundu, giriş yap
    await signInWithEmailAndPassword(auth, foundEmail, password);

    // Anon kullanıcıyı aktif kullanıcı listesinden kaldır
    if (currentUser.anonId) {
      const anonRef = ref(db, `activeUsers/anon${currentUser.anonId}`);
      await remove(anonRef);
    }

    closeModal(loginModal);
    loginUsernameInput.value = "";
    loginPasswordInput.value = "";

    // Sayfayı yenile
    location.reload();

  } catch (e) {
    showError("Giriş yapılamadı: " + e.message);
  }
});


registerSubmitBtn.addEventListener("click", async () => {
  const username = registerUsernameInput.value.trim();
  const email = registerEmailInput.value.trim();
  const password = registerPasswordInput.value;

  if (!username || !/^\w{3,20}$/.test(username)) {
    return showError("Geçerli kullanıcı adı girin (3-20 karakter, boşluk yok).");
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return showError("Geçerli bir e-posta adresi girin.");
  }

  if (!password || password.length < 6) {
    return showError("Şifre en az 6 karakter olmalı.");
  }

  try {
    // Kullanıcı adı alınmış mı?
    const usersRef = ref(db, "users");
    let usernameTaken = false;

    await new Promise((resolve) => {
      onValue(
        usersRef,
        (snapshot) => {
          const users = snapshot.val() || {};
          for (const uid in users) {
            if (users[uid].username === username) {
              usernameTaken = true;
              break;
            }
          }
          resolve();
        },
        { onlyOnce: true }
      );
    });

    if (usernameTaken) {
      return showError("Kullanıcı adı zaten alınmış.");
    }

    // Kayıt işlemi
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(cred.user, {
      displayName: username,
      photoURL: "pfp.png",
    });

    const userRef = ref(db, `users/${cred.user.uid}`);
    await set(userRef, {
      username,
      email,
      displayName: username,
      color: "#e6c200",
      photoURL: "pfp.png",
      createdAt: serverTimestamp(),
    });

    // Anon kullanıcıyı aktif listeden çıkar
    if (currentUser?.anonId) {
      const anonRef = ref(db, `activeUsers/anon${currentUser.anonId}`);
      await remove(anonRef);
    }

    closeModal(registerModal);
    registerUsernameInput.value = "";
    registerEmailInput.value = "";
    registerPasswordInput.value = "";

    location.reload();
  } catch (e) {
    showError("Kayıt yapılamadı: " + e.message);
  }
});



async function assignAnonUser() {
  let anonId = localStorage.getItem("anonId");
  if (anonId) return anonId;

  const lastAnonRef = ref(db, "lastAnonId");
  let snapshot = await new Promise((res) => {
    onValue(lastAnonRef, (snap) => res(snap), { onlyOnce: true });
  });

  let lastAnonId = snapshot.val() || 0;
  const newAnonId = lastAnonId + 1;

  await set(lastAnonRef, newAnonId);
  localStorage.setItem("anonId", newAnonId);
  return newAnonId;
}

// Anon kullanıcı info ayarlama
async function setAnonUserInfo() {
  const anonId = await assignAnonUser();
  currentUser = {
    uid: null,
    displayName: `anon${anonId}`,     // ✅ Aynı kullanıcı adı gibi görünsün
    color: "#FDAEA7",
    photoURL: "pfp.png",
    isAnon: true,
    anonId,
    username: `anon${anonId}`,        // ✅ Eşsiz kullanıcı adı
  };
}

if (currentUser) {
  userDisplayName.textContent = currentUser.displayName;
  document.getElementById("userUsername").textContent = "@" + currentUser.username;
  userPfp.src = currentUser.photoURL;

  showAuthButtons(true);
  showProfileEdit(false);
  trackActiveUser();
} else {
  // currentUser yoksa default değerler atanabilir
  userDisplayName.textContent = "Anonim Kullanıcı";
  document.getElementById("userUsername").textContent = "";
  userPfp.src = "pfp.png";

  showAuthButtons(false);
  showProfileEdit(false);
}



// Aktif kullanıcıyı realtime DB’de işaretle ve bağlantı kesilince kaldır
function trackActiveUser() {
  if (!currentUser) return;

  const userId = currentUser.uid || `anon${currentUser.anonId}`;
  const userRef = ref(db, `activeUsers/${userId}`);

  set(userRef, {
    displayName: currentUser.displayName,
    username: currentUser.username,  // ← BUNU EKLE!
    color: currentUser.color || "#ccc",
    photoURL: currentUser.photoURL || "pfp.png",
    lastSeen: serverTimestamp(),
  }).catch(logError);

  const connectedRef = ref(db, ".info/connected");
  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(userRef).remove();
    }
  });
}


// Login form popup (prompt) basit, email + KA girilir, DN yok
async function login() {
  const email = prompt("Email adresinizi girin:");
  if (!email) return alert("Email gerekli");
  const password = prompt("Şifrenizi girin:");
  if (!password) return alert("Şifre gerekli");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    // Kullanıcı güncellenecek, onAuthStateChanged ile yakalanır
  } catch (e) {
    alert("Giriş yapılamadı: " + e.message);
  }
}

// Kayıt form popup (prompt) basit, email + KA + şifre
async function register() {
  const username = prompt("Kullanıcı adınızı girin (benzersiz, boşluk yok):");
  if (!username || !/^\w{3,20}$/.test(username)) {
    return alert("Geçerli bir kullanıcı adı girin (3-20 karakter, boşluk yok).");
  }
  const email = prompt("Email adresinizi girin:");
  if (!email) return alert("Email gerekli");
  const password = prompt("Şifre oluşturun (6+ karakter):");
  if (!password || password.length < 6)
    return alert("Şifre en az 6 karakter olmalı.");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    // Kayıt başarılı, profile ek bilgi yazılacak
    // Kullanıcı adı ve display name olarak username ayarlanacak:
    await updateProfile(cred.user, {
      displayName: username,
      photoURL: "pfp.png",
    });

    // DB'de kullanıcı kaydı oluştur (örnek)
    const userRef = ref(db, `users/${cred.user.uid}`);
    await set(userRef, {
      username,
      displayName: username,
      color: "#e6c200",
      photoURL: "pfp.png",
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    alert("Kayıt yapılamadı: " + e.message);
  }
}

// Giriş-çıkış butonları göster/gizle
function showAuthButtons(show) {
  authButtons.style.display = show ? "flex" : "none";
}

// Profil düzenleme paneli göster/gizle
function showProfileEdit(show) {
  profileEdit.style.display = show ? "flex" : "none";
}

// Çıkış yap
async function logout() {
  try {
    await signOut(auth);
    currentUser = null;
    await setAnonUserInfo();
    location.reload();
  } catch (e) {
    alert("Çıkış yapılamadı: " + e.message);
  }
}

// Kullanıcı auth durumunu dinle
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const userRef = ref(db, `users/${user.uid}`);
    onValue(
      userRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.val();
          currentUser = {
            uid: user.uid,
            displayName:
              data.displayName ||
              user.displayName ||
              user.email?.split("@")[0] ||
              "Anon",
            color: data.color || "#ff3e6c", // Kullanıcının kayıtlı rengi
            photoURL:
              data.photoURL || user.photoURL || "pfp.png",
            isAnon: false,
            username:
              data.username || user.email?.split("@")[0] || "",
          };

          userDisplayName.textContent = currentUser.displayName;
          userPfp.src = currentUser.photoURL;
          document.getElementById("userUsername").textContent =
            "@" + currentUser.username;

          showAuthButtons(false);
          showProfileEdit(true);
          trackActiveUser();
        } else {
          // Kullanıcı verisi DB'de yoksa fallback
          currentUser = {
            uid: user.uid,
            displayName:
              user.displayName || user.email?.split("@")[0] || "Anon",
            color: "#ff3e6c",
            photoURL: user.photoURL || "pfp.png",
            isAnon: false,
            username: user.email?.split("@")[0] || "",
          };

          userDisplayName.textContent = currentUser.displayName;
          userPfp.src = currentUser.photoURL;
          document.getElementById("userUsername").textContent =
            "@" + currentUser.username;

          showAuthButtons(false);
          showProfileEdit(true);
          trackActiveUser();
        }
      },
      { onlyOnce: true }
    );
  } else {
    await setAnonUserInfo();

    userDisplayName.textContent = currentUser.displayName || "Anonim Kullanıcı";
    document.getElementById("userUsername").textContent =
      "@" + (currentUser.username || "anon1");
    userPfp.src = currentUser.photoURL || "pfp.png";

    showAuthButtons(true);
    showProfileEdit(false);
    trackActiveUser(); // anonim kullanıcı takibi
  }

  listenMessages();
  listenActiveUsers();
});

// Profil düzenleme kayıt işlemi
saveProfileBtn.addEventListener("click", async () => {
  if (!currentUser || currentUser.isAnon) {
    return showError("Giriş yapmalısınız.");
  }

  const newDisplayName = displayNameInput.value.trim();
  const newColor = colorPicker.value;
  const newPfpFile = pfpUpload.files[0];

  const finalDisplayName = newDisplayName || currentUser.displayName;
  let updatedData = {};

  // DisplayName değişmişse
  if (newDisplayName && newDisplayName !== currentUser.displayName) {
    updatedData.displayName = newDisplayName;
  }

  // Renk değişmişse
  if (newColor && newColor !== currentUser.color) {
    updatedData.color = newColor;
  }

  try {
    // Profil resmi yüklendiyse
    if (newPfpFile) {
      const uploadResult = await uploadToCloudinary(newPfpFile);
      currentUser.photoURL = uploadResult.secure_url;
      userPfp.src = currentUser.photoURL;
      updatedData.photoURL = currentUser.photoURL;
    }

    // Değişiklik varsa Firebase profil ve DB'yi güncelle
    if (Object.keys(updatedData).length > 0) {
      // Firebase auth profili
      await updateProfile(auth.currentUser, {
        displayName: updatedData.displayName || currentUser.displayName,
        photoURL: updatedData.photoURL || currentUser.photoURL,
      });

      // Realtime DB güncellemesi
      const userRef = ref(db, `users/${auth.currentUser.uid}`);
      await update(userRef, updatedData);

      // local currentUser güncelle
      if (updatedData.displayName) currentUser.displayName = updatedData.displayName;
      if (updatedData.color) currentUser.color = updatedData.color;
      if (updatedData.photoURL) currentUser.photoURL = updatedData.photoURL;

      userDisplayName.textContent = currentUser.displayName;
      document.getElementById("userUsername").textContent = "@" + currentUser.username;
      userPfp.src = currentUser.photoURL;

      // Aktif kullanıcıyı da güncelle
      trackActiveUser();

      showError("Profil güncellendi!");
    } else {
      showError("Hiçbir değişiklik yapılmadı.");
    }
  } catch (e) {
    showError("Profil güncellenemedi: " + e.message);
  }
});

// -----------------------
// MESAJLAŞMA
// -----------------------

// Mesaj objesi oluştur

function createMessageObject(text, mediaUrls = []) {
  return {
    uid: currentUser.uid || `anon${currentUser.anonId}`,
    displayName: currentUser.displayName,
    color: currentUser.color,
    photoURL: currentUser.photoURL,
    text: text || "",
    media: mediaUrls,
    timestamp: Date.now(),
    board: currentBoard, // 🟢 bu satırı ekle
  };
}


// Mesaj gönder
async function sendMessage() {
  const text = messageInput.value.trim();
  const files = mediaInput.files;

  if (!text && files.length === 0) {
    alert("Mesaj ya da medya ekleyin.");
    return;
  }

  let uploadedUrls = [];
  if (files.length > 0) {
    try {
      const results = await Promise.all(
        Array.from(files).map(uploadToCloudinary)
      );
      uploadedUrls = results.map((res) => res.secure_url);
    } catch (e) {
      alert("Medya yükleme başarısız: " + e.message);
      return;
    }
  }

  const msgObj = createMessageObject(text, uploadedUrls);
  const messagesRef = ref(db, "messages");

  try {
    const newMessageRef = push(messagesRef);
    await set(newMessageRef, msgObj);
    scrollChatToBottom(true); // ✅ kendi mesajımızsa zorla in
    messageInput.value = "";
    mediaInput.value = "";
    document.getElementById("mediaPreviewArea").innerHTML = "";
    scrollChatToBottom(true); // ✅ kendi mesajımızsa zorla in
  } catch (e) {
    alert("Mesaj gönderilemedi: " + e.message);
  }
}

// Cloudinary yükleme fonksiyonu
async function uploadToCloudinary(file) {
  const url = `https://api.cloudinary.com/v1_1/${cloudinaryCloudName}/upload`;
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", cloudinaryUploadPreset);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Cloudinary yükleme hatası");
  return await res.json();
}

// Mesajları dinle ve göster
function listenMessages() {
  const messagesRef = ref(db, 'messages');
  const boardQuery = query(messagesRef, orderByChild('board'), equalTo(currentBoard));
  onValue(boardQuery, (snapshot) => {
    console.log("snapshot mesajları:", snapshot.val());
    const messages = snapshot.val();
    if (!messages) return;

    const arr = Object.entries(messages).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    for (const [key, msg] of arr) {
      if (!lastMessageIds.has(key)) {
        appendMessage(msg);
        lastMessageIds.add(key);
      }
    }

    scrollChatToBottom();
  });
}

// Mesaj DOM'a ekle
const messagesContainer = document.getElementById("chat-messages");

function appendMessage(msg) {
  console.log("Mesaj ekleniyor, messagesContainer:", messagesContainer);
  const messageEl = document.createElement("div");
  messageEl.classList.add("message");

  // Kimden geldi?
  const isOwnMessage = msg.senderId === (currentUser.uid || `anon${currentUser.anonId}`);

  // Mention içeriyor mu?
  const isMentioned = msg.text &&
    msg.text.toLowerCase().includes("@" + currentUser.username.toLowerCase());

  // Sadece başkası mentionladıysa sarı efekti ver
  if (isMentioned && !isOwnMessage) {
    messageEl.classList.add("mentioned");
  }

  // Profil resmi
  const pfp = document.createElement("img");
  pfp.classList.add("pfp");
  pfp.src = msg.photoURL || "pfp.png";
  pfp.alt = `${msg.displayName || "Anon"} profil resmi`;
  messageEl.appendChild(pfp);

  // Mesaj içeriği
  const content = document.createElement("div");
  content.classList.add("content");

  // Header: isim ve zaman
  const header = document.createElement("div");
  header.classList.add("header");

  const nameSpan = document.createElement("span");
  nameSpan.classList.add("displayName");
  nameSpan.textContent = msg.displayName || "Anon";
  if (msg.color) nameSpan.style.color = msg.color;
  header.appendChild(nameSpan);

  const timeSpan = document.createElement("span");
  timeSpan.classList.add("timestamp");
  timeSpan.textContent = formatTimestamp(msg.timestamp);
  header.appendChild(timeSpan);

  content.appendChild(header);

  // Mesaj metni varsa
  if (msg.text) {
    const textP = document.createElement("p");
    textP.classList.add("text");

    const taggedText = msg.text.replace(/@(\w{3,20})/g, (match, username) => {
      const user = Object.values(activeUsers).find(u =>
        u.username && u.username.toLowerCase() === username.toLowerCase()
      );

      if (user) {
        return `<span class="mention" data-username="${user.username}" title="${user.displayName}">@${user.username}</span>`;
      } else {
        return match;
      }
    });

    textP.innerHTML = taggedText;

    // Mentiona tıklanınca arama inputunu güncelle
    textP.addEventListener("click", (e) => {
      if (e.target.classList.contains("mention")) {
        const username = e.target.textContent.slice(1);
        searchUserSelect.value = username;
        searchInput.value = "";
        searchInput.dispatchEvent(new Event("input"));
      }
    });

    content.appendChild(textP);
  }

  // Medya varsa
  if (msg.media && msg.media.length > 0) {
    const mediaList = document.createElement("div");
    mediaList.classList.add("media-list");

    for (const url of msg.media) {
      let mediaEl;

      if (url.match(/\.(mp4|webm|ogg)$/i)) {
        mediaEl = document.createElement("video");
        mediaEl.src = url;
        mediaEl.controls = true;
        mediaEl.preload = "metadata";
        mediaEl.width = 320;
        mediaEl.height = 180;
      } else {
        mediaEl = document.createElement("img");
        mediaEl.src = url;
        mediaEl.style.maxWidth = "320px";
        mediaEl.style.maxHeight = "180px";
        mediaEl.style.objectFit = "contain";
      }

      mediaEl.style.cursor = "pointer";

      mediaEl.addEventListener("click", () => {
        const modal = document.getElementById("mediaModal");
        let modalContent = document.getElementById("mediaModalContent");

        if (modalContent.tagName === "VIDEO") {
          modalContent.pause();
          modalContent.src = "";
        }

        if (url.match(/\.(mp4|webm|ogg)$/i)) {
          modalContent.outerHTML = `<video id="mediaModalContent" controls autoplay style="max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 10px #ff6f91;"></video>`;
        } else {
          modalContent.outerHTML = `<img id="mediaModalContent" style="max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 10px #ff6f91;" />`;
        }

        modalContent = document.getElementById("mediaModalContent");
        modalContent.src = url;

        modal.classList.add("active");
      });

      mediaList.appendChild(mediaEl);
    }

    content.appendChild(mediaList);
  }

  messageEl.appendChild(content);

  // Scroll davranışı: sadece kullanıcı en alttaysa otomatik scroll
  const nearBottom =
    messagesContainer.scrollTop + messagesContainer.clientHeight >= messagesContainer.scrollHeight - 100;

  messagesContainer.appendChild(messageEl);

  if (nearBottom) {
    setTimeout(() => {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 0);
  }
}

sidebarBoards.forEach((boardEl) => {
  boardEl.addEventListener("click", () => {
    if (boardEl.classList.contains("active")) return;

    sidebarBoards.forEach((b) => b.classList.remove("active"));
    boardEl.classList.add("active");

    currentBoard = boardEl.dataset.board;
    lastMessageIds = new Set();
    chatMessages.innerHTML = "";

    listenMessages();
    scrollChatToBottom(true);
  });
});

function listenActiveUsers() {
  const activeUsersRef = ref(db, "activeUsers");
  onValue(activeUsersRef, (snapshot) => {
    activeUsersList.innerHTML = "";
    const users = snapshot.val();
    if (!users) return;

    activeUsers = Object.values(users);

    for (const u of activeUsers) {
      const li = document.createElement("li");

      const pfp = document.createElement("img");
      pfp.classList.add("pfp");
      pfp.src = u.photoURL || "pfp.png";
      pfp.alt = (u.displayName || "Anonim") + " profil resmi";
      li.appendChild(pfp);

      const name = document.createElement("span");
      // Burada anonim kullanıcı ise isim sonuna (Anon) ekle veya renk değiştir
      if (u.isAnon) {
        name.textContent = u.username || "Anon";
        name.style.fontStyle = "italic";
        name.style.color = "#FDAEA7"; // Anon kullanıcılar için renk
      } else {
        name.textContent = u.username
          ? `@${u.username}`
          : u.displayName;
        if (u.color) name.style.color = u.color;
      }
      li.appendChild(name);

      activeUsersList.appendChild(li);
    }
  });
}

searchInput.addEventListener("input", () => {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedUser = searchUserSelect.value;

  if (!keyword) {
    // Filtre boşsa normal mesajları dinle
    listenMessages();
    return;
  }

  const messagesRef = ref(db, `messages/${currentBoard}`);
  onValue(
    messagesRef,
    (snapshot) => {
      chatMessages.innerHTML = "";
      const messages = snapshot.val();
      if (!messages) return;

      const arr = Object.values(messages).filter((msg) => {
        const userMatch = selectedUser === "" || selectedUser === "all" || msg.displayName === selectedUser;
        return userMatch && msg.text?.toLowerCase().includes(keyword);
      });
      arr.sort((a, b) => a.timestamp - b.timestamp);
      arr.forEach(appendMessage);
      scrollChatToBottom();
    },
    { onlyOnce: true }
  );
});

// Kullanıcı arama select içine aktif kullanıcıları doldur
function fillUserSearchSelect() {
  const activeUsersRef = ref(db, "activeUsers");
  onValue(
    activeUsersRef,
    (snapshot) => {
      const users = snapshot.val() || {};
      searchUserSelect.innerHTML = '<option value="all">Tüm kullanıcılar</option>';
      Object.values(users).forEach((u) => {
        const opt = document.createElement("option");
        opt.value = u.displayName;
        opt.textContent = u.displayName;
        searchUserSelect.appendChild(opt);
      });
    },
    { onlyOnce: true }
  );
}

sendBtn.addEventListener("click", sendMessage);
messageInput.addEventListener("keydown", (e) => {
  // Yazı yazarken input çevresine glow ekle
  messageInput.classList.add("glow");

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
    // Mesaj gönderildikten sonra glow'u kaldır
    messageInput.classList.remove("glow");
  }
});

mediaUploadBtn.addEventListener("click", () => {
  mediaInput.click();
});

mediaInput.addEventListener("change", () => {
  const previewArea = document.getElementById("mediaPreviewArea");
  previewArea.innerHTML = ""; // Önceki önizlemeleri temizle

  Array.from(mediaInput.files).forEach((file, index) => {
    const url = URL.createObjectURL(file);
    let previewEl;

    if (file.type.startsWith("video/")) {
      previewEl = document.createElement("video");
      previewEl.src = url;
      previewEl.controls = false;
      previewEl.muted = true;
      previewEl.loop = true;
      previewEl.autoplay = true;
    } else {
      previewEl = document.createElement("img");
      previewEl.src = url;
    }

    previewEl.classList.add("media-preview");

    // Container div ile pozisyonlama (x butonu için)
    const container = document.createElement("div");
    container.style.position = "relative";
    container.appendChild(previewEl);

    // Kaldırma butonu
    const closeBtn = document.createElement("span");
    closeBtn.textContent = "×";
    closeBtn.classList.add("media-preview-close");
    closeBtn.addEventListener("click", () => {
      // Dosyayı mediaInput'dan kaldırmak için dosyaları yeniden oluştur
      const dt = new DataTransfer();
      Array.from(mediaInput.files)
        .filter((_, i) => i !== index)
        .forEach((f) => dt.items.add(f));
      mediaInput.files = dt.files;

      // Önizlemeyi kaldır
      container.remove();
    });

    container.appendChild(closeBtn);
    previewArea.appendChild(container);
  });
});


gifBtn.addEventListener("click", () => {
  alert("Gif desteği eklenecek!");
});

// Medya modal çarpıya tıklanınca kapansın
document.getElementById("mediaModalClose").addEventListener("click", () => {
  const modal = document.getElementById("mediaModal");
  const modalContent = document.getElementById("mediaModalContent");

  // Video oynatılıyorsa durdur
  if (modalContent.tagName === "VIDEO") {
    modalContent.pause();
    modalContent.src = "";
  }

  modal.classList.remove("active");
});

// Mobil üst panel butonları
// Mobil üst panel butonları
const mobileBoardsBtn = document.getElementById("mobileBoardsBtn");
const mobileUsersBtn = document.getElementById("mobileUsersBtn");
const mobileSearchBtn = document.getElementById("mobileSearchBtn");

mobileBoardsBtn.addEventListener("click", () => {
  sidebar.classList.add("active");
  profilePanel.classList.remove("active");
  chatPanel.classList.add("slide-left");
});

mobileUsersBtn.addEventListener("click", () => {
  profilePanel.classList.add("active");
  sidebar.classList.remove("active");
  chatPanel.classList.add("slide-right");
});

mobileSearchBtn.addEventListener("click", () => {
  sidebar.classList.remove("active");
  profilePanel.classList.remove("active");
  chatPanel.classList.remove("slide-left", "slide-right");
});

(async () => {
  await setAnonUserInfo();

  if (currentUser) {
    const userDisplayName = document.getElementById("userDisplayName");
    if (userDisplayName) {
      userDisplayName.textContent = currentUser.displayName;
    }
    const userUsername = document.getElementById("userUsername");
    if (userUsername) {
      userUsername.textContent = "@" + currentUser.username;
    }
  }

  // listenMessages(); 

  listenActiveUsers();
  fillUserSearchSelect();

  logoutBtn.addEventListener("click", logout);
})();