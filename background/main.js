(() => {

const
log = createLog('Bg'),
port = {},
data = [],
connected = client => {
	
	port[client.name] = { client, callback: onMessage[client.name] },
	client.onMessage.addListener(port[client.name].callback),
	client.postMessage(true);
	
},
onMessage = {
	option(message) {
		
		switch (message.on) {
			case 'update': updateData(message.data); break;
		}
		
	},
	content(message) {
		
		publish(message);
		
	}
},
boot = storage => {
	
	browser.runtime.onConnect.addListener(connected);
	
},
publish = message => {
	
	let i;
	
	i = -1;
	while (data[++i]) data[i].value && port[data[i].value] && port[data[i].value].postMessage(message);
	
},
updateData = latest => {
	
	if (!Array.isArray(latest)) return;
	
	let i;
	
	i = -1, data.length = 0;
	while (latest[++i]) data[i] = latest[i];
	
};

browser.storage.local.get().then(boot);


})();