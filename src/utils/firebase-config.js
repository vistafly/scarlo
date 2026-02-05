// Firebase Configuration
// Environment variables are loaded from .env file
// See .env.example for required variables

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// ============================================================
// DEVELOPER EMAIL - Used to determine who can finalize contracts
// Add VITE_DEVELOPER_EMAIL=your-email@gmail.com to your .env file
// ============================================================
window.VITE_DEVELOPER_EMAIL = import.meta.env.VITE_DEVELOPER_EMAIL || '';

// Validate configuration
if (!firebaseConfig.apiKey) {
    console.error('Firebase configuration error: Missing environment variables!');
    console.error('Please create a .env file based on .env.example');
    console.error('Add your Firebase credentials from Firebase Console');
}

if (!window.VITE_DEVELOPER_EMAIL) {
    console.error('VITE_DEVELOPER_EMAIL not set in .env file!');
    console.error('Add this line to your .env: VITE_DEVELOPER_EMAIL=your-email@gmail.com');
}

// Wait for Firebase SDK to be available before initializing
function waitForFirebase(maxAttempts = 50) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const check = () => {
            attempts++;
            if (typeof firebase !== 'undefined' && firebase.initializeApp && firebase.auth && firebase.firestore) {
                resolve();
            } else if (attempts >= maxAttempts) {
                reject(new Error('Firebase SDK failed to load'));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// Initialize Firebase and expose a ready promise
window.firebaseReady = waitForFirebase().then(() => {
    firebase.initializeApp(firebaseConfig);

    window.auth = firebase.auth();
    window.db = firebase.firestore();
    window.googleProvider = new firebase.auth.GoogleAuthProvider();

    // Disable app verification for testing with Firebase Console test phone numbers
    window.auth.settings.appVerificationDisabledForTesting = true;

    console.log('Firebase initialized successfully');

    // Dispatch event for any listeners waiting on Firebase
    window.dispatchEvent(new Event('firebaseReady'));

    return { auth: window.auth, db: window.db, googleProvider: window.googleProvider };
}).catch(err => {
    console.error('Failed to initialize Firebase:', err);
    throw err;
});