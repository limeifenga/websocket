const devBaseUrl = 'ws://192.168.1.113:8080/JeemaaPortalSocket'
const prodBaseUrl = 'ws://192.168.1.113:8080/JeemaaPortalSocket'

let wsUrl
// websocket
// 数据分割储存对象 数据分割定时器 数据分割是否完成标识符
let wsUids = {}
let spTime = null
let spFlag = false
let websocket = null
let lockReconnect = false
let getUuids_ = {
  exporterdocByDocId: '', // 编辑导出
  preprocessTest: '', // 去重Test
  dopreprocess: '', // 去重预处理
  exporterdoc: '' // 项目导出
}

if (process.env.NODE_ENV === 'development') {
  wsUrl = devBaseUrl + '/websocket'

}else if (process.env.NODE_ENV === 'production') {
  wsUrl = prodBaseUrl + '/websocket'
}

function createWebsocket (params, success) {
  let token = localStorage.getItem('_token')
  if (token) {
    try {
      if ('WebSocket' in window) {
        websocket = new WebSocket(wsUrl, [token])
      } else if ('MozWebSocket' in window) {
        // eslint-disable-next-line no-undef
        websocket = new MozWebSocket(wsUrl, [token])
      } else {
        alert('您的浏览器不支持websocket协议,建议使用新版谷歌、火狐等浏览器，请勿使用IE10以下浏览器，360浏览器请使用极速模式，不要使用兼容模式！')
      }
      initWsHandle(params, success)
    } catch (e) {
      reconnect(params, success)
    }
  }
}

// doc_id  时间戳存储
let docId = new Map()

function initWsHandle (params, success) {
  if (params && websocket.readyState === 1) {
    websocket.send(params)
  }

  websocket.onopen = () => {
    heartCheck.reset().start() // 心跳检测重置
    console.log('ws连接成功!' + new Date().toUTCString())
  }

  websocket.onerror = () => {
    reconnect(params, success)
    console.log('ws连接错误!')
  }

  websocket.onmessage = (res) => {
    heartCheck.reset().start() // 拿到任何消息都说明当前连接是正常的
    if (!res) return
    if (res.data !== 'pong' && success) {
      let data_ = JSON.parse(res.data)
      if (data_.isSplit) {
        clearTimeout(spTime)
        // 存入数据待处理
        let uid = data_.uid
        // 可能存在多个分割 UID ，判断 uid 是否相同，相同 uid 数据推入当前 uid 数组
        if (!wsUids[uid]) {
          wsUids[uid] = []
          wsUids[uid].push(data_)
        } else {
          wsUids[uid].push(data_)
        }
        console.log(uid, wsUids[uid])
        // 如果没有那么就进行排序拼接
        if (data_.index) {
          // data_.index == 0 之后再返回的数据，需再次处理。（分割结束标识符为 true 表示该分段已经结束）
          if (spFlag) {
            sortAndSpliceData(success)
          }
        } else {
          // index 为 0 时该分段结束，需要延迟数秒判断是否还有因为某些原因未及时发送的数据
          // 分割结束标识符
          spFlag = true
          // 为 0 延迟 1s ，取出数据排序拼接
          spTime = setTimeout(sortAndSpliceData(success), 1000)
        }
      } else {
        let _content = JSON.parse(data_.content)
        if (_content.type === 0) {
          window.socketId = _content.result.socketId
        }

        if (data_.content) {
          // 需要处理数据包先发生后返回情况、取时间最近，ID对应
          let content = JSON.parse(data_.content)
          // 由于后台命名不统一，有的是返回doc_id，有的是返回documentId
          if (content.hasOwnProperty('timeStamp') && content.result !== undefined && ('doc_id' in content.result || 'documentId' in content.result)) {
            if (docId.has(content.result.doc_id) || docId.has(content.result.documentId)) {
              if (docId.get(content.result.doc_id || content.result.documentId).timeStamp < content.timeStamp) {
                docId.set(content.result.doc_id || content.result.documentId, content)
              }
            } else {
              docId.set(content.result.doc_id || content.result.documentId, content)
            }
            content = docId.get(content.result.doc_id || content.result.documentId)
          }
          data_.content = JSON.stringify(content)
          success(data_, websocket)
        }
      }
    }
  }

  websocket.onclose = () => {
    let hasToken = localStorage.getItem('ymw_token') || localStorage.getItem('LOGIN_INFO')
    if (hasToken) {
      reconnect(params, success)
    }
    console.log('ws连接关闭!' + new Date().toUTCString())
  }
}
// 排序 & 拼接数据 触发事件
function sortAndSpliceData (success) {
  // let flag = false
  let lastItem
  let item
  for (let items in wsUids) {
    item = wsUids[items]
    // 消息结束暂时保存最后推入
    // 当前 uid 下的分段信息从小到大排序，排除 0 的情况
    for (let content = 0; content < item.length; content++) {
      let index = item[content].index
      if (index) {
        for (let contentJ = content; contentJ < item.length; contentJ++) {
          // 该数组可能存在只有两个分段的情况
          if (item[contentJ].index) { // index ==true
            let indexJ = item[contentJ].index
            if (index > indexJ) {
              let midIndex = item[content]
              item[content] = item[contentJ]
              item[contentJ] = midIndex
            }
          }
        }
      } else {
        // index 为 0 的单独保存最后拼接
        lastItem = item[content]
        item.splice(content, 1)
        // flag = true
      }
    }
  }
  // 预处理消息因为 spTime 延迟，可能会出现 lastItem 为 undefined
  if (lastItem) {
    let resobj = {}
    // 推送最后数组，完成当前 uid 排序
    item.push(lastItem)
    let str = ''
    // 拼接数据
    for (let datas = 0; datas < item.length; datas++) {
      str += item[datas].content
    }
    resobj.content = str
    resobj.index = lastItem.index
    resobj.isSplit = lastItem.isSplit
    resobj.uid = lastItem.uid
    success(resobj, websocket)
    // 重置 data
    wsUids = {}
  }
}

function reconnect (params, success) {
  if (lockReconnect) return
  lockReconnect = true
  setTimeout(function () { // 没连接上会一直重连，设置延迟避免请求过多
    createWebsocket(params, success)
    websocket.onopen = function () {
      let uuids = []
      if (getUuids_.dopreprocess) {
        uuids.push(getUuids_.dopreprocess)
      }
      if (getUuids_.preprocessTest) {
        uuids.push(getUuids_.preprocessTest)
      }
      if (getUuids_.exporterdocByDocId) {
        uuids.push(getUuids_.exporterdocByDocId)
      }
      if (getUuids_.exporterdoc) {
        uuids.push(getUuids_.exporterdoc)
      }
      websocket.send(uuids.join(','))
      console.log('重新连接成功')
      heartCheck.start()
    }
    lockReconnect = false
  }, 20000)
}

const heartCheck = {
  timeout: 30000, // 5 分钟发一次心跳
  timeoutObj: null,
  reset: function () {
    clearTimeout(this.timeoutObj)
    return this
  },
  start: function () {
    this.timeoutObj = setInterval(function () {
      // 这里发送一个心跳，后端收到后，返回一个心跳消息，
      // onmessage拿到返回的心跳就说明连接正常
      if (websocket.readyState === 1) {
        websocket.send('ping')
      }
      if (websocket.readyState === 2 || websocket.readyState === 3) {
        websocket.close()
      }
    }, this.timeout)
  }
}

export default{
  install (Vue, options) {
      // websocket
      if (index === 0) {
        Vue.prototype['requestSocket'] = function (params, success) {
          return createWebsocket.call(this, params, success)
        }
      }
  }
}


/** 在store 中应用
 *
 *  外部dispacth 触发 action 中异步创建socket方法  ；再commit mutations 修改state
 *  外部通过拿取 state中的 socket 返回信息来回显 this.$store.state.global.setWS    global为管理器的名称
 *  actions：{
       this.$requestSocket('', res => {
          state.commit('SET_WS_DATA', JSON.parse(res.content))
          state.commit('setSocketId', JSON.parse(res.content).result.socketId) *
       })
    }，
    mutations： {
       setSocketId (state, data) {
          state.socketId = data
       },
       SET_WS_DATA: (state, data) => {
          state.setWS = data
       },
    }，
   state： {
      socketId： null,
      setWS: {}
   }
 *
 *
 * */