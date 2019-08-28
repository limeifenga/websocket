// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import router from './router'
import store from './store'
// import $http from './global/$http'
import axios from './websocket.js'
// import './global/apiBaseUrlConfig'
import utils from './global/utils'

// 引入自写公共组件
import '@/components/common'
// 引入iconfont
import './assets/css/iconfont/iconfont.css'
// symbol引入，使用方式请查看assets/css/iconfont/demo_index.html
import './assets/css/iconfont/iconfont.js'
import './assets/css/iconfont/common.css'

// 引入elementUI
import ElementUI from 'element-ui'

// import './global/uploader/jquery.min'
// import './global/uploader/webuploader.min'
// import './global/uploader/webuploader.css'

Vue.use(ElementUI)
Vue.use(axios)

Vue.config.productionTip = false
// Vue.prototype.$http = $http
Vue.prototype.$utils = utils

/* eslint-disable no-new */
let vue = new Vue({
  el: '#app',
  router,
  store,
  components: { App },
  template: '<App/>'
})
export default vue
