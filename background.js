const listen = detail => {
	
	const filter = browser.webRequest.filterResponseData(detail.requestId);
	
	hi(detail,filter);
	
	filter.onstart = event => hi('start',event,filter),
	filter.onerror = event => hi('error',event,filter),
	filter.onstop = event => {
		//const ws = new WebSocket(detail.url);
		//ws.addEventListener('message',()=>{hi();}),
		hi('stop',ws,event,filter);
	}
	filter.ondata = event => hi('data',event,filter);
	
};

hi(Date.now());
browser.webRequest.onBeforeRequest.addListener(listen,{urls:['wss://msgd.live2.nicovideo.jp/websocket']},['blocking','requestBody']);