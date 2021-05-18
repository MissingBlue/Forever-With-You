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

const	log = createLog('CS'),
		liveDataNode = document.getElementById('embedded-data');

if (!liveDataNode) {
	log('No live data node. The process is quitted.');
	return;
}

log('To get live data node has been succeeded.', liveDataNode);

const liveDataNodeStr = liveDataNode.getAttribute("data-props");

if (!liveDataNodeStr) {
	log('The live data node has no data. The process is quitted.');
	return;
}

log('To get live data has been succeeded. Ready to convert the data to JSON.', liveDataNodeStr);

const liveData = (() => {
	try { return JSON.parse(liveDataNodeStr); }
	catch(error) { return error; }
})();

if (!liveData || liveData instanceof Error) {
	
	log('Failed to convert JSON from live data. The process is quitted.', liveData);
	return;
	
}

log('To convert live data to JSON has been succeeded.', liveData);

const nnnwsbc = new NNNWSBroadcaster(liveData, { loggerPrefix: WX_SHORT_NAME });

log('The boot sequence for content_script was finished.');

})();