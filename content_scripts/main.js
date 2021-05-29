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

let liveData,nnnwsbc,thread,vposBaseTime,commentThread;

const
log = createLog('CS'),
liveDataNode = document.getElementById('embedded-data'),
portName = uid4();
port = browser.runtime.connect({ name: portName }),
connected = message => message === true && boot(),
boot = () => {
	
	if (!liveDataNode) {
		log('No live data node. The process is quitted.');
		return;
	}
	
	log('Phase 1/4: To get live data node has been succeeded.', liveDataNode);
	
	const liveDataNodeStr = liveDataNode.getAttribute("data-props");
	
	if (!liveDataNodeStr) {
		log('The live data node has no data. The process is quitted.');
		return;
	}
	
	log('Phase 2/4: To get live data has been succeeded. Ready to convert the data to JSON.', liveDataNodeStr),
	
	liveData = (() => {
		try { return JSON.parse(liveDataNodeStr); }
		catch(error) { return error; }
	})();
	
	if (!liveData || liveData instanceof Error) {
		
		log('Failed to convert JSON from live data. The process is quitted.', liveData);
		return;
		
	}
	
	log('Phase 3/4: To convert live data to JSON has been succeeded.', liveData),
	
	nnnwsbc = new NNNWSBroadcaster(liveData, { loggerPrefix: WX_SHORT_NAME });
	nnnwsbc.addUntrustedListener('updated-thread-data-stringified', updatedThreadData),
	nnnwsbc.addUntrustedListener('recieved-thread-data-from-comment', updateCommentThreadData),
	nnnwsbc.addUntrustedListener('recieved-from-live-stringified', recievedFromLive),
	nnnwsbc.addUntrustedListener('recieved-from-comment-stringified', recievedFromComment),
	
	log('Phase 4/4: The boot sequence for content_script was finished.');
	
},
updatedThreadData = event => {
	
	log('Recieved a thread data.', thread = JSON.parse(event.detail));
	
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
recievedFromLive = event => {
	
	recieved('live', event.detail);
	
},
recievedFromComment = event => {
	
	const data = recieved('comment', event.detail);
	
},
recieved = (from = 'default', stringifiedData) => {
	
	const data = JSON.parse(stringifiedData),
			ws = WS[from] || WS.defaullt;
	let k,type;
	
	switch (from) {
		case 'live':
		type = data.type || 'unknown';
		break;
		case 'comment':
		type = (type = Object.keys(data).length) === 1 ? type[0] : 'unknown';
		break;
	}
	
	port.sendMessage({ from, type, data }),
	
	log(`Recieved a data from ${ws.logName}.`, data);
	
	return data;
	
},
WS = {
	comment: { logName: 'a CommentWebSocket', eventName: 'comment' },
	live: { logName: 'a LiveWebSocket', eventName: 'live' },
	default: { logName: 'an Unknow WebSocket', eventName: 'wws' }
};

port.onMessage.addListener(connected);

})();