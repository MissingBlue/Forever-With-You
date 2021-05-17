//	以下のオブジェクトは、下記記事に示されている処理に基づいて実装されている。
//		https://qiita.com/pasta04/items/33da06cf3c21e34fc4d1
//			この作例は間違いが多く、そのまま用いても動作しないどころかエラーが生じる恐れが強い。
//			特にコメントサーバーとの通信に用いる WebSocket のコンストラクターに三つの引数が指定されているが、
//			いかなる指定方法、実装環境においても第三引数は仕様上存在しない。
//			この第三引数は恐らく WebSocket での接続時の通信のヘッダーを指定することを想定しているものと思われるが、
//			その中のプロパティ Sec-WebSocket-Protocol は、WebSocket コンストラクターの第二引数に含めるべきもので、
//			また Sec-WebSocket-Extensions はサーバー側の設定で、そもそも指定する必要がないものと思われる。
//
//	備考
//		CustomEvent により発せられたイベントは、content_scripts で捕捉できない。
//		この仕様に対応するため、addEventListener に Mozilla の実装する非標準の第四引数 wantsUntrusted を true にしている。
//		https://developer.mozilla.org/ja/docs/Web/API/EventTarget/addEventListener#syntax
//	TODO
//		WrappedWebSocket の各イベントハンドラーは現状では継承先で同名ハンドラーを実装するようにしているが、
//		継承元のハンドラー内から継承先のハンドラーを実行するようにする。これによってイベントの通知など、共通かできる処理を継承元で一元化する。

class ExtensionNode extends EventTarget {
	
	constructor(option = {}) {
		
		super(),
		
		this.option = (option && typeof option === 'object') ? option : {},
		
		this.setLogger(option.loggerPrefix);
		
	}
	
	addUntrustedListener(type, handler, option = false, wantsUntrusted = true) {
		
		this.addEventListener(type, handler, option, wantsUntrusted);
		
	}
	removeUntrustedListener(type, handler, option = false, wantsUntrusted = true) {
		
		this.removeEventListener(type, handler, option, wantsUntrusted);
		
	}
	
	setLogger(prefix) {
		
		this.log = console.log.bind(console, `[${prefix ? `${prefix}@` : ''}${this.constructor.LOGGER_SUFFIX}]`);
		
	}
	
}
ExtensionNode.LOGGER_SUFFIX = 'EN',
ExtensionNode.AEL_UNTRUSTED_ARGS = [ false, true ],
ExtensionNode.AEL_ARGS_ONCE = [ { once: true }, true ];

class NNNWSBroadcaster extends ExtensionNode {
	
	constructor(data, option = {}) {
		
		if (!(data && typeof data === 'object')) throw new TypeError('An argument 1 data must be object.');
		
		super(option),
		
		this.boundOnRecievedFromLiveWebSocket = this.onRecievedFromLiveWebSocket.bind(this),
		this.boundOnClosedLiveWebSocket = this.onClosedLiveWebSocket.bind(this),
		this.boundOnClosedCommentWebSocket = this.onClosedCommentWebSocket.bind(this),
		this.boundOnReceivedComment = this.onReceivedComment.bind(this),
		
		this.data = data,
		
		(this.live = new LiveWebSocket(this.data.site.relive.webSocketUrl, undefined, option)).
			addUntrustedListener('recieved', this.boundOnRecievedFromLiveWebSocket),
		this.live.addUntrustedListener('closed', this.boundOnClosedLiveWebSocket),
		
		this.log('Created a LiveWebSocket instance', this.live);
		
	}
	connectWithCommentServer(thread = this.thread) {
		
		if (!thread || typeof thread !== 'object') return;
		
		const lastComment = this.comment;
		
		try {
			
			(this.comment = new CommentWebSocket({ thread, user: this.data.user.id, ...this.option })).
				addUntrustedListener('recieved', this.boundOnReceivedComment),
			this.comment.addUntrustedListener('closed', this.boundOnClosedCommentWebSocket),
			
			this.dispatchEvent(new CustomEvent('created-comment-connection')),
			
			lastComment && lastComment instanceof CommentWebSocket && (
				lastComment.removeUntrustedListener('closed', this.boundOnClosedCommentWebSocket),
				lastComment.end()
			),
			
			this.log('Created a CommentWebSocket instance.', this.comment);
		
		} catch(e) {
			
			console.log(e);
			
		}
		
	}
	onRecievedFromLiveWebSocket(event) {
		
		switch (event.detail.type) {
			
			case 'room':
			
			this.log('An instance of LiveWebSocket succeeded to connect.'),
			
			this.thread = { data: event.detail.data },
			this.thread.url = this.thread.data.messageServer.uri,
			this.thread.threadId = this.thread.data.threadId,
			this.thread.threadKey = this.thread.data.yourPostKey,
			
			this.connectWithCommentServer(this.thread),
			
			this.dispatchEvent(new CustomEvent('updated-thread-data', { detail: this.thread })),
			
			this.log('Updated a thread data.', this.thread);
			
			break;
			
			case 'ping': this.live.pong(); break;
			
		}
		
	}
	onReceivedComment(event) {
		
		this.dispatchEvent(new CustomEvent('recieved'), event.detail),
		
		this.log('Received a comment from an instance of CommentWebSocket.', event.detail);
		
	}
	onClosedLiveWebSocket() {
		
		this.comment && this.comment.stopHeartbeat(),
		
		this.log('The connection with the live server was closed.'),
		
		this.dispatchEvent(new CustomEvent('live-closed'));
		
	}
	onClosedCommentWebSocket() {
		
		this.comment.stopHeartbeat(),
		
		this.log('The connection with the comment server was closed.'),
		
		this.dispatchEvent(new CustomEvent('comment-closed'));
		
	}
	
}
NNNWSBroadcaster.LOGGER_SUFFIX = 'NNNWSBC';

// このクラスは本来 WebSocket を継承するべきだが、WebSocket を継承することはできないため、
// 現状 WebSocket のインスタンスをプロパティのひとつとして持つことで代替している。
// https://stackoverflow.com/questions/50091699/extending-websocket-class
class WrappedWebSocket extends ExtensionNode {
	
	constructor(url, protocols, option = {}) {
		
		super(option),
		
		this.ws = new WebSocket(url, protocols),
		
		this.bound = {},
		this.boundOn = this.on.bind(this),
		
		this.begin(option);
		
	}
	begin(option = {}) {
		
		let k;
		
		typeof this.init === 'function' && this.init();
		
		for (k in WrappedWebSocket.handler)
			typeof WrappedWebSocket.handler[k].callback === 'function' && !this.bound[k] &&
				 (this.bound[k] = WrappedWebSocket.handler[k].callback.bind(this)),
			
			this.ws.addEventListener(k, this.bound[k] || this.boundOn, ...ExtensionNode.AEL_UNTRUSTED_ARGS);
		
		this.dispatchEvent(new CustomEvent('begun'));
		
	}
	end(code, reason) {
		
		let k;
		
		this.ws.close(code, reason),
		
		typeof this.kill === 'function' && this.kill();
		
		for (k in WrappedWebSocket.handler)
			this.ws.removeEventListener(k, this.bound[k] || this.boundOn, ...ExtensionNode.AEL_UNTRUSTED_ARGS);
		
		this.dispatchEvent(new CustomEvent('ended', { detail: { code, reason } }));
		
	}
	post(...messages) {
		
		let i,l;
		
		i = -1, l = messages.length;
		while (++i < l) this.ws.send(messages[i]);
		
		this.log(`${l > 1 ? `${l} messages have` : 'A message has'} been sent.`, ...messages),
		
		this.dispatchEvent(new CustomEvent('posted', { detail: messages }));
		
	}
	on(event) {
		
		const handler = WrappedWebSocket.handler[event.type];
		
		let detail;
		
		if (!handler) return;
		
		typeof this[handler.callbackName] === 'function' && (detail = this[handler.callbackName](event)),
		
		this.dispatchEvent(new CustomEvent(handler.dispatchType, detail === undefined ? detail : { detail })),
		this.log(handler.log, event);
		
	}
	
}
WrappedWebSocket.LOGGER_SUFFIX = 'WrWS',
// 仮に特定のイベントで特定のコールバック関数を実行させたい時は、
//	対応するイベントの値のオブジェクトのプロパティ callback に関数を定義する。
//	しない場合、イベントのコールバック関数は常に this.on になる。
WrappedWebSocket.handler = {
	open: { callbackName: 'open', dispatchType: 'opened', log: 'A WebSocket has been opened.' },
	message: { callbackName: 'recieve', dispatchType: 'recieved', log: 'A WebSocket has recieved.' },
	close: { callbackName: 'close', dispatchType: 'closed', log: 'A WebSocket has been closed.' },
	error: { callbackName: 'error', dispatchType: 'errored', log: 'A connection has caught an error.' }
};

class LiveWebSocket extends WrappedWebSocket {
	
	constructor(url, protocols, option = {}) {
		
		super(url, protocols, option);
		
	}
	open(event) {
		
		this.post(...LiveWebSocket.handshakes),
		this.log('Begun to comminucate with the live server.');
		
	}
	recieve(event) {
		
		const message = JSON.parse(event.data);
		
		this.log('Recieved a message from the live server.', message);
		
		return message;
		
	}
	pong() {
		
		this.post(...LiveWebSocket.pong),
		
		this.dispatchEvent(new CustomEvent('pong')),
		
		this.log('Sent a pong to the live server.');
		
	}
	
}
LiveWebSocket.LOGGER_SUFFIX = 'LvWS',
LiveWebSocket.handshakes = [
	'{"type":"startWatching","data":{"stream":{"quality":"abr","protocol":"hls","latency":"low","chasePlay":false},"room":{"protocol":"webSocket","commentable":true},"reconnect":false}}',
	'{"type":"getAkashic","data":{"chasePlay":false}}'
],
LiveWebSocket.pong = [ '{"type":"pong"}', '{"type":"keepSeat"}' ];

class CommentWebSocket extends WrappedWebSocket {
	
	constructor(option = {}) {
		
		if (!(option && typeof option === 'object' && option.thread && typeof option.thread === 'object'))
			throw new TypeError('An argument 1 option must be had a property thread as object.');
		
		super(option.thread.url, CommentWebSocket.protocols, option),
		
		this.heartbeatInterval = CommentWebSocket.HEARTBEAT_INTERVAL,
		
		this.boundHeartbeat = this.heartbeat.bind(this);
		
	}
	open(event) {
		
		this.handshake = `[{"ping":{"content":"rs:0"}},{"ping":{"content":"ps:0"}},{"thread":{"thread":"${this.option.thread.threadId}","version":"20061206","user_id":"${this.option.user || 'guest'}","res_from":-150,"with_global":1,"scores":1,"nicoru":0${this.option.user ? `,"threadkey":"${this.option.thread.threadKey}"` : ''}}},{"ping":{"content":"pf:0"}},{"ping":{"content":"rf:0"}}]`,
		
		this.post(this.handshake),
		
		this.heartbeat(),
		
		this.log('Begun to comminucate with the comment server.');
		
	}
	heartbeat(isOnce) {
		
		this.post(''),
		
		isOnce || (this.heartbeatTimer = setTimeout(this.boundHeartbeat, this.heartbeatInterval)),
		
		this.dispatchEvent(new CustomEvent('heartbeat')),
		
		this.log('Tried to keep the connection alive with the comment server.');
		
	}
	stopHeartbeat() {
		
		clearTimeout(this.heartbeatTimer);
		
	}
	setHeartbeatInterval(value = CommentWebSocket.HEARTBEAT_INTERVAL) {
		
		isNaN(value = parseInt(value)) || value > 0 && (this.heartbeatInterval = value);
		
	}
	recieve(event) {
		
		const message = JSON.parse(event.data);
		
		this.log('Recieved a message from the comment server.', message);
		
		return message;
		
	}
	kill() {
		
		this.stopHeartbeat();
		
	}
	
}
CommentWebSocket.HEARTBEAT_INTERVAL = 60000,
CommentWebSocket.LOGGER_SUFFIX = 'CoWS',
CommentWebSocket.protocols = [ 'niconama', 'msg.nicovideo.jp#json' ];
