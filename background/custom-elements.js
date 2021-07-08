class BackgroundNode extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME });
		
	}
	connectedCallback() {
		
		// デバッグ用のロガーの可否。<background-node> に属性 data-logs を設定すると、その値にかかわらずログを行う。
		// メソッド logSwitch の実行は、任意の箇所で行える。ただし、動作が変更するのは可否の設定後で、例えば設定変更前のログを消したり表示したりすることはできない。
		this.logSwitch('logs' in this.dataset);
		
		// この要素を接続する度に以下の処理を行うのは無意味かつ冗長だが、
		// この要素の接続は、この拡張機能上において実質的な起動処理であるため、実用上の問題はない。
		// 仮にこの要素を不特定多数作成するか、接続、切断処理を前提とする場合、以下の処理は変更ないし廃止する必要がある。
		
		const	title = decolog(`  ${WX_META.name} version ${WX_META.version}  `, '*');
		
		this.log(title.border),
		this.log(title.content),
		this.log(title.border),
		
		browser.browserAction.onClicked.hasListener(BackgroundNode.pressedPageAction) ||
			browser.browserAction.onClicked.addListener(BackgroundNode.pressedPageAction);
		
	}
	
	load() {
		
		this.log('Load a local storage data.');
		
		if (this.storage) {
			
			this.log('There is already a local storage data.', this.storage);
			return Promise.resolve(this.storage);
			
		} else {
			
			const promise = browser.storage.local.get();
			promise.then(storage => this.log('Finished to load a local storage data.', storage));
			return promise;
			
		}
		
	}
	save(storage) {
		
		const saved = browser.storage.local.set(this.storage = this.storage ? { ...this.storage, ...storage } : storage);
		
		this.log('Save a data to a local storage.', this.storage),
		
		saved.then(this.xSave);
		
		return saved;
		
	}
	
	update(storage) {
		
		this.log('Update a data.', storage, this),
		this.save(storage).then(this.xSaved).then(this.xUpdated);
		
	}
	
	changeConnectionExternal(data) {
		
		const client = this.querySelector(`#${PassiveClient.cid(data.id)}`);
		
		client ? client[data.isConnected ? 'connect' : 'disconnect'](data.value).then(this.xChangedConnection) :
					this.notify('extension-connection', { id: data.id, isConnected: false, unavailable: true });
		
	}
	
	broadcast(message) {
		
		const portals = this.getElementsByTagName('extension-portal');
		let i;
		
		i = -1;
		while (portals[++i]) portals[i].broadcast(message);
		
	}
	
	notify(type, data) {
		
		const	message = { type, data }, portals = this.getElementsByTagName('passive-portal');
		let i;
		
		i = -1;
		while (portals[++i])	portals[i].notify(message);
		
		this.log(`Sent a "${type}" data to ${i < 2 ? 'a portal' : 'portal'}.`, message, ...portals);
		
	}
	initialize() {
		
		const clients = this.querySelectorAll('extension-client');
		let i;
		
		i = -1;
		while (clients[++i]) clients[i].kill();
		
		browser.storage.local.clear().then(this.xInitialized);
		
	}
	
	toJson(extra) {
		
		const portals = this.querySelectorAll('extension-portal'), data = {};
		let i;
		
		i = -1;
		while (portals[++i]) data[portals[i].id || i] = portals[i].toJson(extra);
		
		return { ...this.storage, data };
		
	}
	
	static LOGGER_SUFFIX = 'Bg';
	static tagName = 'background-node';
	static bound = {
		
		xSave() {
			
			this.notify('saved', this.storage),
			this.log('Data was saved to the storage.', this.storage);
			
		},
		xSaved() {
			
			return new Promise((rs,rj) => {
					
					const portals = this.querySelectorAll('extension-portal');
					let i, data;
					
					if (portals.length) {
						
						i = -1;
						while (portals[++i]) (data = portals[i].getDataFromStorage(this.storage)) && portals[i].update(data);
						
					}
					
					rs();
					
				});
			
		},
		xUpdated() {
			
			this.notify('updated', this.toJson(true)),
			this.log('Updated a data.', this.storage, this);
			
		},
		
		xChangedConnection(client) {
			
			this.notify('extension-connection', client.toJson(true));
			
		},
		
		xInitialized() {
			
			this.storage = null,
			
			this.log('This extension was initialized.', this),
			this.notify('initialized');
			
		}
		
	};
	
	static pressedPageAction(event) {
		
		browser.runtime.openOptionsPage();
		
	};
	
}

// 拡張機能の API、runtime が持つ Port オブジェクトの接続を待ち受けるクライアントオブジェクトを管理する。
// 拡張機能内部から接続を受けると、通信を行う PassiveClient を作成する。
// このオブジェクトを継承するには継承先での createClient の実装が必要。
// createClient はクライアントを引数にして解決する Promise を戻り値にする必要がある。
class PassivePortal extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.handshakes = [],
		
		// 接続待ち受けのためのリスナーの登録。演算が多いが、単にプロパティと値の存在を厳密に確認しているだけ。
		this.__.ON_CONNECT && typeof this.__.ON_CONNECT === 'string' &&
			browser.runtime[this.__.ON_CONNECT] && typeof browser.runtime[this.__.ON_CONNECT] === 'object' &&
			typeof browser.runtime[this.__.ON_CONNECT].addListener === 'function' &&
				(
					browser.runtime[this.__.ON_CONNECT].addListener(this.connected),
					this.log('A portal is waiting for the connection.', this)
				);
		
	}
	connectedCallback() {
		
		this.log(`Connected a portal "${this.id}" with a document.`, this, document),
		
		typeof this.calledConnectedCallback === 'function' && this.calledConnectedCallback();
		
	}
	
	createClient(message, port) {
		
		return message && typeof message === 'string' ?
			new Promise((rs,rj) =>
				(
					this.querySelector(`#${PassiveClient.cid(port.name)}`) ||
						(message === 'option' ? new OptionClient() : new ContentClient())
				).attachPort(port).then(client => rs(client))
			) :
			Promise.reject();
		
	}
	
	notify(message) {
		
		const	clients = this.querySelectorAll(':scope > :is(option-client, content-client)');
		let i;
		
		i = -1;
		while (clients[++i])	clients[i].post(message);
		
	}
	
	toJson(extra) {
		
		return PassiveClient.toJson(this.querySelectorAll(':scope > passive-client'), extra);
		
	}
	
	static LOGGER_SUFFIX = 'PiPo';
	static ON_CONNECT = 'onConnect';
	static tagName = 'passive-portal';
	static toJson(clients, extra) {
		
		const data = [];
		let i;
		
		i = -1;
		while (clients[++i]) data[i] = clients[i].toJson(extra);
		
		return data;
		
	};
	static bound = {
		
		// これらは接続の待ち受けからクライアントを作成するためのメソッド。
		// 例えばオプションページ、あるいは外部拡張から browser.runtime.connect を通じてバックグラウンドに接続された時に、
		// これらのメソッドが実行され、それを通じて通信用のクライアントノードが半ば自動的に作成、継承元のオブジェクトに子として追加される。
		
		connected(port) {
			
			(this.handshakes[this.handshakes.length] = port).onMessage.addListener(this.established),
			port.onDisconnect.addListener(this.disconnected),
			
			port.postMessage(true),
			
			this.log(`Established a connection on port "${port.name}".`, port, this);
			
		},
		
		established(message, port) {
			
			port.onMessage.removeListener(this.established),
			
			this.createClient(message, port).then(this.xCreatedClient).catch(this.xErrored);
			
		},
		
		xCreatedClient(client) {
			
			let i;
			
			client.isOn = true,
			client.port.onDisconnect.removeListener(this.disconnected),
			
			i = -1;
			while (this.handshakes[++i]) client.port === this.handshakes[i] || this.handshakes[i].disconnect();
			this.handshakes.length = 0,
			
			client.parentElement === this || this.appendChild(client),
			
			client instanceof PassiveClient ?
				client.onEstablish('registered', this.closest('background-node').toJson(true)) :
				client.onEstablish('connection'),
			
			this.log(`Established a connection on a client "${client.id}" was created.`, client.port, client, this);
			
		},
		xErrored(error) {
			
			throw new Error(error);
			
		},
		
		// この diconnected は、このオブジェクトの connected と established の間に接続が切断された場合にのみ実行される。
		// 状況としては極めて稀。
		disconnected(port) {
			
			port.onMessage.removeListener(this.established),
			port.onDisconnect.removeListener(this.disconnected),
			
			typeof this.disconnect === 'function' && this.disconnect(port),
			
			this.emit('disconnected-unregistered-port', port),
			
			this.log(`Disconnected with an unregistered port "${port.name}".`, port, this);
			
		}
		
	};
	
}

// ExtensionClient を管理ないし作成するコンテナー要素。
// この拡張機能の background において、この要素が実質的な起動処理を担う。
// またメソッド broadcast を通じて直下の extension-client へメッセージを送信する。
// この要素がドキュメントに接続されると、拡張機能のストレージからデータを読み込み、それに基づいて外部拡張機能との通信を行うクライアントを自動で作成する。
class ExtensionPortal extends PassivePortal {
	
	constructor() {
		
		super();
		
		//this.observeMutation(this.mutatedChildList, this, { childList: true });
		
	}
	calledConnectedCallback() {
		
		const bg = this.closest('background-node');
		
		bg ?	bg.load().then(this.xLoaded) :
				this.log(
						`Failed to load a local storage, a portal "${this.id}" is not included in <baclground-node>.`,
						this
					);
		
	}
	
	update(data) {
		
		if (!data || !Array.isArray(data)) {
			
			this.log(`There are no update data for an extension portal "${this.id}".`, data, this);
			
			return;
			
		}
		
		const	clients = [], lastClients = [];
		let i,l;
		
		i = -1;
		while (lastClients[++i] = this.firstChild) this.firstChild.remove();
		
		if (l = data.length) {
			
			i = -1;
			while (data[++i])
				(clients[i] = this.getClient(data[i].id, lastClients)).update(data[i], data[i].value === clients[i].xId);
			
			this.append(...clients),
			
			this.emit('updated');
			
		}
		
		this.log(`Updated clients of an extension portal "${this.id}".`, clients, this);
		
	}
	getClient(id, clients = this.querySelectorAll(':scope > extension-client')) {
		
		const actualId = PassiveClient.cid(id);
		let i;
		
		i = -1;
		while (clients[++i] && clients[i].id !== actualId);
		
		return clients[i] || new ExtensionClient();
		
	}
	createClient(message, port) {
		
		return new Promise((rs,rj) => this.getClient(port.name).attachPort(port).then(client => rs(client)));
		
	}
	
	disconnect() {
	}
	
	broadcast(message) {
		
		const clients = this.querySelectorAll(ExtensionPortal.TARGET_SELECTOR);
		let i;
		
		i = -1;
		while (clients[++i]) clients[i].broadcast(message);
		
		this.log(
				`Broadcasted a data to ${clients.length} external exntension${clients.length < 1 ? '' : 's'}.`,
				message,
				clients,
				this
			);
		
	}
	getDataFromStorage(storage) {
		return	storage && typeof storage === 'object' &&
						storage.data && typeof storage.data === 'object' && this.id in storage.data &&
							Array.isArray(storage.data[this.id]) ? storage.data[this.id] : null;
	}
	
	toJson(extra) {
		
		return PassivePortal.toJson(this.querySelectorAll(ExtensionPortal.TARGET_SELECTOR), extra);
		
	}
	
	static LOGGER_SUFFIX = 'ExPo';
	static ON_CONNECT = 'onConnectExternal';
	static TARGET_SELECTOR = 'extension-client';
	static tagName = 'extension-portal';
	static bound = {
		
		xLoaded(storage) {
			
			return this.update(this.getDataFromStorage(storage));
			
		}
		
	};
	
}

// 拡張内部の通信を行うクライアントオブジェクト
// JavaScript 内部でのクライアントの接続、切断処理は恐らく非同期に行われると思われるため
// イベントの通知を通じた Promise によりその完了を確認してから後続の処理を行うようにしているが、
// これは同時多発的に接続、切断処理が行われた際の状況を想定しておらず、仕様としてはかなり不完全。
class PassiveClient extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.handshake = new WeakMap();
		
	}
	
	attachPort(port) {
		
		return this.port === port ?
			(
				this.log(
					`Failed to attach a port to client "${client.id}" cause the client was already attached a same port.`,
					port,
					client,
					this
				),
				Promise.resolve(this)
			) : (
				new Promise((rs,rj) => this.disconnect().then(
						() =>	(
									this.id = PassiveClient.cid((this.port = port).name),
									this.port.onMessage.addListener(this.received),
									this.port.onDisconnect.addListener(this.disconnected),
									this.log(`Attached a port to client "${this.id}".`, port, this),
									rs(this)
								)
					))
			)
		
	}
	
	disconnect() {
		
		// disconnect を実行した側は、イベント disconnect が発生しないため、
		// この場合、同イベント通知時に実行されるコールバック関数 disconnected を任意に実行している。
		
		return this.port ?
			new Promise((rs,rj) => {
				
				const handshake = this.handshake.get(this.port);
				handshake ?	(handshake.rs = rs, handshake.rj = rj) : this.handshake.set(this.port, { rs, rj }),
				
				this.port.disconnect(),
				this.disconnected(this.port);
				
			}) :
			(
				this.log(`Failed to disconnect cause a client "${this.id}" has no port or was already disconnected.`, this),
				Promise.resolve()
			);
		
	}
	
	// 外部拡張機能への送信
	broadcast(message) {
		
		this.isOn ? (
				this.port.postMessage(this.xId, message),
				this.log(`Posted a message to an external extension "${this.id}"`, message, this)
			) :
			this.log(`Couldn't broadcast a message cause a client "${this.id}" is not connected.`, message, this)
		
	}
	// 拡張機能内部への送信
	notify(type = 'misc', message = this.toJson(true)) {
		
		const bg = this.closest('background-node');
		
		bg ?	bg.notify(type, message) :
				this.log(
						`Couldn't notify a message cause a client "${this.id}" is not included in <background-node>.`,
						...arguments,
						this
					);
		
	}
	post(message) {
		
		this.isOn ?
			(
				this.port.postMessage(message),
				this.log(`Posted a message from a client "${this.id}".`, message, this)
			) :
			this.log(`Couldn't post a message from a client "${this.id}" is disconnected.`, message, this);
		
	}
	
	toJson(extra) {
		
		return PassiveClient.rid(this.id);
		
	}
	
	kill(discards = true) {
		
		return	new Promise((rs,rj) => this.disconnect().then(() =>
						(
							discards ?	(
												this.remove(),
												this.dispatchEvent(new CustomEvent('discarded')),
												this.log(`A client "${this.id}" was discarded.`, this)
											) :
											this.log(`A client "${this.id}" was released.`, this),
							rs()
						)
					));
		
	}
	
	// 接続確立時に実行される処理の任意の実装
	// このメソッドは待ち受け状態から接続された時、つまり Portal の onConnect, onConnectExternal を通じて client が作成された時に実行される。
	onEstablish(type, message) {
		
		this.isOn = true,
		//this.notify(...arguments),
		this.port.postMessage({ type, data: message }),
		this.emit('established'),
		this.log(`A client "${this.id}" established a connection.`, type, message, this.port, this);
		
	}
	// 接続切断時に実行される処理の任意の実装
	// 拡張上の通信は一度切断すると再接続を行えない。
	// 外部拡張との通信は、データを残すため、切断後に再接続する必要がある場合は、そのデータに基づいて新しく通信を確立して擬似的に再接続するが、
	// 拡張内部間の通信はデータとして残す必要がないため、切断後はドキュメント上から完全に削除する。
	onDisconnect() {
		
		this.destroy();
		
	}
	
	static tagName = 'passive-node';
	static LOGGER_SUFFIX = 'Client';
	static ID_PREFIX = 'client-';
	static cid = id => this.ID_PREFIX + id;
	static rid = id => id.slice(this.ID_PREFIX.length);
	static bound = {
		
		connected(port) {},
		
		received(message) {
			
			this.log(`Received a message on a client "${this.id}".`, message, this);
			
		},
		
		disconnected(port) {
			
			const handshake = this.handshake.get(port);
			let d;
			
			this.isOn && this instanceof ExtensionClient &&
				browser.notifications.create(
					undefined,
					{
						type: 'basic',
						title: `Firefox アドオン: ${WX_META.name}`,
						message: `接続 "${this.data.name}" が切断されました。 ` +
							`(${(d = new Date()).getHours()}:${d.getMinutes()} ${d.getSeconds()}.${d.getMilliseconds()})`
					}
				),
			
			this.isOn = false,
			
			port.error && this.log(port.error, port, this),
			
			this.port.onMessage.removeListener(this.received),
			this.port.onDisconnect.removeListener(this.disconnected),
			
			typeof this.onDisconnect === 'function' && this.onDisconnect(),
			
			handshake && (
					typeof handshake.established === 'function' && port.onMessage.removeListener(handshake.established),
					typeof handshake.disconnected === 'function' && port.onDisconnect.removeListener(handshake.disconnected),
					typeof handshake.rs === 'function' && handshake.rs(this),
					this.handshake.delete(port)
				),
			
			this.dispatchEvent(new CustomEvent('disconnected')),
			
			this.log(`A client "${this.id}" was disconnected.`, this.port, this);
			
		}
		
	};
	
}

class OptionClient extends PassiveClient {
	
	constructor() {
		
		super();
		
	}
	
	static LOGGER_SUFFIX = 'OpClient';
	static tagName = 'option-client';
	static bound = {
		
		received(message) {
			
			const bg = this.closest('background-node');
			
			if (!bg) return;
			
			this.log(`Received a "${message.type}" message.`, message, this);
			
			switch (message.type) {
				
				// ExternalPotal 内の全体のアップデート、オプションページの Update を押した時に要求される。
				case 'update': bg.update(message.data); break;
				
				// 個別の ExternalPortal の接続、切断要求。オプションページの Connect,Disconnect ボタンを押した時に要求される。
				case 'connection': bg.changeConnectionExternal(message.target); break;
				
				// 拡張機能全体の初期化、オプションページの Initialize ボタンを押した時に要求される。
				case 'initialize': bg.initialize(); break;
				
				// 拡張内部からのログ出力の切り換え
				case 'logging':
				bg.logSwitch(message.value),
				bg.notify(message.type, message);
				break;
				
			}
		}
		
	};
	
}

class ContentClient extends PassiveClient {
	
	constructor() {
		
		super();
		
	}
	
	static LOGGER_SUFFIX = 'CoClient';
	static tagName = 'content-client';
	static bound = {
		
		received(message, port) {
			
			const bg = this.closest('background-node');
			
			bg ?
				(
					bg.broadcast(message),
					this.log(
						`Broadcasted a received message from a content client "${this.id}".`,
						message,
						port,
						this
					)
				) : (
					this.log(
						`Couldn't broadcast a message cause a content client "${this.id}" does not belong to background.`,
						message,
						port,
						this
					)
				);
			
		}
		
	};
	
}

class ExtensionClient extends PassiveClient {
	
	constructor() {
		
		super();
		
	}
	
	connect(xId = this.data.value, forces = this.data.forces) {
		
		return this.isOn && this.xId === xId && !forces ?
				// 既に port を作成済みで、かつそれが第一引数 xId が示す拡張機能に接続されている場合、接続処理は行われない。
				// ただし、this.data.forces に true を指定した場合、既に確立した接続を切断した上で指定された xId に再接続を行う。
				Promise.resolve(this) :
				(
					this.data.value = xId,
					new Promise((rs,rj) => {
							
							// enable が false に設定されている場合、接続処理は行われず、さらに切断処理が行われる。
							// false で等価演算を行っているのは、this.enable の初期値が null であるため。
							if (this.enable === false) {
								
								this.log(`A client "${this.id}" is disabled to connect.`, this);
								
								return this.disconnect().then(() => rs(this));
								
							}
							
							let disconnecting;
							
							this.xId === (xId = xId === undefined ? this.xId : xId) || (disconnecting = this.disconnect());
							
							if (!xId || typeof xId !== 'string') {
								
								// Extension ID が空欄などの無効な値の場合、接続処理は試行されることなく回避されるが、
								// その値は、既存のポートのプロパティ xId に指定される。このプロパティはこのオブジェクトのプロパティ xId の値として直接用いられる。
								// これは処理の流れや値の由来を考えると不自然だが、入力側からすると記録された値が反映されるのは自然な動作であると考えられる。
								// しかしながら処理に不都合が生じた際は再検討すべき。
								this.port && (this.port.xId = xId),
								
								this.log(
										`Failed to connect, a specified xId "${xId}" is wrong type or an empty.`,
										 this
									 );
								
								return	this.data.value === xId	?	this.disconnect().then(() => rs(this)) :
											disconnecting				?	disconnecting.then(() => rs(this)) :
																				rs(this);
								
							}
							
							return (disconnecting || this.disconnect()).then(() => {
									
									const	port = this.__.wsRx.test(xId) ?	new WebSocketPort(xId) :
																						browser.runtime.connect(xId, this.__.connectInfo),
											handshake = {
												disconnected: port => this.established(false, port),
												established: message => message === true && this.established(message, port),
												rs,
												rj
											};
									
									(this.port = port).onMessage.addListener(handshake.established),
									port.onDisconnect.addListener(handshake.disconnected),
									this.handshake.set(port, handshake),
									port.xId = xId,
									
									this.log(
											`A client "${this.id}" began to establish a connection with an extension "${xId}".`,
											port,
											this
										);
									
								});
							
						})
					);
		
	}
	
	update(data, cancelsToConnect = false) {
		
		let enabled = this.enable;
		
		(data && typeof data === 'object') || (data = { id: data });
		this.data = this.data && typeof this.data === 'object' ? { ...this.data, ...data } : { id: this.data, ...data };
		
		'value' in this.data || (this.data.value = ''),
		'enable' in this.data || (this.data.enable = true),
		'forces' in this.data || (this.data.forces = false),
		
		this.id = PassiveClient.cid(this.data.id),
		
		this.log(`Updated an extension client "${this.id}", ready to connect.`, this.data, this);
		
		return (enabled = this.data.enable === enabled) && cancelsToConnect ?
			this.notify('extension-connection', { id: this.data.id, isConnected: this.isOn }) :
			this.connect(undefined, !enabled);
		
	}
	
	broadcast(message) {
		
		let log;
		
		if (this.isOn) {
			
			log = `Broadcasted a message from a client "${PassiveClient.rid(this.id)}" to an extension ${this.xId}.`,
			this.port.postMessage(message);
			
		} else {
			
			log = `Couldn't broadcast a message cause a client "${PassiveClient.rid(this.id)}" has no connection.`;
			
		}
		
		this.log(log, message, this);
		
	}
	
	
	// このメソッドは待ち受け状態から接続された時、つまり Portal の onConnect, onConnectExternal を通じて client が作成された時に実行される。
	onEstablish(type, message) {
		
		this.isOn = true,
		// 外部拡張へ接続の確立を伝える。
		this.broadcast(message),
		// オプションページなどへ、外部拡張機能の接続を伝える。
		this.notify(type),
		this.emit('established'),
		this.log(`A client "${this.id}" established a connection with an extension "${this.xId}".`, this.port, this);
		
	}
	onDisconnect() {
		
		// オプションページなどへ、外部拡張機能の切断を伝える通知。
		//this.notify('connection');
		this.notify('extension-connection', { id: this.data.id, isConnected: this.isOn });
		
	}
	
	toJson(extra) {
		
		const data = { id: PassiveClient.rid(this.id), enable: null, forces: null, ...this.data, value: this.xId };
		
		extra && (data.isConnected = typeof this.isOn === 'boolean' ? this.isOn : null);
		
		return data;
		
	}
	
	get enable() { return this.data && typeof this.data === 'object' ? !!this.data.enable : null; }
	set enable(v) {
		
		!(this.data.enable = !!v) && this.isOn &&
			(
				this.log(
					`A client "${this.id}" was disabled, a port "${this.port.name}" of that client will be disconnected.`,
					port,
					this
				),
				this.disconnect()
			);
		
	}
	get xId() { return this.data && typeof this.data === 'object' && 'value' in this.data ? this.data.value : null; }
	//get xId() { return this.port ? this.port.xId : ''; }
	set xId(v) { this.connect(v); }
	
	static tagName = 'extension-client';
	static LOGGER_SUFFIX = 'ExClient';
	static connectInfo = { name: browser.runtime.id };
	static wsRx = /^(?:ws|wss):\/\/.+/;
	static bound = {
		
		established(result, port) {
			
			const handshake = this.handshake.get(port);
			
			handshake && (
				
				port.onMessage.removeListener(handshake.established),
				port.onDisconnect.removeListener(handshake.disconnected),
				
				result ? (
						port.onMessage.addListener(this.received),
						port.onDisconnect.addListener(this.disconnected),
						this.onEstablish('extension-connection', true)
					) :
					this.log(
						'Failed to connect with an external extensions,' +
							`there seems no extensions such "${this.xId}".`,
						this
					),
				
				this.handshake.delete(port),
				
				handshake.rs(this)
				
			);
			
		},
		
		received(message) {
			
			this.log(`Received a message from an extension ${this.xId}.`, message, this);
			
		}
		
	};
	
}

class WebSocketPort extends ExtensionNode {
	
	constructor(url, option) {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.ws = new WebSocket(url),
		
		this.onMessage = new WSPOnMessage({ target: this.ws, owner: this, type: 'message' }),
		this.onDisconnect = new WSPOnDisconnect({ target: this.ws, owner: this, type: 'close', args: [ this.ws ] });
		
	}
	postMessage(message) {
		
		this.ws.send(JSON.stringify(message));
		
	}
	disconnect() {
		
		this.ws.close();
		
	}
	
	get xId() { return this.ws instanceof WebSocket ? this.ws.xId : null; }
	set xId(v) { this.ws instanceof WebSocket && (this.ws.xId = v); }
	
	static LOGGER_SUFFIX = 'WSP';
	static tagName = 'websocket-port';
	
}
class WSPListener extends ExtensionNode {
	
	constructor(option) {
		
		super({ loggerPrefix: WX_SHORT_NAME, ...option }),
		
		this.owner = this.option.owner,
		this.target = this.option.target,
		this.type = this.option.type,
		this.args = 'args' in this.option ? Array.isArray(this.option.args) ? this.option.args : [ this.option.args ] : [],
		
		this.handler = new WeakMap();
		
	}
	generateHandler(handler) {
		
		return handler.bind(this.owner, ...this.args);
		
	}
	addListener(handler) {
		
		const boundHandler =	this.handler.get(handler) || this.generateHandler(handler);
		
		this.handler.set(handler, boundHandler),
		this.addEvent(this.target, this.type, boundHandler);
		
	}
	removeListener(handler) {
		
		const boundHandler = this.handler.get(handler);
		
		boundHandler && this.removeEvent(this.target, this.type, boundHandler);
		
	}
	
	static LOGGER_SUFFIX = 'WSPL';
	static tagName = 'wsp-listener';
	
}
class WSPOnMessage extends WSPListener {
	
	constructor(option) {
		
		super(option);
		
	}
	generateHandler(handler) {
		
		return event => {
				
				try {
					
					event = JSON.parse(event.data);
					
				} catch (error) {
					
					throw new Error(error);
					console.error('Failed to parse a JSON from a WebSocket server.', event, event.data),
					event = null;
					
				}
				
				handler.call(this.owner, event, ...this.args);
				
			};
		
	}
	
	static LOGGER_SUFFIX = 'WSPm';
	static tagName = 'wsp-message-listener';
	
}
class WSPOnDisconnect extends WSPListener {
	
	constructor(option) {
		
		super(option);
		
	}
	
	// 現状継承元を拡張しないが、必要に応じて任意に拡張可能。
	
	static LOGGER_SUFFIX = 'WSPd';
	static tagName = 'wsp-disconnect-listener';
	
}

defineCustomElements(BackgroundNode, PassivePortal, ExtensionPortal, PassiveClient, OptionClient, ContentClient, ExtensionClient, WebSocketPort, WSPListener, WSPOnMessage, WSPOnDisconnect);