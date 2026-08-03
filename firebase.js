import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { 
  getDatabase, 
  ref, 
  push, 
  set, 
  onValue, 
  remove, 
  update, 
  onDisconnect 
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXlHlo6btIGsqGdC86cq1UC3MOWSACf08",
  authDomain: "whatsapp-eee.firebaseapp.com",
  projectId: "whatsapp-eee",
  storageBucket: "whatsapp-eee.firebasestorage.app",
  messagingSenderId: "486427299738",
  appId: "1:486427299738:web:60412af1407344b478f423",
  databaseURL: "https://whatsapp-eee-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db, ref, push, set, onValue, remove, update, onDisconnect };
