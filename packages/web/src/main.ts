import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import './style.css'
import './runtime/vue-entry'
import './runtime/ep-entry'
import './runtime/runtime-entry'
import { initPluginSlots } from './plugin-host/slotRegistry'

const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')

initPluginSlots()
