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
class Portal extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.bind(Portal.bound),
		
		this.constructor.ON_CONNECT &&
			browser.runtime[this.constructor.ON_CONNECT] &&
			typeof browser.runtime[this.constructor.ON_CONNECT] === 'object' &&
			typeof browser.runtime[this.constructor.ON_CONNECT].addListener === 'function' &&
				(
					browser.runtime[this.constructor.ON_CONNECT].addListener(this.connected),
					this.log('A portal is listening for connecting.', this)
				);
		
	}
	
	toJson(extra) {
		
		const clients = this.querySelectorAll(':scope > external-client'), data = [];
		let i;
		
		i = -1;
		while (clients[++i]) data[i] = clients[i].toJson(extra);
		
		return data;
		
	}
	
	static LOGGER_SUFFIX = 'Portal';
	static tagName = 'portal-node';
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
			
			this.log(`Created a client "${client.id}".`, client, this);
			
			const established = typeof client.onEstablish === 'function' ? client.onEstablish(this) : Promise.resolve();
			
			established instanceof Promise ? established.then(() => this.xEstablished(client)) : this.xEstablished(client);
			
		},
		xEstablished(client) {
			
			client.dispatchEvent(new CustomEvent('established')),
			this.log(`Established a connection on a client "${client.id}".`, client.port, client, this);
			
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

class InternalPortal extends Portal {
	
	constructor() {
		
		super(),
		
		this.bind(InternalPortal.bound);
		
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
	
	static LOGGER_SUFFIX = 'InPo';
	static ON_CONNECT = 'onConnect';
	static tagName = 'internal-portal';
	static bound = {};
	
}

class ExternalPortal extends Portal {
	
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
	static tagName = 'external-portal';
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
			
		}
		
	};
	
}

// JavaScript 内部でのクライアントの接続、切断処理は恐らく非同期に行われると思われるため
// イベントの通知を通じた Promise によりその完了を確認してから後続の処理を行うようにしているが、
// これは同時多発的に接続、切断処理が行われた際の状況を想定しておらず、仕様としてはかなり不完全。
class ClientNode extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME });
		
		let k;
		
		for (k in this.preset) typeof this[k] === 'function' || this.bind(this.preset[k], k);
		
	}
	
	attachPort(port) {
		
		return this.port === port ?
			(
				this.log(
					`Failed to attach a port to client "${client.id}" cause the client is already attached a port.`,
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
			new Promise((rs,rj) => {
					
					const disconnected = event => (this.removeEvent(this, 'disconnected', disconnected), rs());
					
					this.addEvent(this, 'disconnected', disconnected),
					this.port.disconnect()
					
				}) :
			(this.log(`Failed to disconnect cause a client "${this.id}" has no port.`, this), Promise.resolve());
		
	}
	
	post(message) {
		this.isOn && (
				this.port.postMessage(message),
				this.log(`Posted a message from a client "${ClientNode.rid(this.id)}"`, message, this)
			);
		
	}
	
	toJson(extra) {
		
		return ClientNode.rid(this.id);
		
	}
	
	static LOGGER_SUFFIX = 'Client';
	static ID_PREFIX = 'client-';
	static cid = id => this.ID_PREFIX + id;
	static rid = id => id.slice(this.ID_PREFIX.length);
	static tagName = 'client-node';
	static connectInfo = { name: browser.runtime.id };
	static preset = {
		
		received(message) {
			
			switch (typeof message) {
				
				default:
				this.log(`A port "${this.id}" caught an unknown issue on "#{this.extId}".`, message, this);
				
			}
			
		},
		disconnected(port) {
			
			this.isOn = false,
			
			port.error && this.log(port.error, port, this),
			
			this.port.onMessage.removeListener(this.established),
			typeof this.received === 'function' && this.port.onMessage.removeListener(this.received),
			this.port.onDisconnect.removeListener(this.disconnected),
			
			typeof this.onDisconnect === 'function' && this.onDisconnect(),
			
			this.dispatchEvent(new CustomEvent('disconnected'));
			
		}
		
	}
	
}

class ExternalClient extends ClientNode {
	
	constructor() {
		
		super();
		
	}
	
	connect(extId = this.data.value, forces = this.data.forces) {
		
		return	this.isOn && this.extId === extId && !forces ? Promise.resolve(this) :
						new Promise((rs,rj) => (this.addEvent(this, 'changed', event => rs(this)), this.extId = extId));
		
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
	
	onEstablish(portal) {
		
		this.broadcast('connection'),
		this.log(
				`A client "${this.id}" established a connection with an extension "${this.port.extId}".`,
				this.port,
				this,
				portal
			);
		
	}
	/*onConnect() {
		
		this.broadcast('connection'),
		this.log(`A client "${this.id}" was connected with an extension "${this.extId}".`, port, this);
		
	}*/
	onDisconnect() {
		
		this.broadcast('connection'),
		this.log(`A client "${this.id}" was disconnected.`, this.port, this);
		
	}
	broadcast(type = 'misc', message = this.toJson(true)) {
		
		const bg = this.closest('background-node');
		
		bg && bg.broadcast(type, message);
		
	}
	
	toJson(extra) {
		
		const data = { id: ClientNode.rid(this.id), enable: null, forces: null, ...this.data, value: this.extId };
		
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
	get extId() { return this.port ? this.port.extId : ''; }
	set extId(v) {
		
		if (!this.enable) {
			
			this.log(`A client "${this.id}" is disabled to connect.`, this),
			this.disconnect().then(() => this.emit('changed'));
			return;
			
		}
		
		let promise;
		
		this.data.value === (v = v === undefined ? this.data.value : v) || (promise = this.disconnect());
		
		if (!v || typeof v !== 'string') {
			
			this.log(`Failed to connect, a specified extId "${this.data.value = v}" is wrong type or just an empty.`, this),
			this.data.value === v	?	this.disconnect().then(() => this.emit('changed')) :
			promise						?	promise.then(() => this.emit('changed')) :
												this.emit('changed');
			return;
			
		}
		
		// 既に port を作成済みで、かつそれが第一引数 extId が示す拡張機能に接続されている場合、接続処理は行われない。
		// ただし、this.data.forces に true を指定した場合、既に確立した接続を切断した上で指定された extId に再接続を行う。
		if (this.isOn && this.port.extId === v && !this.data.forces) {
			this.emit('changed');
			return;
		}
		
		(promise || this.disconnect()).then(() => (
				
				//this.port && this.port.onConnected.removeListener(this.connected),
				
				(this.port = browser.runtime.connect(v, ClientNode.connectInfo)).extId = this.data.value = v,
				this.port.onMessage.addListener(this.established),
				
				this.emit('changed'),
				
				this.log(`A client "${this.id}" establishes with an extension "${v}".`, this)
				
			));
		
	}
	
	static LOGGER_SUFFIX = 'ExClient';
	static tagName = 'external-client';
	static bound = {
		
		established(message) {
			message === true && (
					this.port.onMessage.addListener(this.received),
					this.post(this.isOn = true),
					this.log(`Established a connection with an extension ${this.extId}.`, message, this)
				)
			
		},
		
		received(message) {
			
			this.log(`Received a message from an extension ${this.extId}.`, message, this);
			
		}
		
	};
	
}

// このオブジェクトを正しく継承するには継承先で接続崎からのメッセージの受信時に実行される、
// 任意の処理を行うメソッド（コールバック関数） received を実装する必要がある。
class InternalClient extends ClientNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.bind(InternalClient.bound);
		
	}
	
	onEstablish(portal) {
		
		const bg = this.closest('background-node');
		
		bg && this.post({ type: 'registered', storage: bg.toJson(true) }),
		
		this.log(`A client "${this.id}" established an internal connection.`, this.port, this, portal);
		
	}
	/*onConnect(port) {
		this.log(`A port "${this.port.name}" of a client "${this.id}" was connected.`, port, this);
	}*/
	onDisconnect() {
		this.log(`An internal client "${this.id}" was disconnected.`, this.port, this);
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
	
	static LOGGER_SUFFIX = 'InClient';
	static tagName = 'internal-client';
	static bound = {};
	
}

class OptionClient extends InternalClient {
	
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

class ContentClient extends InternalClient {
	
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

defineCustomElements(BackgroundNode, InternalPortal, OptionClient, ContentClient, ExternalPortal, ExternalClient);