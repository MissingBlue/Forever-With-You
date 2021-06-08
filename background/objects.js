class BackgroundNode extends ExtensionNode {
	
	constructor(storage) {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.storage = storage;
		
	}
	
	update(storage) {
		
		this.log('Update a data.', storage, this),
		
		this.save(storage).then(xSaved).then(xUpdated);
		
	}
	connectExternal(data) {
		
		const client = this.querySelector(`#${data.id}`);
		
		client && client.connect(data);
		
	}
	disconnectExternal(data) {
		
		const client = this.querySelector(`#${data.id}`);
		
		client && client.disconnect();
		
	}
	initialize() {
		
		const clients = this.querySelectorAll('external-port');
		let i;
		
		i = -1;
		while (clients[++i]) clients[i].kill(true);
		
		browser.storage.local.clear().then(this.xInitialized);
		
	}
	
	save(storage) {
		
		this.log('Save a data to a local storage.', this.storage = { ...this.storage, ...storage });
		
		const saved = browser.storage.local.set(this.storage);
		
		saved.then(this.xSave),
		
		return saved;
		
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
		while (clients[++i])	clients[i].port.postMessage(message),
									this.log(`Sent "${type}" data to an internal client "${client[i].id}".`, message, client);
		
	}
	
	toJson(extra) {
		
		const portals = this.querySelectorAll('external-portal'), data = [];
		let i;
		
		i = -1;
		while (portals[++i]) data[i] = portals[i].toJson(extra);
		
		return data;
		
	}
	
}
BackgroundNode.LOGGER_SUFFIX = 'Bg',
BackgroundNode.tagName = 'background-node',
BackgroundNode.bound = {
	/*
	mutatedChildList(records) {
		
		let v,method;
		
		records = ExtensionNode.getMovedNodesFromMR(records);
		for (v of records.values())
			v instanceof PortCollection && (
					v[method = `${v.parentElement === this ? 'add' : 'remove'}Event`]
						(v, 'connected-external', this.onExternalConnection),
					v[method](v, 'disconnected-external', this.onExternalConnection)
				);
		
	},
	onExternalConnection(event) {
		
		const type = event.type.split('-')[0], client = event.detail;
		let k;
		
		this.log(`A port "${client.id}" for an extension "${client.value}" was ${type}.`, client);
		
		for (k in port) port[k].type === 'option' && (
				port[k].client.postMessage({
					type: `extension-${type}`,
					id: client.id,
					isConnected: client.isConnectedExternal,
					data: client.toJson(true)
				}),
				client.log(`The extension data "${client.value}" was sent to internal port "${port.name}".`)
			);
	},
	*/
	
	xSave() {
		
		this.broadcast('updated', this.storage),
		this.log('Data was saved to the storage.', this.storage);
		
	},
	xSaved() {
		
		return new Promise((rs,rj) => {
				
				const portals = this.querySelectorAll('external-portal');
				let i = i0 = -1, l = portals.length;
				
				if (l) {
					const xUpdated = () => ++i0 === l && rs();
					while (portals[++i]) portals[i].update(this.storage.data).then(xUpdated);
				} else rs();
				
			});
		
	}
	xUpdated() {
		this.log('Updated a data.' this.storage, this);
	}
	xInitialized() {
		
		this.log('This extension was initialized.', this),
		this.broadcast('initialized');
		
	}
	
};

// このオブジェクトを継承するには継承先での createClient の実装が必要。
// また createClient はクライアントを引数にして返す Promise を戻り値にする必要がある。
class Portal extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.bind(Portal.bound),
		
		this.constructor.ON_CONNECT && typeof browser.runtime[this.constructor.ON_CONNECT] === 'function' &&
			browser.runtime[this.constructor.ON_CONNECT].addListener(this.connected);
		
	}
	
	toJson(extra) {
		
		const clients = this.querySelectorAll(':scope > external-client'), data = [];
		let i;
		
		i = -1;
		while (clients[++i]) data[i] = clients[i].toJson(extra);
		
		return data;
		
	}
	
}
Portal.LOGGER_SUFFIX = 'Portal',
Portal.tagName = 'ce-portal',
Portal.bound = {
	
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
		
		message && typeof message === 'string' &&
			this.createClient(message, port).then(client => {
					
					client.isOn = true,
					
					port.onMessage.removeListener(this.established),
					port.onDisconnect.removeListener(this.disconnected),
					
					this.appendChild(client),
					
					this.log(`Created a client "${client.id}" on connecting.`, message, port, client, this);
					
				});
		
	},
	// この diconnected は、このオブジェクトの connected と respnoded の間に接続が切断された場合にのみ実行される。
	// 状況としては極めて稀。
	disconnected(port) {
		
		port.onDisconnect.removeListener(this.disconnected),
		port.onMessage.removeListener(this.responded),
		
		typeof this.disconnect === 'function' && this.disconnect(port),
		
		this.dispatchEvent(new CustomEvent('disconnected-un-registered-port', { detail: port })),
		
		this.log(`Disconnected with an un registered port "${port.name}".`, port, this);
		
	}
	
};

class InternalPortal extends Portal {
	
	constructor() {
		
		super(),
		
		this.bind(InternalPortal.bound);
		
	}
	
	createClient(message, port) {
		
		return new Promise((rs,rj) => (
				
				(this.querySelector(`#${port.name}`) || (message === 'option' ? new OptionPort() : new ContentPort())).
					attachPort(port).then(client => {
							const bg = this.closest('backgrond-node');
							bg && port.postMessage({ type: 'registered', data: this.closest('backgrond-node').toJson(true) }),
							this.log(`Created a "${message}" client "${client.id}".`, client, port, this),
							rs(client);
						});
				
			));
		
	}
	
}
InternalPortal.LOGGER_SUFFIX = 'InPo',
InternalPortal.ON_CONNECT = 'onConnect',
InternalPortal.tagName = 'internal-portal',
InternalPortal.bound = {};

class ExternalPortal extends Portal {
	
	constructor() {
		
		super(),
		
		this.observeMutation(this.mutatedChildList, this, { childList: true });
		
	}
	
	update(data) {
		
		return data && Array.isArray(data) && data.length ?
			new Promise((rs,rj) => {
				
				const	clients = [],
						xConnectedAll = client => {
							
							if (++i0 < l) return;
							
							while (this.firstChild) this.firstChild.remove();
							this.append(...clients),
							
							rs(),
							this.dispatchEvent(new CustomEvent('updated'));
							
						};
				let i,i0,l;
				
				i = i0 = -1, l = data.length;
				while (data[++i])
					(clients[i] = this.querySelector(`#${data[i].id}`) || new ExternalClient()).update(data[i]),
					clients[i].connect().then(xConnectedAll);
				
			}) :
			Promise.resolve();
		
	}
	
	createClient(message, port) {
		
		return new Promise((rs,rj) => (
				
				(this.querySelector(`#${port.name}`) || new ExternalClient()).attachPort(port).then(client => (
						this.log(`Created an extension client "${client.id}".`, client, port, this),
						rs(client);
					));
				
			));
		
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
	
}
ExternalPortal.LOGGER_SUFFIX = 'ExPo',
ExternalPortal.ON_CONNECT = 'onConnectExternal',
ExternalPortal.tagName = 'external-portal',
ExternalPortal.bound = {
	
	mutatedChildList(mr) {
		
		let v, method;
		
		mr = ExtensionNode.getMovedNodesFromMR(mr);
		for (v of mr.values()) v instanceof ExtrenalClient && (
				v[method = `${v.parentElement === this ? 'add' : 'remove'}Event`](v, 'connected', this.onExternalConnection),
				v[method](v, 'disconnected', this.onExternalConnection)
			);
		
	}
	
};

// JavaScript 内部でのクライアントの接続、切断処理は恐らく非同期に行われると思われるため
// イベントの通知を通じた Promise によりその完了を確認してから後続の処理を行うようにしているが、
// これは同時多発的に接続、切断処理が行われた際の状況を想定しておらず、仕様としてはかなり不完全。
class ClientNode extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.bind(ClientNode.bound);
		
	}
	
	attachPort(port) {
		
		return this.port === port ?	Promise.resolve(this) :
												new Promise((rs,rj) => this.disconnect().then(
														() =>	(
																	this.id = (this.port = port).name,
																	this.port.onConnect.addListener(this.connected),
																	this.port.onMessage.addListener(this.received),
																	this.port.onDisconnect.addListener(this.disconnected),
																	rs(this)
																)
													));
		
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
	
	toJson(extra) {
		
		return this.id;
		
	}
	
}
ClientNode.LOGGER_SUFFIX = 'Client',
ClientNode.tagName = 'client-node',
ClientNode.connectInfo = { name: browser.runtime.id },
ClientNode.bound = {
	
	established(messsage) {
		
		messsage === true && (
				this.port.onMessage.removeListener(this.established),
				this.port.onConnected.addListener(this.connected),
				this.connected(this.port),
				typeof this.onEstablish === 'function' && this.onEstablish(),
				this.dispatchEvent(new CustomEvent('established'));
			);
		
	},
	connected(port) {
		
		this.isOn = true,
		
		typeof this.received === 'function' && this.port.onMessage.addListener(this.received),
		this.port.onDisconnect.addListener(this.disconnected),
		
		typeof this.post === 'function' && this.post(true),
		
		typeof this.onConnect === 'function' && this.onConnect(),
		
		this.dispatchEvent(new CustomEvent('connected'));
		
	},
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
	
};

class ExternalClient extends ClientNode {
	
	constructor() {
		
		super();
		
	}
	
	connect(extId = this.extId, forces = this.data.forces) {
		
		return	(this.extId !== extId || forces) ?
						new Promise((rs,rj) => (this.addEvent(this, 'changed', event => rs(this)), this.extId = extId)) :
						Promise.resolve(this);
		
	}
	
	update(data) {
		
		(data && typeof data === 'object') || (data = { id: data });
		this.data = this.data && typeof this.data === 'object' ? { ...this.data, ...data } : { id: this.data, ...data };
		
		'value' in this.data || (this.data.value = ''),
		'enable' in this.data || (this.data.enable = true),
		'forces' in this.data || (this.data.forces = false),
		
		this.id = this.data.id;
		
		return this.data;
		
	}
	
	post(message) {
		
		this.isOn && this.port.postMessage(this.extId, message);
		
	}
	
	onEstablish() {
		
		this.log(`Established a connection with an extension "${this.port.extId}".`, port, this);
		
	}
	onConnect() {
		
		this.broadcast('connection'),
		this.log(`A client "${this.id}" was connected with an extension "${this.extId}".`, port, this);
		
	}
	onDisconnect() {
		
		this.broadcast('connection'),
		this.log(`A client "${this.id}" was disconnected.`, port, this);
		
	}
	broadcast(type = 'misc', message = this.toJson(true)) {
		
		const bg = this.closest('background-node');
		
		bg && bg.broadcast(type, message);
		
	}
	
	toJson(extra) {
		
		const data = { id: this.id, value: null, enable: null, forces: null, ...this.data };
		
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
	get extId() { return this.data.value; }
	set extId(v) {
		
		if (!this.enable) {
			
			this.log(`A client "${this.id}" is disabled to connect.`, this),
			this.disconnect().then(() => this.dispatchEvent('changed'));
			return;
			
		}
		
		let promise;
		
		this.data.value === (v = v === undefined ? this.data.value : v) || (promise = this.disconnect());
		
		if (!v || typeof v !== 'string') {
			
			this.log(`Failed to connect, a specified extId "${this.data.value = v}" is wrong type or just an empty.`, this),
			this.data.value === v	?	this.disconnect().then(() => this.dispatchEvent('changed')) :
			promise						?	promise.then(() => this.dispatchEvent('changed')) :
												this.dispatchEvent('changed');
			return;
			
		}
		
		// 既に port を作成済みで、かつそれが第一引数 extId が示す拡張機能に接続されている場合、接続処理は行われない。
		// ただし、this.data.forces に true を指定した場合、既に確立した接続を切断した上で指定された extId に再接続を行う。
		if (this.isOn && this.port.extId === v && !this.data.forces) {
			this.dispatchEvent('changed');
			return;
		}
		
		(promise || this.disconnect()).then(() => (
				
				this.port.onConnected.removeListener(this.connected),
				
				(this.port = browser.runtime.connect(v, PortClient.connectInfo)).extId = this.data.value = v,
				this.port.onMessage.addListener(this.established),
				
				this.dispatchEvent(new CustomEvent('changed')),
				
				this.log(`A client "${this.id}" establishes with an extension "${v}".`, this)
				
			));
		
	}
	
}
ExternalClient.LOGGER_SUFFIX = 'ExClient',
ExternalClient.tagName = 'external-client',
ExternalClient.connectInfo = { name: browser.runtime.id },
ExternalClient.bound = {};

// このオブジェクトを正しく継承するには継承先で接続崎からのメッセージの受信時に実行される、
// 任意の処理を行うメソッド（コールバック関数） received を実装する必要がある。
class InternalClient extends ClientNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.bound(InternalClient.bound);
		
	}
	
	post(message) {
		
		this.isOn && this.port.postMessage(message);
		
	}
	
	onEstablish() {
		this.log(`Established a connection with an internal port "${this.port.name}".`, port, this);
	}
	onConnect() {
		this.log(`A port "${this.port.name}" of a client "${this.id}" was connected.`, port, this);
	}
	onDisconnect() {
		this.log(`A port "${this.port.name}" of a client "${this.id}" was disconnected.`, port, this);
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
	
}
InternalClient.LOGGER_SUFFIX = 'InClient',
InternalClient.tagName = 'internal-client',
InternalClient.bound = {};

class OptionClient extends InternalClient {
	
	constructor() {
		
		super();
		
	}
	
}
OptionClient.LOGGER_SUFFIX = 'OpClient',
OptionClient.tagName = 'option-client',
OptionClient.bound = {
	
	received(message) {
		
		const bg = this.closest('background-node');
		
		if (!bg) return;
		
		this.log(`Received a "${message.type}" message.`, message, this);
		
		switch (message.type) {
			
			// ExternalPotal 内の全体のアップデート、オプションページの Update を押した時に要求される。
			case 'update': bg.update(message.data); break;
			
			// 個別の ExternalPortal の接続、切断要求。オプションページの Connect,Disconnect ボタンを押した時に要求される。
			case 'connect': bg.connectExternal(message.data); break;
			case 'disconnect': bg.disconnectExternal(message.data); break;
			
			// 拡張機能全体の初期化、オプションページの Initialize ボタンを押した時に要求される。
			case 'initialize': bg.initialize(); break;
			
		}
	}
	
};

class ContentClient extends InternalClient {
	
	constructor() {
		
		super();
		
	}
	
}
ContentClient.LOGGER_SUFFIX = 'CoClient',
ContentClient.tagName = 'content-client',
ContentClient.bound = {
	
	received(message, port) {
		
		const bg = this.closest('background-node');
		
		bg ?
			(
				bg.publish(message),
				this.log(
					`Published a received message from a content port "#{this.port.id}" of a client "${this.id}".`,
					message,
					port,
					this
				)
			) : (
				this.log(
					`Couldn't publish a message cause a client "${this.id}" does not belong to background.`,
					message,
					port,
					this
				)
			);
		
	}
	
};

class PortCollection extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		browser.runtime.onConnect.addListener(this.connected),
		(new MutationObserver(this.mutatedChildList)).observe(this, { childList: true });
		
	}
	
	has(id) {
		
		return !!this.querySelector(`#${id}`);
		
	}
	update(...data) {
		
		const clients = [];
		let i;
		
		i = -1; //setData は update に名称変更すべき。
		while (data[++i]) (clients[i] = this.querySelector(`#${data[i].id}`) || new PortClient()).setData(data[i]);
		
		while (this.firstChild) this.firstChild[clients.includes(this.firstChild) ? 'remove' : 'release']();
		
		// client の connect 処理は、各々の connectedCallback で行うようにする。
		this.append(...clients),
		
		this.log(`Updated or created ${i = data.length} port${i < 2 ? '' : 's'}.`, clients, data);
		
		
	}
	
	toJson(extra) {
		
		const data = [];
		let i;
		
		i = -1;
		while (this.children[++i]) data[i] = this.children[i].toJson(extra);
		
		return data;
		
	}
	
}
PortCollection.LOGGER_SUFFIX = 'PoCo',
PortCollection.tagName = 'port-collection',
PortCollection.verifyData =
	(data, collection) => data && typeof data === 'object' && !collection.has(data.id) ? data : null,
PortCollection.bound = {
	
	mutatedChildList(records) {
		
		let v, method;
		
		this.log(`The following ${v = (records = ExtensionNode.getMovedNodesFromMR(records)).size} port${v ? 's' : ''} were moved from or to others.`, ...records);
		
		for (v of records.values())
			v[method = `${v.parentElement === this ? 'add' : 'remove' }EventListener`]('connected', this.notifyConnection),
			v[method]('disconnected', this.notifyConnection);
		
	},
	
	notifyConnection(event) {
		
		this.dispatchEvent(new CustomEvent(`${event.type}-external`, { detail: event.target }));
		
	}
	
};

class PortClient extends ExtensionNode {
	
	constructor(data) {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		data && this.setData(data),
		
		browser.runtime.onConnectExternal.addListener(this.received),;
		
	}
	
	setData(data) {
		
		let k;
		
		(data && typeof data === 'object') || (data = { id: data });
		this.data = this.data && typeof this.data === 'object' ? { ...this.data, ...data } : data;
		
		'value' in this.data || (this.data.value = ''),
		'enable' in this.data || (this.data.enable = true),
		'forces' in this.data || (this.data.forces = false),
		
		this.id = this.data.id;
		
		return this.data;
		
	}
	
	connect(data) {
		
		(data ? this.setData(data) : this.data) && (this.enable = this.data.enable, this.extId = this.data.value);
		
	}
	close() {
		
		this.port ?	this.port.disconnect() : this.log('Tried to disconnect a port but there were no port yet.'),
		
		this.dispatchEvent(new CustomEvent('disconnected', { detail: this })),
		this.log(`A port disconnects with an extension "${this.extId}".`, this);
		
	}
	release(discards = true) {
		
		this.port && (
				this.port.onMessage.removeListener(this.received),
				this.port.onDisconnect.removeListener(this.disconnected)
			),
		
		discards && this.remove();
		
	}
	
	toJson(extra) {
		
		const data = { ...this.data, id: this.id };
		
		extra && (data.isConnected = this.isConnectedExternal);
		
		return data;
		
	}
	
	set enable(v) {
		
		(this.data.enable = !!v) ||
			(this.close(), this.log(`A port "${this.id}" is disconnected cause that was disabled.`, this));
		
	}
	get enable() {
		
		return !!this.data.enable;
		
	}
	set extId(v) {
		
		this.data.value === (v = v === undefined ? this.data.value : v) || this.close();
		
		if (!v || typeof v !== 'string') {
			
			this.data.value === v && this.close(),
			this.log(`A specified extId "${v}" is wrong type or just an empty.`, this);
			return;
			
		}
		
		if (!this.enable) return;
		
		if (this.port instanceof PortClient && this.isConnectedExternal) {
			// 既に port を作成済みで、かつそれが第一引数 extId が示す拡張機能に接続されている場合、接続処理は行われない。
			// ただし、第二引数 forces に true を指定した場合、既に確立した接続を切断した上で指定された extId に再接続を行う。
			if (this.port.extId === v && !this.data.forces) return;
			
			this.port.onDisconnect.removeListener(this.disconnected),
			this.port.disconnect();
			
		}
		
		(this.port = browser.runtime.connect(v, PortClient.connectInfo)).extId = this.data.value = v,
		this.port.onMessage.addListener(this.received),
		this.port.onDisconnect.addListener(this.disconnected),
		
		this.log(`A port connects with an extension "${v}".`, this);
		
	}
	get extId() {
		
		return this.data.value;
		
	}
	
}
PortClient.LOGGER_SUFFIX = 'PClient',
PortCollection.tagName = 'port-client',
PortCollection.allowedDataProperties = [ 'id', 'name', 'value', 'enable', 'forces' ],
PortClient.connectInfo = { name: browser.runtime.id },
PortClient.timeoutDuration = 5000,
PortClient.bound = {
	
	received(message) {
		
		switch (typeof message) {
			case 'string':
			
			switch (message) {
				
				case 'connected':
				this.isConnectedExternal = true,
				this.dispatchEvent(new CustomEvent('connected', { detail: this })),
				this.log(`Established a connection with an extension "${this.port.extId}".`, this, port);
				break;
				
			}
			
			break;
			default:
			this.log(`A port "${this.id}" caught an unknown issue on "#{this.extId}".`, message, this);
		}
		
	},
	
	disconnected(port) {
		
		this.isConnectedExternal = false;
		
		if (port && port.error) {
			
			this.log(port.error, this, port);
			
		} else {
			
			this.release(false),
			this.log(`A connection with "${this.port.extId}" was disconnected.`, this, port);
			
		}
		
		this.dispatchEvent(new CustomEvent('disconnected', { detail: this }));
		
	}
	
};

defineCustomElements(BackgroundNode, InternalPortal, OptionClient, ContentClient, ExternalPortal, ExternalClient);