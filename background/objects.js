class PortCollection extends ExtensionNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		(new MutationObserver(this.mutatedChildList)).observe(this, { childList: true });
		
	}
	
	has(id) {
		
		return !!this.querySelector(`#${id}`);
		
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
		
		let k,v, method;
		
		this.log('The list of ports mutated.', records = ExtensionNode.getMovedNodesFromMR(records));
		
		for (k in records) {
			method = `${k === 'added' ? 'add' : 'remove' }EventListener`;
			for (v of records[k].values())
				v[method]('connected', this.notifyConnection), v[method]('disconnected', this.notifyConnection);
		}
		
	},
	
	notifyConnection(event) {
		
		this.dispatchEvent(new CustomEvent(`${event.type}-external`, { detail: event.target }));
		
	}
	
};

class PortClient extends ExtensionNode {
	
	constructor(data) {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		data && this.setData(data);
		
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
		
		this.port ?	this.port.disconnect() :
						(
							this.log('Tried to disconnect a port but there were no port yet.'),
							clearTimeout(this.timer),
							this.dispatchEvent(new CustomEvent('disconnected', { detail: this }))
						),
		
		this.log(`A port disconnects with an extension "${this.extId}".`, this);
		
	}
	release(discards = true) {
		
		clearTimeout(this.timer),
		this.port.onMessage.removeListener(this.received),
		this.port.onDisconnect.removeListener(this.disconnected),
		
		discards && this.remove();
		
	}
	
	toJson(extra) {
		
		const data = { ...this.data, id: this.id };
		
		extra && hi(data.isConnected = this.isConnectedExternal);
		
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
		
		this.data.value === (v === undefined ? this.value : v) || this.close();
		
		if (!v || typeof v !== 'string') {
			
			this.close(),
			this.log(`A specigied extId "${v}" is wrong type.`, this);
			return;
			
		}
		
		if (!this.enable) return;
		
		if (this.port instanceof PortClient && this.isConnectedExternal) {
			// 既に port を作成済みで、かつそれが第一引数 extId が示す拡張機能に接続されている場合、接続処理は行われない。
			// ただし、第二引数 forces に true を指定した場合、既に確立した接続を切断した上で指定された extId に再接続を行う。
			if (this.port.extId === v && !this.data.forces) return;
			
			clearTimeout(this.timer),
			this.port.onDisconnect.removeListener(this.disconnected),
			this.port.disconnect();
			
		}
		
		(this.port = browser.runtime.connect(v, PortClient.connectInfo)).extId = this.data.value = v,
		this.port.onMessage.addListener(this.received),
		this.port.onDisconnect.addListener(this.disconnected),
		this.timer = setTimeout(this.timeouted, PortClient.timeoutDuration),
		
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
				clearTimeout(this.timer),
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
		
	},
	
	// 指定した ID の拡張機能が存在しない場合、通信は即座にエラーを返すようなので、タイムアウト判定は廃止予定。
	timeouted() {
		this.release(false), this.log('Connecting with an external extension was timeouted.', this);
	}
	
};

defineCustomElements(PortCollection, PortClient);