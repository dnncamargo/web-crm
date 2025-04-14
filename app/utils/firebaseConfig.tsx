import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBsWohZAor136L0zwo2_0GzXWjrqdbwWEc",
  authDomain: "web-crm-6c3a2.firebaseapp.com",
  projectId: "web-crm-6c3a2",
  storageBucket: "web-crm-6c3a2.firebasestorage.app",
  messagingSenderId: "996833302397",
  appId: "1:996833302397:web:32242ea9faee8b288b5e14",
  measurementId: "G-SMYQW1TE33"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };