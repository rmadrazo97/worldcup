// Firebase bootstrap for the World Cup PWA.
//
// Lazy-initialized: nothing happens at import time. Call `initClient()` once
// from main.jsx before rendering the app. App Check is initialized before any
// Firestore / Functions calls so the first request carries a valid token.

import { initializeApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

let _state = null

export function initClient() {
  if (_state) return _state
  const cfg = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  }
  const app = initializeApp(cfg)
  const useEmulator = import.meta.env.VITE_USE_EMULATORS === 'true'
  if (useEmulator && typeof self !== 'undefined') {
    // eslint-disable-next-line no-undef
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true
  }
  let appCheck = null
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_KEY
  if (recaptchaKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    })
  }
  const auth = getAuth(app)
  const region = import.meta.env.VITE_FUNCTIONS_REGION || 'us-central1'
  const functions = getFunctions(app, region)
  const db = getFirestore(app)
  if (useEmulator) {
    connectFirestoreEmulator(db, 'localhost', 8080)
    connectFunctionsEmulator(functions, 'localhost', 5001)
  }
  signInAnonymously(auth).catch(() => { /* ignored */ })
  _state = { app, auth, functions, db, appCheck }
  return _state
}

export function getClient() {
  if (!_state) throw new Error('initClient() must be called first')
  return _state
}

export function callable(name) {
  return httpsCallable(getClient().functions, name)
}

// Surface readable errors. Returns the underlying object so callers can also inspect.
export function unwrapCallable(name, args) {
  return callable(name)(args).then(r => r.data, (err) => {
    const e = new Error(err.message || `Call ${name} failed`)
    e.code = err.code || 'unknown'
    e.details = err.details
    throw e
  })
}

export async function onAuthReady() {
  const { auth } = getClient()
  if (auth.currentUser) return auth.currentUser
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (u) => { if (u) { unsub(); resolve(u) } })
  })
}
