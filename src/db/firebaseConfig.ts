import { initializeApp } from 'firebase/app';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  projectId: "gen-lang-client-0909971140",
  appId: "1:333205666442:web:47cf9ae76a5da3da83cb73",
  apiKey: "AIzaSyD3XLd-xMvgHqCjKid4Og7WohW2OLO6GJ0",
  authDomain: "gen-lang-client-0909971140.firebaseapp.com",
  storageBucket: "gen-lang-client-0909971140.firebasestorage.app",
  messagingSenderId: "333205666442",
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with offline persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
