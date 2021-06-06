var
storage;

const
log = createLog('Bg'),
port = {},
poco = new PortCollection(),

boot = localStorage => {
	
	log('Loaded from storage.', storage = localStorage),
	
	poco.addEvent(poco, 'connected-external', onExternalConnection),
	poco.addEvent(poco, 'disconnected-external', onExternalConnection),
	
	browser.runtime.onConnect.addListener(connected),
	browser.runtime.onConnectExternal.addListener(connectedExternal),
	
	Array.isArray(storage.data) ?
		register(...storage.data) : log('No date or no correct data in storage.', storage.data),
	
	browser.browserAction.onClicked.addListener(() => browser.runtime.openOptionsPage());
	
},

register = (...data) => {
	
	const clients = [];
	let i, datum, pc;
	
	i = -1;
	while (datum = pc = data[++i])
		(pc = poco.querySelector(`#${datum.id}`)) || (pc = new PortClient()), (clients[clients.length] = pc).connect(datum);
	
	while (poco.firstChild) poco.firstChild.remove();
	
	poco.append(...clients),
	
	log(`Set ${clients.length} port${clients.length < 2 ? '' : 's'} based on the specified data.`, ...data);
	
},

onExternalConnection = event => {
	
	const type = event.type.split('-')[0];
	
	log(`A port "${event.detail.id}" was ${type}, that will be notified.`, event.detail),
	
	//coco オプションから接続を要求後、その正否を伝え、オプション側でオプション上でその結果を反映させる。
	port.option && port.option.postMessage({
			type: `extension-${type}`,
			id: event.detail.id,
			isConnected: event.detail.isConnectedExternal,
			data: event.detail.toJson(true)
		});
	
},
connectedExternal = client => {
	
	log('Established an external connection.', client),
	
	client.onMessage.addListener(received),
	client.postMessage(true);
	
},
disconnectedExternal = client => {
},

connected = client => {
	
	log('Established an internal connection.', client),
	
	client.onMessage.addListener(received),
	client.postMessage(true);
	
},
received = (message, client) => {
	
	let data;
	
	log('Received an internal message.', message);
	
	switch (typeof message) {
		
		case 'string':
		
		if (onMessage[message]) {
			
			log(`A message has been sent from "${message}". It will be listened by "${client.name}".`),
			port[client.name] = { client, type: message, callback: onMessage[message] },
			client.onMessage.addListener(port[client.name].callback),
			data = { type: 'registered', data: poco.toJson(true) };
			
		}
		
		client.postMessage(data);
		
		break;
	}
	
	
},
onMessage = {
	
	option(message) {
		
		log('Received a message from "option".', message);
		
		switch (message.type) {
			
			case 'update':
			
			log('Recieved an updating request.', message.data);
			
			const data = message.data.data;
			
			Array.isArray(data) && (
					log('External extensions data will be updated.', data),
					register(...data)
				),
			
			save(message.data);
			
			break;
			
			case 'connect':
			
			const pc = poco.querySelector(`#${message.target.id}`);
			
			if (!pc) {
				log(`Received a request from ${message.target.id}, but there are no such a port.`, message.target);
				return;
			}
			
			log(`Required to connect with extension "${message.target.value}" for "${message.target.id}".`, message.target);
			pc.connect(message.target);
			
			break;
			
			case 'disconnect':
			hi();
			break;
			
		}
		
	},
	
	content(message) {
		
		log(`Received a data from a content script.`, message),
		
		publish(message);
		
	},
	
	external() {
	}
	
},
save = data => {
	
	log('Save.', storage = { ...storage, ...data }),
	
	browser.storage.local.set(data).then(() => {
			
			let k;
			
			for (k in port) port[k].client.postMessage({ type: 'saved', data });
			
			log('Data was saved to storage.', data);
			
		});
	
},
publish = message => {
	
	let i,i0,l,client;
	
	if (!(l = poco.children.length)) {
		
		log(`The data received is not published cause no registered external extensions.`);
		return;
		
	}
	
	i = -1, i0 = 0;
	while (client = poco.children[++i]) {
		try {
			client.connected && client.port.postMessage(client.port.extId, message),
			++i0;
		} catch (error) {
			client.log(error, client);
		}
	}
	
	log(`Published a data to ${i0}/${l} external exntension${l < 1 ? '' : 's'}.`, message);
	
};

browser.storage.local.get().then(boot);