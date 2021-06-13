/*
	以下のオブジェクトは、下記記事に示されている処理に基づいて実装されている。
		https://qiita.com/pasta04/items/33da06cf3c21e34fc4d1
		https://qiita.com/nouyakko/items/7938835a8ff69d73a465
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
		
		this.ac = new AbortController(),
		
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
	
	addEvent(listeners = [ this ], type, handler, option = false, wantsUntrusted = true) {
		
		option = option && typeof option === 'object' ? { ...option } : { capture: !!option },
		(!option.signal || !(option.signal instanceof AbortSignal)) && (option.signal = this.ac.signal),
		
		this.touchEvent('add', listeners, type, handler, option, wantsUntrusted);
		
	}
	removeEvent(listeners = [ this ], type, handler, option = false) {
		
		this.touchEvent('remove', listeners, type, handler, option);
		
	}
	touchEvent(method, listeners, ...args) {
		
		let v;
		
		if (typeof EventTarget.prototype[method = `${typeof method === 'string' ? method : 'add'}EventListener`] !== 'function') return;
		
		listeners = new Set(Array.isArray(listeners) ? listeners : (listeners = [ listeners || this ]));
		for (v of listeners) v instanceof EventTarget && v[method](...args);
		
	}
	dispatch(name, detail = {}, listeners) {
		
		const composed = true;
		let v;
		
		listeners = new Set(Array.isArray(listeners) ? listeners : (listeners = [ listeners || this ])),
		detail && detail.constructor === Object && (detail.__target = this);
		
		for (v of listeners) v instanceof EventTarget && v.distpachEvent(new CustomEvent(name, { composed, detail }));
		
	}
	emit(type, detail, option) {
		
		type && typeof type === 'string' && (
				(!option || typeof option !== 'object') && (option = { composed: true }),
				detail && (option.detail = detail),
				this.dispatchEvent(new CustomEvent(type, option))
			);
		
	}
	abortEvents() {
		
		this.ac.abort();
		
	}
	
	destroy() {
		
		this.ac.abort(), this.emit('destroyed');
		
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
		
		this.log = console.log.bind(console, `[${prefix ? `${prefix}@` : ''}${this.__.LOGGER_SUFFIX}]`);
		
	}
	
	static LOGGER_SUFFIX = 'CSN';
	
}

class NNNWSBroadcaster extends ContentScriptNode {
	
	constructor(data, option = {}) {
		
		if (!(data && typeof data === 'object')) throw new TypeError('An argument 1 data must be object.');
		
		super(option),
		
		this.data = data,
		
		(this.live = new LiveWebSocket(this.data.site.relive.webSocketUrl, undefined, option)).
			addEvent(undefined, 'received', this.onReceivedFromLiveWebSocket),
		this.live.addEvent(undefined, 'closed', this.onClosedLiveWebSocket),
		
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
		
		this[ws] instanceof WrappedWebSocket ? (
				this[ws].post(...data),
				this.log(`Sent data to a "${ws}" socket`, ...data, this)
			) : 
			this.log(`There are no WebSocket "${ws}" in specified object.`, data, this);
		
	}
	post(text, asAnon = false) {
		
		const	now = Date.now(),
				vpos = (now - (this.live.begin || this.data.program.openTime) * 1000) / 10 | 0,
				post = { type: 'postComment', data: { text, vpos } };
		
		asAnon && (post.data.isAnonymous = !!asAnon),
		
		this.log(`Post a message.`, `content: ${text}`, `vpos: ${vpos}`, `now: ${now}`, `schedule: ${this.live.begin}`, `embeded: ${this.data.program.openTime}`),
		
		this.send('live', JSON.stringify(post));
		
	}
	
	static LOGGER_SUFFIX = 'NNNWSBC';
	static tagName = 'nnnw-wsbc';
	static bound = {
		
		onReceivedFromLiveWebSocket(event) {
			
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
				
				case 'schedule':
				// This value is needed to calculate and get vpos value.
				this.begin =	event.detail.data && typeof event.detail.data === 'object' &&
									event.detail.data.data && typeof event.detail.data.data === 'object' &&
									typeof event.detail.data.data.begin === 'string' && Date.parse(event.detail.data.data.begin);
				break;
				
			}
			
			this.emit('received-from-live', event.detail),
			this.emit('received-from-live-stringified', JSON.stringify(event.detail));
			
		},
		onOpendCommentWebSocket(event) {
			
			this.emit('opened-comment');
			
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
		
		this.ws.close(code, reason),
		typeof this.kill === 'function' && this.kill(),
		this.destroy(),
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
		this.addEvent(this.ws, 'message', this.receivedFirstPing),
		this.addEvent(this.ws, 'message', this.receivedThreadData),
		
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
					this.isAvailable = true,
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