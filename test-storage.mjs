import { initializeApp } from 'firebase/app'; 
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getStorage, ref, uploadString } from 'firebase/storage'; 

const firebaseConfig = { 
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY, 
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, 
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, 
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, 
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, 
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID 
}; 
const app = initializeApp(firebaseConfig); 
const auth = getAuth(app);
const storage = getStorage(app); 

async function test() {
  try {
    await signInAnonymously(auth);
    const storageRef = ref(storage, 'test-bucket/test.txt'); 
    await uploadString(storageRef, 'Hello');
    console.log('Storage OK');
    process.exit(0);
  } catch (e) {
    console.error('Storage Error:', e.code, e.customData?.serverResponse || e.message);
    process.exit(1);
  }
}

test();
