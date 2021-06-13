class BackgroundNode extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME });
		
	}
	connectedCallback() {
		
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
		
		this.log('Save a data to a local storage.',this.storage),
		
		saved.then(this.xSave);
		
		return saved;
		
	}
	
	update(storage) {
		
		this.log('Update a data.', storage, this),
		this.save(storage).then(this.xSaved).then(this.xUpdated);
		
	}
	
	changeConnectionExternal(data) {
		
		const client = this.querySelector(`#${data.id}`);
		
		client && client[data.isConnected ? 'connect' : 'disconnect'](data).then(xChangedConnection);
		
	}
	
	publish(message) {
		
		const portals = this.querySelectorAll('external-portal');
		let i;
		
		i = -1;
		while (portals[++i]) portals[i].publish(message);
		
	}
	
	broadcast(type, data) {
		
		const	message = { type, data },
				clients = this.querySelectorAll('internal-portal :is(internal-client, option-client, content-client)');
		let i;
		
		i = -1;
		while (clients[++i])	clients[i].post(message);
		
		this.log(`Sent a "${type}" data to ${i < 2 ? 'an internal client' : 'internal clients'}.`, message, ...clients);
		
	}
	initialize() {
		
		const clients = this.querySelectorAll('external-port');
		let i;
		
		i = -1;
		while (clients[++i]) clients[i].kill(true);
		
		browser.storage.local.clear().then(this.xInitialized);
		
	}
	
	toJson(extra) {
		
		const portals = this.querySelectorAll('external-portal'), data = {};
		let i;
		
		i = -1;
		while (portals[++i]) data[portals[i].id || i] = portals[i].toJson(extra);
		
		return { ...this.storage, data };
		
	}
	
	static LOGGER_SUFFIX = 'Bg';
	static tagName = 'background-node';
	static bound = {
		
		xSave() {
			
			this.broadcast('updated', this.storage),
			this.log('Data was saved to the storage.', this.storage);
			
		},
		xSaved() {
			
			return new Promise((rs,rj) => {
					
					const portals = this.querySelectorAll('external-portal');
					let l;
					
					if (l = portals.length) {
						const xUpdated = () => ++i0 === l && rs();
						let i,i0, data;
						i = i0 = -1;
						while (portals[++i])	(data = portals[i].getDataFromStorage(this.storage)) ?
														portals[i].update(data).then(xUpdated) : ++i0;
					} else rs();
					
				});
			
		},
		xUpdated() {
			
			this.log('Updated a data.', this.storage, this);
			
		},
		
		xChangedConnection(client) {
			
			this.broadcast('extension-connection', client.toJson(true));
			
		},
		
		xInitialized() {
			
			this.storage = null,
			
			this.log('This extension was initialized.', this),
			this.broadcast('initialized');
			
		}
		
	};
	static pressedPageAction(event) {
		browser.runtime.openOptionsPage();
	}
	
}

// このオブジェクトを継承するには継承先での createClient の実装が必要。
// createClient はクライアントを引数にして解決する Promise を戻り値にする必要がある。
class PassivePortal extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.constructor.ON_CONNECT &&
			browser.runtime[this.constructor.ON_CONNECT] &&
			typeof browser.runtime[this.constructor.ON_CONNECT] === 'object' &&
			typeof browser.runtime[this.constructor.ON_CONNECT].addListener === 'function' &&
				(
					browser.runtime[this.constructor.ON_CONNECT].addListener(this.connected),
					this.log('A portal is listening for connecting.', this)
				);
		
	}
	connectedCallback() {
		
		this.log('Connected an internal portal with a document.', this, document);
		
	}
	
	createClient(message, port) {
		
		return message && typeof message === 'string' ?
			new Promise((rs,rj) =>
				
				(
					this.querySelector(`#${ClientNode.cid(port.name)}`) ||
					(message === 'option' ? new OptionClient() : new ContentClient())
				).
				attachPort(port).then(client => rs(client))
				
			) :
			Promise.reject();
		
	}
	
	toJson(extra) {
		
		const clients = this.querySelectorAll(':scope > external-client'), data = [];
		let i;
		
		i = -1;
		while (clients[++i]) data[i] = clients[i].toJson(extra);
		
		return data;
		
	}
	
	static LOGGER_SUFFIX = 'PaPo';
	static ON_CONNECT = 'onConnect';
	static tagName = 'passive-portal';
	static bound = {
		
		// これらは接続の待ち受けからクライアントを作成するためのメソッド。
		// 例えばオプションページ、あるいは外部拡張から browser.runtime.connect を通じてバックグラウンドに接続された時に、
		// これらのメソッドが実行され、それを通じて通信用のクライアントノードが半ば自動的に作成、継承元のオブジェクトに子として追加される。
		
		connected(port) {
			
			port.onMessage.addListener(this.established),
			port.onDisconnect.addListener(this.disconnected),
			
			port.postMessage(true),
			
			this.log(`Established a connection on port "${port.name}".`, port, this);
			
		},
		established(message, port) {
			
			this.createClient(message, port).then(this.xCreatedClient).catch(error => { throw new Error(error) });
			
		},
		
		xCreatedClient(client) {
			
			client.isOn = true,
			
			client.port.onMessage.removeListener(this.established),
			client.port.onDisconnect.removeListener(this.disconnected),
			
			client.parentElement === this || this.appendChild(client),
			
			client instanceof PassiveClient ?
				client.onEstablish('registered', this.closest('background-node').toJson(true)) :
				client.onEstablish('connection'),
			
			this.log(`Established a connection on a client "${client.id}" created.`, client.port, client, this);
			
		},
		
		// この diconnected は、このオブジェクトの connected と established の間に接続が切断された場合にのみ実行される。
		// 状況としては極めて稀。
		disconnected(port) {
			
			port.onDisconnect.removeListener(this.disconnected),
			port.onMessage.removeListener(this.responded),
			
			typeof this.disconnect === 'function' && this.disconnect(port),
			
			this.dispatchEvent(new CustomEvent('disconnected-un-registered-port', { detail: port })),
			
			this.log(`Disconnected with an unregistered port "${port.name}".`, port, this);
			
		}
		
	};
	
}
class ExtensionPortal extends PassivePortal {
	
	constructor() {
		
		super(),
		
		this.observeMutation(this.mutatedChildList, this, { childList: true });
		
	}
	connectedCallback() {
		
		this.log('Connected an external portal with a document.', this, document);
		
		const bg = this.closest('background-node');
		
		bg.load().then(this.xFetched).then(this.xUpdated);
		
	}
	
	update(data) {
		
		return data && Array.isArray(data) && data.length ?
			new Promise((rs,rj) => {
				
				const	clients = [],
						xConnectedAll = client => {
							
							if (++i0 < l) return;
							
							while (this.firstChild) this.firstChild.remove();
							this.append(...clients),
							
							this.dispatchEvent(new CustomEvent('updated')),
							rs();
							
						};
				let i,i0,l;
				
				i = -1, l = data.length, i0 = 0;
				while (data[++i])
					(clients[i] = this.querySelector(`#${data[i].id}`) || new ExternalClient()).update(data[i]),
					clients[i].connect().then(xConnectedAll);
				
			}) :
			Promise.resolve();
		
	}
	
	createClient(message, port) {
		
		return new Promise((rs,rj) =>
				
				(this.querySelector(`#${ClientNode.cid(port.name)}`) || new ExternalClient()).
					attachPort(port).then(client => rs(client))
				
			);
		
	}
	disconnect() {
	}
	
	publish(message) {
		
		const clients = this.querySelectorAll(':scope > external-port');
		let i;
		
		i = -1;
		while (clients[++i]) clients[i].post(message);
		
		this.log(`Published a data to ${clients.length} external exntension${clients.length < 1 ? '' : 's'}.`, message);
		
	}
	getDataFromStorage(storage) {
		return	storage && typeof storage === 'object' &&
						storage.data && typeof storage.data === 'object' && this.id in storage.data &&
							Array.isArray(storage.data[this.id]) ? storage.data[this.id] : null;
	}
	
	static LOGGER_SUFFIX = 'ExPo';
	static ON_CONNECT = 'onConnectExternal';
	static tagName = 'extension-portal';
	static bound = {
		
		xFetched(storage) {
			
			return this.update(this.getDataFromStorage(storage));
			
		},
		xUpdated() {
			
			this.log('Updated clients in an external portal.', this);
			
		},
		
		mutatedChildList(mr) {
			
			let v, method;
			
			mr = ExtensionNode.getMovedNodesFromMR(mr);
			for (v of mr.values()) v instanceof ExternalClient && (
					v[method = `${v.parentElement === this ? 'add' : 'remove'}Event`](v, 'connected', this.onExternalConnection),
					v[method](v, 'disconnected', this.onExternalConnection)
				);
			
		},
		
		...PassivePortal.bound
		
	};
	
}

// JavaScript 内部でのクライアントの接続、切断処理は恐らく非同期に行われると思われるため
// イベントの通知を通じた Promise によりその完了を確認してから後続の処理を行うようにしているが、
// これは同時多発的に接続、切断処理が行われた際の状況を想定しておらず、仕様としてはかなり不完全。
class PassiveClient extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.establishments = new WeakSet(),
		this.disconnections = new WeakSet();
		
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
									this.id = ClientNode.cid((this.port = port).name),
									this.port.onMessage.addListener(this.received),
									this.port.onDisconnect.addListener(this.disconnected),
									this.log(`Attached a port to client "${this.id}".`, port, this),
									rs(this)
								)
					))
			)
		
	}
	
	disconnect() {
		
		return this.port ?
			new Promise((rs,rj) => (this.disconnections.add(rs()), this.port.disconnect())) :
			(
				this.log(`Failed to disconnect cause a client "${this.id}" has no port.`, this),
				Promise.resolve()
			);
		
	}
	
	post(type = 'misc', message = this.toJson(true)) {
		
		const bg = this.closest('background-node');
		
		bg && bg.broadcast(type, message);
		
	}
	
	toJson(extra) {
		
		return ClientNode.rid(this.id);
		
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
	
	// このメソッドは Portal かそれを継承するオブジェクトからこのオブジェクトのインスタンスが作成された時に呼び出される。
	onEstablish(type, message) {
		
		this.isOn = true,
		typeof type === 'string' ? this.post(type, message) : this.post(type),
		this.emit('established'),
		this.log(`A client "${this.id}" established a connection.`, this.port, this);
		
	}
	
	static tagName = 'passive-node';
	static LOGGER_SUFFIX = 'Client';
	static ID_PREFIX = 'client-';
	static cid = id => this.ID_PREFIX + id;
	static rid = id => id.slice(this.ID_PREFIX.length);
	static bound = {
		
		received(message) {
			
			this.log(`Received a message on a client "${this.id}".`, message, this);
			
		},
		
		disconnected(port) {
			
			let v;
			
			this.isOn = false,
			
			port.error && this.log(port.error, port, this);
			
			for (v of this.establishments) this.port.onMessage.hasListener(v) && this.port.onMessage.removeListener(v);
			
			this.port.onMessage.removeListener(this.received),
			this.port.onDisconnect.removeListener(this.disconnected);
			
			for (v of this.disconnections) v(), this.disconnections.delete(v);
			
			this.dispatchEvent(new CustomEvent('disconnected')),
			
			this.broadcast('connection'),
			
			this.log(`A client "${this.id}" was disconnected.`, this.port, this);
			
		}
		
	};
	
}
class ExtensionClient extends PassiveClient {
	
	constructor() {
		
		super();
		
	}
	
	connect(xId = this.data.value, forces = this.data.forces) {
		
		return
			this.isOn && this.xId === xId && !forces ?
				// 既に port を作成済みで、かつそれが第一引数 xId が示す拡張機能に接続されている場合、接続処理は行われない。
				// ただし、this.data.forces に true を指定した場合、既に確立した接続を切断した上で指定された xId に再接続を行う。
				Promise.resolve(this) :
				new Promise((rs,rj) => {
						
						//(this.addEvent(this, 'changed', event => rs(this)), this.xId = xId)
						
						if (!this.enable) {
							
							this.log(`A client "${this.id}" is disabled to connect.`, this);
							
							return this.disconnect().then(() => rs(this));
							
						}
						
						let promise;
						
						this.data.value === (xId = xId === undefined ? this.data.value : xId) ||
							(promise = this.disconnect());
						
						if (!xId || typeof xId !== 'string') {
							
							this.log(`Failed to connect, a specified xId "${this.data.value = xId}" is wrong type or just an empty.`, this);
							
							return	this.data.value === xId	?	this.disconnect().then(() => rs(this)) :
										promise							?	promise.then(() => rs(this)) :
																				rs(this);
							
						}
						
						return (promise || this.disconnect()).then(() => {
								
								const established = message => (
										message === true && (
												this.port.onMessage.removeListener(established),
												this.establishments.delete(established),
												this.port.onMessage.addListener(this.received),
												this.onEstablish(true),
												rs(this)
											)
									);
								
								this.establishments.add(established),
								(this.port = browser.runtime.connect(xId, ClientNode.connectInfo)).xId =
									this.data.value = xId,
								this.port.onMessage.addListener(),
								
								this.log(`A client "${this.id}" tried to connect with an extension "${xId}".`, this)
								
							});
						
					});
		
	}
	
	update(data) {
		
		(data && typeof data === 'object') || (data = { id: data });
		this.data = this.data && typeof this.data === 'object' ? { ...this.data, ...data } : { id: this.data, ...data };
		
		'value' in this.data || (this.data.value = ''),
		'enable' in this.data || (this.data.enable = true),
		'forces' in this.data || (this.data.forces = false),
		
		this.id = ClientNode.cid(this.data.id);
		
		return this.data;
		
	}
	
	post(message) {
		this.isOn && (
				this.port.postMessage(message),
				this.log(
						`Posted a message from a client "${ClientNode.rid(this.id)}" to an extension ${this.xId}.`,
						message,
						this
					)
			);
	}
	
	toJson(extra) {
		
		const data = { id: ClientNode.rid(this.id), enable: null, forces: null, ...this.data, value: this.xId };
		
		extra && (data.isConnected = !!this.isOn);
		
		return data;
		
	}
	
	get enable() { return !!this.data.enable; }
	set enable(v) {
		
		(this.data.enable = !!v) || this.isOn &&
			(
				this.log(
					`A client "${this.id}" was disabled, a port "${this.port.name}" for that client will be disconnected.`,
					port,
					this
				),
				this.disconnect()
			);
		
	}
	get xId() { return this.port ? this.port.xId : ''; }
	set xId(v) { this.connect(v); }
	
	static tagName = 'extesion-client';
	static LOGGER_SUFFIX = 'ExClient';
	static connectInfo = { name: browser.runtime.id };
	static bound = {
		
		established(message) {
			
			message === true && (this.port.onMessage.addListener(this.received), this.onEstablish(true))
			
		},
		received(message) {
			
			this.log(`Received a message from an extension ${this.xId}.`, message, this);
			
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
					bg.publish(message),
					this.log(
						`Published a received message from a content client "${this.id}".`,
						message,
						port,
						this
					)
				) : (
					this.log(
						`Couldn't publish a message cause a content client "${this.id}" does not belong to background.`,
						message,
						port,
						this
					)
				);
			
		}
		
	};
	
}

defineCustomElements(BackgroundNode, OptionClient, ContentClient, ExtensionPortal, ExtensionClient);