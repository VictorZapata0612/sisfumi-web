import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './assets/main.css'

import App from './App.vue'
import router from './router'
import { vScrollAnimation } from './directives/scrollAnimation'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Registramos la directiva de animación de scroll de forma global
app.directive('scroll-animation', vScrollAnimation)

app.mount('#app')
