// src/firebase/config.ts
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'
import { getStorage } from 'firebase/storage'

// Tu configuración de Firebase, la misma que usas en la app de Electron.
const firebaseConfig = {
  apiKey: 'AIzaSyDgaO6YDaHSsdypxbl8iyPDOmgikE5ayTU',
  authDomain: 'sisfumi2.firebaseapp.com',
  projectId: 'sisfumi2',
  storageBucket: 'sisfumi2.firebasestorage.app',
  messagingSenderId: '701735871466',
  appId: '1:701735871466:web:0a09927f8cc0f1b8874893',
  measurementId: 'G-86EH44R18L',
}

// Inicializar Firebase
const app = initializeApp(firebaseConfig)

// Exportar las instancias de los servicios que necesitarás
export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app, 'us-central1') // Asegúrate de especificar la región correcta
