/*
	Tips
		
		content_scripts 内で content_scripts 内から通知された CustomEvent を捕捉することはできない。
		恐らく content_scripts 上の EventTarget が通知するイベントは page(window) へ通知されるため。
		content_scripts 上で作成した DOM のイベントは捕捉できるが、それは DOM が page(window) と見かけ上共有されるためで、
		content_scripts 上で作成した EventTarget を継承するオブジェクトは、content_scripts 上にしか存在しないため、
		そのイベントは、イベントの通知対象が page(window) 上に存在しないため、 content_scripts 上はおろか page(window) からさえも捕捉できない。
		contents_script 上の関数やオブジェクトをコピーするユーティリティー関数(cloneInto)は存在するが、
		それらはあくまで Object のコピーを想定したもので、独自に作成したオブジェクトのプロトタイプに属する関数などは呼べない。
		つまり EventTarget を継承するオブジェクトのイベント関連のメソッドを page(window) 上で使うことができない。
		この仕様に対応するには、addEventListener の第四引数 wantsUntrusted に true を指定する。
		ただし、この引数は Mozzila 系のブラウザーのみで受け付ける非標準のものである点に留意が必要。
		
			class A extends EventTarget {  constructor() { super(); this.addEventListener('a', e => console.log(e)); } }
			const a = new A();
			a.dispatchEvent(new CustomEvent('a')); // 何も起こらない
			window.wrappedJSObject.a = cloneInto(a, window, { cloneFunctions: true, wrapReflectors: true });
			window.eval('try{a.dispatchEvent(new CustomEvent(\'a\'));}catch(e){console.log(e);}');
				// "Permission denied to access property "dispatchEvent"" になる。
			
			// addEventListener の第四引数 wantsUntrusted に true を指定。
			a.addEventListener('a', event => console.log(event.detail), false, true),
			a.dispatchEvent(new CustomEvent('a'), { detail: 'hi' });
				// コンソールに hi と表示される。
		
		参考資料
			https://developer.mozilla.org/ja/docs/Mozilla/Add-ons/WebExtensions/Content_scripts
			https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Sharing_objects_with_page_scripts
			https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Language_Bindings/Components.utils.cloneInto
			https://developer.mozilla.org/ja/docs/Web/API/WebSocket
			https://developer.mozilla.org/ja/docs/Web/API/EventTarget/addEventListener#syntax
		
*/

(() => {

let property,nnnwsbc,thread,commentThread,log;

const
LOG = createLog('CS'),
propertyNode = document.getElementById('embedded-data'),
boot = () => {
	
	if (!propertyNode) {
		log('No property data node. The process is quitted.');
		return;
	}
	
	log('Phase 1/4: To get property data node has been succeeded.', propertyNode);
	
	const propertyNodeStr = propertyNode.getAttribute("data-props");
	
	if (!propertyNodeStr) {
		log('The property data node has no data. The process is quitted.');
		return;
	}
	
	log('Phase 2/4: To get property data has been succeeded. Ready to convert the data to JSON.', propertyNodeStr),
	
	property = (() => {
		try { return JSON.parse(propertyNodeStr); }
		catch(error) { return error; }
	})();
	
	if (!property || property instanceof Error) {
		
		log('Failed to convert JSON from property data. The process is quitted.', property);
		return;
		
	}
	
	log('Phase 3/4: To convert property data to JSON has been succeeded.', property);
	
	(nnnwsbc = new NNNWSBroadcaster(property, { loggerPrefix: WX_SHORT_NAME })).
		addEvent(nnnwsbc, 'updated-thread-data-stringified', updatedThreadData),
	nnnwsbc.addEvent(nnnwsbc, 'received-thread-data-from-comment', updateCommentThreadData),
	nnnwsbc.addEvent(nnnwsbc, 'received-from-live-stringified', receivedFromLive),
	nnnwsbc.addEvent(nnnwsbc, 'received-from-comment-stringified', receivedFromComment),
	
	log('Phase 4/4: The boot sequence for content_script was finished.');
	
},
updatedThreadData = event => {
	
	log('received a thread data.', thread = JSON.parse(event.detail));
	
},
openedCommentWS = event => {
	
	(thread && thread.threadId) ? (
			nnnwsbc.send('live', `{"type":"watch","data":{"command":"getpostkey","params":["${thread.threadId}"]}}`),
			log('Require a post key.', `{"type":"watch","data":{"command":"getpostkey","params":["${thread.threadId}"]}}`)
		) :
		log('Failed to request a post key for no thread ID.');
	
},
updateCommentThreadData = event => {
	
	log('Updated a thread data coming from a CommentWebSocket.', commentThread = JSON.parse(event.detail));
	
},
receivedFromLive = event => {
	
	received('live', event.detail);
	
},
receivedFromComment = event => {
	
	const data = received('comment', event.detail);
	
},
received = (from = 'default', stringifiedData) => {
	
	const data = JSON.parse(stringifiedData),
			ws = WS[from] || WS.defaullt;
	let k,type;
	
	switch (from) {
		case 'live':
		type = data.type || 'unknown';
		break;
		case 'comment':
		type = (type = Object.keys(data)).length === 1 ? type[0] : 'unknown';
		break;
	}
	
	port.postMessage({ from, type, data, property }),
	
	log(`Posted a data was received from "${ws.logName}".`, data);
	
	return data;
	
},
WS = {
	comment: { logName: 'Comment', eventName: 'comment' },
	live: { logName: 'Live', eventName: 'live' },
	default: { logName: 'Unknown', eventName: 'wws' }
},
portName = uid4(),
port = browser.runtime.connect({ name: portName }),
receivedFromPort = (message,ownPort) => {
	
	log('Received a message from background.', message);
	
	switch (typeof message) {
		
		case 'boolean':
		message === true && (log('Send a registration request to background.'), port.postMessage('content'));
		return;
		
		case 'string':
		switch (message) {
			case 'registered':
			log('If this log was not appeared in any position, this block can be removed.'),
			boot();
			return;
		}
		break;
		
		case 'object':
		if (!message) return;
		switch (message.type) {
			
			case 'registered':
			log('Established a connection with background.', message),
			boot();
			return;
			
			case 'post':
			log('Received a post request.', message),
			nnnwsbc.post(message.data.text, message.data.isAnon);
			return;
			
			case 'logging':
			log('Received a logging request.', message),
			log = message.data.value ? LOG : () => {},
			nnnwsbc.logSwitch(message.data.value);
			return;
			
		}
		
	}
	
};

log = LOG,
port.onMessage.addListener(receivedFromPort);

})();