/*
	以下のオブジェクトは、下記記事に示されている処理に基づいて実装されている。
		https://qiita.com/pasta04/items/33da06cf3c21e34fc4d1
			この作例は間違いが多く、そのまま用いても動作しないどころかエラーが生じる恐れが強い。
			特にコメントサーバーとの通信に用いる WebSocket のコンストラクターに三つの引数が指定されているが、
			いかなる指定方法、実装環境においても第三引数は仕様上存在しない。
			この第三引数は恐らく WebSocket での接続時の通信のヘッダーを指定することを想定しているものと思われるが、
			その中のプロパティ Sec-WebSocket-Protocol は、WebSocket コンストラクターの第二引数に含めるべきもので、
			また Sec-WebSocket-Extensions はサーバー側の設定で、そもそも指定する必要がないものと思われる。

	備考
		CustomEvent により発せられたイベントは、content_scripts で捕捉できない。
		この仕様に対応するため、addEventListener に Mozilla の実装する非標準の第四引数 wantsUntrusted を true にしている。
		https://developer.mozilla.org/ja/docs/Web/API/EventTarget/addEventListener#syntax
*/

// content_script 上でカスタム要素は定義できなくもないが、作成したカスタム要素はコンテンツ上のオブジェクトになるため、
// 拡張機能側からクラスで定義したプロパティやメソッドにアクセスできず、実質的に使えないのと同じであるため、
// EventTarget を継承する専用のオブジェクトを基底オブジェクトにしている。
class ContentScriptNode extends EventTarget {
	
	constructor(option) {
		
		super(),
		
		this.__ = this.constructor,
		
		this.__listeners = [],
		
		this.bind(this.__.bound),
		
		this.setOption(option),
		
		this.setLogger();
		
	}
	
	setOption(option) {
		
		(!this.option || typeof this.option !== 'object' || Array.isArray(this.option)) && (this.option = {});
		
		return this.option && typeof this.option === 'object' && !Array.isArray(this.option) ?
			(this.option = { ...this.option, ...option }) : this.option;
		
	}
	bind(source, name, ...args) {
		
		let i,l,k;
		
		switch (typeof source) {
			
			case 'function':
			this[(!(k = source.name) || k === 'anonymous') ?  name || 'anonymous' : k] = source.bind(this, ...args);
			return;
			
			case 'object':
			if (Array.isArray(source)) {
				i = -1, l = source.length;
				while (++i < l) this.bind(source[i], `${(name || 'anonymous') + i}`, ...args);
			} else if (source) for (k in source) this.bind(source[k], k, ...args);
			return;
			
		}
		
	}
	
	addEvent(node = this, type, handler, option = false, wantsUntrusted = true) {
		
		const args = [ node, type, handler, option = ContentScriptNode.normalizeListenerOption(option) ],
				listener = this.isListened(...args);
		
		listener && this.removeEventWithListener(listener),
		node.addEventListener(type, handler, option, wantsUntrusted),
		this.__listeners[this.__listeners.length] = args;
		
	}
	removeEvent(node = this, type, handler, option = false) {
		
		const $ = this.isListened(...arguments);
		
		$ && ($[0].removeEventListener($[1], $[2], $[3]), this.__listeners.splice(this.__listeners.indexOf($),1));
		
	}
	removeEventWithListener(listener) {
		
		const i = this.__listeners.indexOf(listener);
		
		i === -1 ||
			(listener[0].removeEventListener(listener[1], listener[2], listener[3]), this.__listeners.splice(i,1));
		
	}
	isListened(node = this, type, handler, option = false) {
		
		let i, $;
		
		i = -1, option = ContentScriptNode.normalizeListenerOption(option);
		while (
			($ = this.__listeners[++i]) &&
			!($[0] === node && $[1] === type && $[2] === handler && ContentScriptNode.isSameListenerOption($[3], option))
		);
		
		return $ || false;
		
	}
	clearEvents() {
		
		let i, $;
		
		i = -1;
		while ($ = this.__listeners[++i]) $[0].removeEventListener($[1],$[2],$[3]);
		this.__listeners.length = 0;
		
	}
	dispatch(name, detail = {}, broadcasts = false) {
		
		detail && typeof detail === 'object' && detail.constructor === Object && (detail.target = this);
		
		if (broadcasts && this.id) {
			
			const listeners = QQ(`[data-for~="${this.id}"]`);
			let i,l,l0;
			
			i = -1, l = listeners.length;
			while (++i < l) listeners[i].dispatchEvent(new CustomEvent(name, { detail: { on: this, more: detail } }));
			
		}
		
		this.emit(name, detail);
		
	}
	emit(type, detail, option) {
		
		type && typeof type === 'string' && (
				(!option || typeof option !== 'object') && (option = { composed: true }),
				detail && (option.detail = detail),
				this.dispatchEvent(new CustomEvent(type, option))
			);
		
	}
	
	destroy() {
		
		this.clearEvents(),
		this.emit(`${this.__.tagName}-destroyed`);
		
	}
	
	get(...keys) {
		
		let i,l,k,that;
		
		i = -1, l = keys.length, that = this;
		while (++i < l) {
			switch (typeof (k = keys[i])) {
				 case 'string':
				 if (typeof that !== 'object') return;
				 that = that[k];
				 break;
				 case 'number':
				 if (!Array.isArray(that)) return;
				 that = that[k];
				 break;
				 case 'object':
				 if (k !== null) return;
				 that = window;
			}
		}
		
		return that;
		
	}
	
	setLogger(prefix = this.option.loggerPrefix) {
		
		this.log = console.log.bind(console, `<${prefix ? `${prefix}@` : ''}${this.__.LOGGER_SUFFIX}>`);
		
	}
	
	static LOGGER_SUFFIX = 'EN';
	static AEL_UNTRUSTED_ARGS = [ false, true ];
	static AEL_ARGS_ONCE = [ { once: true }, true ];
	static normalizeListenerOption(option = false) {
		
		(option && typeof option === 'object') || (option = { capture: !!option }),
		typeof option.capture === 'boolean' || (option.capture = false),
		typeof option.once === 'boolean' || (option.once = false);
		
		return option;
		
	};
	static isSameListenerOption(a, b) {
		
		const ab = { ...(a = this.normalizeListenerOption(a)), ...(b = this.normalizeListenerOption(b)) };
		let k;
		
		for (k in ab) if (!(k in a) || !(k in b) || a[k] !== b[k]) return false;
		
		return true;
		
	};
	
}

class NNNWSBroadcaster extends ContentScriptNode {
	
	constructor(data, option = {}) {
		
		if (!(data && typeof data === 'object')) throw new TypeError('An argument 1 data must be object.');
		
		super(option),
		
		this.data = data,
		
		(this.live = new LiveWebSocket(this.data.site.relive.webSocketUrl, undefined, option)).
			addEvent(this, 'received', this.onreceivedFromLiveWebSocket),
		this.live.addEvent(this, 'closed', this.onClosedLiveWebSocket),
		
		this.log('Created a LiveWebSocket instance', this.live);
		
	}
	connectWithCommentServer(thread = this.thread) {
		
		if (!thread || typeof thread !== 'object') return;
		
		const lastComment = this.comment;
		
		try {
			
			(this.comment = new CommentWebSocket({ thread, user: this.data.user.id, ...this.option })).
				addEvent(undefined, 'opened', this.onOpendCommentWebSocket),
			this.comment.addEvent(undefined, 'received', this.onReceivedComment),
			this.comment.addEvent(undefined, 'closed', this.onClosedCommentWebSocket),
			this.comment.addEvent(undefined, 'available', this.onAvailableCommentWebSocket),
			this.comment.addEvent(undefined, 'receivedd-thread-data', this.onreceivedThreadDataFromComment),
			
			this.emit('created-comment-connection'),
			
			lastComment && lastComment instanceof CommentWebSocket && (
				lastComment.removeEvent(undefined, 'closed', this.onClosedCommentWebSocket),
				lastComment.end()
			),
			
			this.log('Created a CommentWebSocket instance.', this.comment);
		
		} catch(error) {
			
			console.log(error);
			
		}
		
	}
	send(ws, ...data) {
		
		this[ws] instanceof WrappedWebSocket && this[ws].post(...data),
		
		this.log(`Sent data to a ${ws} socket`, ...data);
		
	}
	
	static LOGGER_SUFFIX = 'NNNWSBC';
	static tagName = 'nnnw-wsbc';
	static bound = {
		
		onreceivedFromLiveWebSocket(event) {
			
			switch (event.detail.type) {
				
				case 'room':
				
				this.log('An instance of LiveWebSocket succeeded to connect.'),
				
				this.thread = { data: event.detail.data },
				this.thread.url = this.thread.data.messageServer.uri,
				this.thread.threadId = this.thread.data.threadId,
				this.thread.threadKey = this.thread.data.yourPostKey,
				
				this.connectWithCommentServer(this.thread),
				
				this.emit('updated-thread-data', this.thread),
				this.emit('updated-thread-data-stringified', JSON.stringify(this.thread)),
				
				this.log('Updated a thread data.', this.thread);
				
				break;
				
				case 'ping': this.live.pong(); break;
				
			}
			
			this.emit('received-from-live', event.detail),
			this.emit('received-from-live-stringified', JSON.stringify(event.detail));
			
		},
		onOpendCommentWebSocket(event) {
			
			this.emit(new CustomEvent('opened-comment'));
			
		},
		onReceivedComment(event) {
			
			this.emit('received-from-comment', event.detail),
			this.emit('received-from-comment-stringified', JSON.stringify(event.detail)),
			
			this.log('Received a comment from an instance of CommentWebSocket.', event.detail);
			
		},
		onClosedLiveWebSocket() {
			
			this.comment && this.comment.stopHeartbeat(),
			
			this.log('The connection with the live server was closed.'),
			
			this.emit('live-closed');
			
		},
		onClosedCommentWebSocket() {
			
			this.comment.stopHeartbeat(),
			
			this.log('The connection with the comment server was closed.'),
			
			this.emit('comment-closed');
			
		},
		onAvailableCommentWebSocket() {
			
			this.emit('available-comment-ws');
			
		},
		onreceivedThreadDataFromComment(event) {
			
			this.emit('received-thread-data-from-comment', JSON.stringify(event.detail));
			
		}
		
	};
	
}

// このクラスは本来 WebSocket を継承するべきだが、WebSocket を継承することはできないため、
// 現状 WebSocket のインスタンスをプロパティのひとつとして持つことで代替している。
// https://stackoverflow.com/questions/50091699/extending-websocket-class
class WrappedWebSocket extends ContentScriptNode {
	
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
			
			this.addEvent(this.ws, k, this.bound[k] || this.boundOn);
		
		this.emit('begun');
		
	}
	end(code, reason) {
		
		let k;
		
		this.ws.close(code, reason),
		
		typeof this.kill === 'function' && this.kill();
		
		for (k in WrappedWebSocket.handler) this.removeEvent(this.ws, k, this.bound[k] || this.boundOn);
		
		this.emit('ended', { code, reason });
		
	}
	post(...messages) {
		
		let i,l;
		
		i = -1, l = messages.length;
		while (++i < l) this.ws.send(messages[i]);
		
		this.log(`${l > 1 ? `${l} messages have` : 'A message has'} been sent.`, ...messages),
		
		this.emit('posted', messages);
		
	}
	on(event) {
		
		const handler = WrappedWebSocket.handler[event.type];
		let detail;
		
		handler && (
				typeof this[handler.callbackName] === 'function' && (detail = this[handler.callbackName](event)),
				this.emit(handler.dispatchType, detail),
				this.log(handler.log, event)
			);
		
		
	}
	
	static LOGGER_SUFFIX = 'WrWS';
	// 仮に特定のイベントで特定のコールバック関数を実行させたい時は、
	//	対応するイベントの値のオブジェクトのプロパティ callback に関数を定義する。
	//	しない場合、イベントのコールバック関数は常に this.on になる。
	static tagName = 'wrapped-websocket';
	static handler = {
		open: { callbackName: 'open', dispatchType: 'opened', log: 'A WebSocket has been opened.' },
		message: { callbackName: 'receive', dispatchType: 'received', log: 'A WebSocket has received.' },
		close: { callbackName: 'close', dispatchType: 'closed', log: 'A WebSocket has been closed.' },
		error: { callbackName: 'error', dispatchType: 'errored', log: 'A connection has caught an error.' }
	};
	
}

class LiveWebSocket extends WrappedWebSocket {
	
	constructor(url, protocols, option = {}) {
		
		super(url, protocols, option);
		
	}
	open(event) {
		
		this.post(...LiveWebSocket.handshakes),
		this.log('Begun to comminucate with the live server.');
		
	}
	receive(event) {
		
		const message = JSON.parse(event.data);
		
		this.log('Received a message from the live server.', message);
		
		return message;
		
	}
	pong() {
		
		this.post(...LiveWebSocket.pong),
		
		this.emit('pong'),
		
		this.log('Sent a pong to the live server.');
		
	}
	
	static LOGGER_SUFFIX = 'LvWS';
	static tagName = 'live-websocket';
	static handshakes = [
		'{"type":"startWatching","data":{"stream":{"quality":"abr","protocol":"hls","latency":"low","chasePlay":false},"room":{"protocol":"webSocket","commentable":true},"reconnect":false}}',
		'{"type":"getAkashic","data":{"chasePlay":false}}'
	];
	static pong = [ '{"type":"pong"}', '{"type":"keepSeat"}' ];
	
}

class CommentWebSocket extends WrappedWebSocket {
	
	constructor(option = {}) {
		
		if (!(option && typeof option === 'object' && option.thread && typeof option.thread === 'object'))
			throw new TypeError('An argument 1 option must be had a property thread as object.');
		
		super(option.thread.url, CommentWebSocket.protocols, option),
		
		this.isAvailable = false,
		this.addEventListener(this.ws, 'message', this.receivedFirstPing),
		this.addEventListener(this.ws, 'message', this.receivedThreadData),
		
		this.heartbeatInterval = CommentWebSocket.HEARTBEAT_INTERVAL;
		
	}
	open(event) {
		
		this.handshake = `[{"ping":{"content":"rs:0"}},{"ping":{"content":"ps:0"}},{"thread":{"thread":"${this.option.thread.threadId}","version":"20061206","user_id":"${this.option.user || 'guest'}","res_from":-150,"with_global":1,"scores":1,"nicoru":0${this.option.user ? `,"threadkey":"${this.option.thread.threadKey}"` : ''}}},{"ping":{"content":"pf:0"}},{"ping":{"content":"rf:0"}}]`,
		
		this.post(this.handshake),
		
		this.heartbeat(),
		
		this.log('Begun to comminucate with the comment server.'),
		
		this.emit('available');
		
	}
	stopHeartbeat() {
		
		clearTimeout(this.heartbeatTimer);
		
	}
	setHeartbeatInterval(value = CommentWebSocket.HEARTBEAT_INTERVAL) {
		
		isNaN(value = parseInt(value)) || value > 0 && (this.heartbeatInterval = value);
		
	}
	receive(event) {
		
		const message = JSON.parse(event.data);
		
		this.log('Received a message from the comment server.', message);
		
		return message;
		
	}
	kill() {
		
		this.stopHeartbeat();
		
	}
	close() {
		
		this.isAvailable = false;
		
	}
	
	static LOGGER_SUFFIX = 'CoWS';
	static tagName = 'comment-websocket';
	static HEARTBEAT_INTERVAL = 60000;
	static protocols = [ 'niconama', 'msg.nicovideo.jp#json' ];
	static bound = {
		
		heartbeat(isOnce) {
			
			this.post(''),
			
			isOnce || (this.heartbeatTimer = setTimeout(this.heartbeat, this.heartbeatInterval)),
			
			this.emit('heartbeat'),
			
			this.log('Tried to keep the connection alive with the comment server.');
			
		},
		receivedFirstPing(event) {
			
			const data = JSON.parse(event.data);
			
			data.ping && typeof data.ping === 'object' && (
					this.available = true,
					this.removeEvent(this.ws, 'message', this.receivedFirstPing),
					this.emit('available'),
					this.log('received a first ping.')
				);
			
		},
		receivedThreadData(event) {
			
			const data = JSON.parse(event.data);
			
			this.log(data),
			
			data.thread && typeof data.thread === 'object' && (
					this.removeEvent(this.ws, 'message', this.receivedThreadData),
					this.emit('receivedd-thread-data', data.thread),
					this.log('Received a thread data.')
				);
			
		}
		
	};
	
}