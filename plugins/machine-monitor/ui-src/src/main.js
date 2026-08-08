import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import App from './App.vue'

export default {
  mount(el, ctx) {
    const app = createApp(App, { appId: ctx.appId, mode: ctx.mode })
    app.use(ElementPlus)
    app.mount(el)
    return () => app.unmount()
  },
}
