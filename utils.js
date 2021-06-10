const
hi = console.log.bind(console, 'hi'),
Q	= (selector, root = document) => root.querySelector(selector),
QQ	= (selector, root = document) => root.querySelectorAll(selector),

// 等幅フォント時の文字幅を計算するために用いることを想定した関数。
// 文字列内の文字が ASCII の範囲内の場合 1、そうでない場合を 2 としてカウントして、その合計を返す。絵文字には非対応。
monoLength = str => {
	
	const rx = /^[\x00-\xFF]*$/;
	let i,l,l0;
	
	i = -1, l = str.length, l0 = 0;
	while (++i < l) l0 += rx.test(str[i]) ? 1 : 2;
	
	return l0;
	
},
deco = (content, contentL, contentR, contentPad, borderPattern, borderPad) => {
	const contentLength = monoLength(content) + monoLength(contentL) + monoLength(contentR),
			border = `${borderPattern.repeat(contentLength / monoLength(borderPattern))}${borderPad}`;
	return { border, content: `${contentL}${content}${contentPad.repeat(monoLength(border) - contentLength)}${contentR}` };
},
// content が表示される場所が console.log 上など、等幅フォントを採用していることを前提として、
// decoChr に指定した文字列で content を囲うことができるような文字列を値に指定したオブジェクトを返す。
// 戻り値のオブジェクトには、decoChr の指定に基づいて作成された囲い用の文字列 border と、
// それと同じ幅を持つ content がプロパティに指定される。より細かく指定したい場合は deco をそのまま使うことができる。
decolog = (content, decoChr) => deco(content, decoChr,decoChr,' ', `${decoChr} `, decoChr),

// uuid を生成
// https://qiita.com/psn/items/d7ac5bdb5b5633bae165
uid4	= () => {
	
	const UID4F = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
	
	let i = -1, id = '', c;
	
	while (c = UID4F[++i]) id +=	c === 'x' ? Math.floor(Math.random() * 16).toString(16) :
											c === 'y' ? (Math.floor(Math.random() * 4) + 8).toString(16) : c;
	
	return id;
	
},

defineCustomElements = (...customElementConstructors) => {
	
	const isTagName = /^[a-z](?:\-|\.|[0-9]|_|[a-z]|\u00B7|[\u00C0-\u00D6]|[\u00D8-\u00F6]|[\u00F8-\u037D]|[\u037F-\u1FFF]|[\u200C-\u200D]|[\u203F-\u2040]|[\u2070-\u218F]|[\u2C00-\u2FEF]|[\u3001-\uD7FF]|[\uF900-\uFDCF]|[\uFDF0-\uFFFD]|[\u10000-\uEFFFF])*-(?:\-|\.|[0-9]|_|[a-z]|\u00B7|[\u00C0-\u00D6]|[\u00D8-\u00F6]|[\u00F8-\u037D]|[\u037F-\u1FFF]|[\u200C-\u200D]|[\u203F-\u2040]|[\u2070-\u218F]|[\u2C00-\u2FEF]|[\u3001-\uD7FF]|[\uF900-\uFDCF]|[\uFDF0-\uFFFD]|[\u10000-\uEFFFF])*$/;
	let i, $;
	
	i = -1;
	while ($ = customElementConstructors[++i])
		typeof $.tagName === 'string' && isTagName.test($.tagName) && customElements.define($.tagName, $);
	
},

// WebExtensions 用のユーティリティー
WX_META = (window.browser || browser) && browser.runtime.getManifest(),
WX_SHORT_NAME = WX_META && WX_META.short_name.toUpperCase(),

createLog = (self, label = WX_SHORT_NAME || '') => console.log.bind(console, `[${label}#${self}]`),
createOnMessage = (to, label = WX_SHORT_NAME || '') =>
	
	msg =>	msg.__MSG__ && (!msg.to || msg.to === to) &&
					(
						Array.isArray(msg.detail) ?	console.log(`[${label}@${msg.from}]`, ...msg.detail) :
																console.log(`[${label}@${msg.from}]`, msg.detail)
					),

createMsg = from => {
	return (detail, to) => {
		console.log(`#${from}`, `@${to}`, detail),
		browser.runtime.sendMessage({ from, to, detail, __MSG__: true });
	};
};

class ExtensionNode extends HTMLElement {
	
	constructor(option = {}) {
		
		super(),
		
		this.__ = this.constructor,
		
		this.__listeners = [],
		this.__observers = new Map(),
		
		this.bind(this.__.bound),
		
		this.setOption(option),
		
		this.setLogger();
		
	}
	
	setOption(option) {
		
		(!this.option || typeof this.option !== 'object' || Array.isArray(this.option)) && (this.option = {});
		
		return this.option && typeof this.option === 'object' && !Array.isArray(this.option) ?
			(this.option = { ...this.option, ...option }) : this.option;
		
	}
	
	bind(source, name, ...args) {
		
		let i,l,k;
		
		switch (typeof source) {
			
			case 'function':
			this[(!(k = source.name) || k === 'anonymous') ?  name || 'anonymous' : k] = source.bind(this, ...args);
			return;
			
			case 'object':
			if (Array.isArray(source)) {
				i = -1, l = source.length;
				while (++i < l) this.bind(source[i], `${(name || 'anonymous') + i}`, ...args);
			} else if (source) for (k in source) this.bind(source[k], k, ...args);
			return;
			
		}
		
	}
	
	addEvent(node = this, type, handler, option = false, wantsUntrusted = true) {
		
		const args = [ node, type, handler, option = ExtensionNode.normalizeListenerOption(option) ],
				listener = this.isListened(...args);
		
		listener && this.removeEventWithListener(listener),
		node.addEventListener(type, handler, option, wantsUntrusted),
		this.__listeners[this.__listeners.length] = args;
		
	}
	removeEvent(node = this, type, handler, option = false) {
		
		const $ = this.isListened(...arguments);
		
		$ && ($[0].removeEventListener($[1], $[2], $[3]), this.__listeners.splice(this.__listeners.indexOf($),1));
		
	}
	removeEventWithListener(listener) {
		
		const i = this.__listeners.indexOf(listener);
		
		i === -1 ||
			(listener[0].removeEventListener(listener[1], listener[2], listener[3]), this.__listeners.splice(i,1));
		
	}
	isListened(node = this, type, handler, option = false) {
		
		let i, $;
		
		i = -1, option = ExtensionNode.normalizeListenerOption(option);
		while (
			($ = this.__listeners[++i]) &&
			!($[0] === node && $[1] === type && $[2] === handler && ExtensionNode.isSameListenerOption($[3], option))
		);
		
		return $ || false;
		
	}
	clearEvents() {
		
		let i, $;
		
		i = -1;
		while ($ = this.__listeners[++i]) $[0].removeEventListener($[1],$[2],$[3]);
		this.__listeners.length = 0;
		
	}
	dispatch(name, detail = {}, broadcasts = false) {
		
		detail && typeof detail === 'object' && detail.constructor === Object && (detail.target = this);
		
		if (broadcasts && this.id) {
			
			const listeners = QQ(`[data-for~="${this.id}"]`);
			let i,l,l0;
			
			i = -1, l = listeners.length;
			while (++i < l) listeners[i].dispatchEvent(new CustomEvent(name, { detail: { on: this, more: detail } }));
			
		}
		
		this.dispatchEvent(new CustomEvent(name, { detail }));
		
	}
	emit(type, detail, option) {
		
		type && typeof type === 'string' && (
				(!option || typeof option !== 'object') && (option = { composed: true }),
				detail && (option.detail = detail),
				this.dispatchEvent(new CustomEvent(type, option))
			);
		
	}
	
	observeMutation(callback, node, init) {
		
		let observer;
		
		(observer = this.__observers.get(callback)) ||
			(this.__observers.set(callback, observer = new MutationObserver(callback))),
		observer.observe(node, init);
		
	}
	disconnectMutationObserver(callback) {
		
		let observer;
		
		(observer = this.__observers.get(callback)) && observer.disconnect();
		
	}
	clearMutationObserver() {
		
		let observer;
		
		const ovservers = this.__observers.values();
		for (observer of ovservers) observer.disconnect();
		
		this.__observers.clear();
		
	}
	
	destroy(keepsElement = false) {
		
		keepsElement || this.parentElement && this.remove(),
		this.clearEvents(),
		this.clearMutationObserver(),
		this.dispatchEvent(new CustomEvent(`${this.__.tagName}-destroy`));
		
	}
	
	q(selector) {
		return this.shadowRoot.querySelector(selector);
	}
	qq(selector) {
		return this.shadowRoot.querySelectorAll(selector);
	}
	querySelectorWhole(selector, root = this) {
		const inner = Array.from(QQ(selector, root)),
				shadow = root.qq ? Array.from(root.qq(selector)) : [];
		return root.matches(selector) ? [ root, ...inner, ...shadow ] : [ ...inner, ...shadow ];
	}
	
	isAncestor(element) {
		
		let ancestor = this;
		
		while (element !== ancestor && (ancestor = ancestor.parentElement));
		
		return !!ancestor;
		
	}
	isLineage(element) {
		return this.isAncestor(element) || this.contains(element);
	}
	
	get(...keys) {
		
		let i,l,k,that;
		
		i = -1, l = keys.length, that = this;
		while (++i < l) {
			switch (typeof (k = keys[i])) {
				 case 'string':
				 if (typeof that !== 'object') return;
				 that = that[k];
				 break;
				 case 'number':
				 if (!Array.isArray(that)) return;
				 that = that[k];
				 break;
				 case 'object':
				 if (k !== null) return;
				 that = window;
			}
		}
		
		return that;
		
	}
	
	setLogger(prefix = this.option.loggerPrefix) {
		
		this.log = console.log.bind(console, `<${prefix ? `${prefix}@` : ''}${this.__.LOGGER_SUFFIX}>`);
		
	}
	
	static LOGGER_SUFFIX = 'EN';
	static tagName = 'extension-node';
	static AEL_UNTRUSTED_ARGS = [ false, true ];
	static AEL_ARGS_ONCE = [ { once: true }, true ];
	static getMovedNodesFromMR(mutationRecords) {
		
		let i, added, removed;
		
		i = 0, added = mutationRecords[0].addedNodes, removed = mutationRecords[0].removedNodes;
		while (mutationRecords[++i])	added = new Set([ ...added, ...mutationRecords[i].addedNodes ]),
												removed = new Set([ ...removed, ...mutationRecords[i].removedNodes ]);
		
		return { added, removed };
		
	}
	static getMovedNodesFromMR(records) {
		
		let i, moved;
		
		i = 0, moved = new Set([ ...records[0].addedNodes, ...records[0].removedNodes ]);
		while (records[++i]) moved = new Set([ ...moved, ...records[i].addedNodes, ...records[i].removedNodes ]);
		
		return moved;
		
	}
	static normalizeListenerOption(option = false) {
		
		(option && typeof option === 'object') || (option = { capture: !!option }),
		typeof option.capture === 'boolean' || (option.capture = false),
		typeof option.once === 'boolean' || (option.once = false);
		
		return option;
		
	}
	static isSameListenerOption(a, b) {
		
		const ab = { ...(a = this.normalizeListenerOption(a)), ...(b = this.normalizeListenerOption(b)) };
		let k;
		
		for (k in ab) if (!(k in a) || !(k in b) || a[k] !== b[k]) return false;
		
		return true;
		
	}
	
}

class CustomElement extends ExtensionNode {
	
	constructor(option) {
		
		super(option);
		
		const CNST = this.constructor;
		
		let i,i0,l, $, data;
		
		'tagName' in CNST && typeof CNST.tagName === 'string' &&
			(this.template = document.getElementById(CNST.tagName)) && this.template.tagName === 'TEMPLATE' &&
			(this.shadow = this.template.content.cloneNode(true), this.attachShadow(CNST.shadowRootInit).appendChild(this.shadow)),
		this.root = this.shadowRoot ?	(
													this.shadowRoot.firstElementChild.classList.add(CNST.tagName),
													this.shadowRoot.firstElementChild
												) :
												this;
		
		if (this.template) {
			
			// dataset.extends が示すクエリー文字列に一致する要素のクローンを shadowRoot に挿入する。
			// 要素が template の場合、そのプロパティ content を挿入する。
			// shadowRoot 内の要素 slot に対応する要素を shadowRoot 外からインポートする使い方を想定しているが、
			// それが求められるケースはほとんど存在しないと思われるため不要の可能性が強い。
		 	if (this.template.dataset.extends && this.shadowRoot) {
				
				i = -1, l = (data = CustomElement.parseDatasetValue(this.template, 'slots')).length;
				while (++i < l) {
					if (typeof data[i] !== 'string') continue;
					i0 = -1, $ = QQ(data[i]);
					while ($[++i0]) this.shadowRoot.appendChild
						($[i0].tagName === 'TEMPLATE' ? $[i0].cloneNode(true).content : $[i0].cloneNode(true));
				}
				
			}
			
			// 外部スタイルシートのファイルのパスを指定する。複数指定することもできる。その場合、JSON の書式で配列に入れて指定する。
			if (this.template.dataset.css) {
				
				i = -1, l = (data = CustomElement.parseDatasetValue(this.template, 'css')).length;
				while (++i < l) typeof data[i] === 'string' &&
					(($ = document.createElement('link')).rel = 'stylesheet', $.href = data[i], this.shadowRoot.prepend($));
				
			}
			
		}
		
	}
	connectedCallback() {
		
		this.dispatchEvent(new CustomEvent('connected'));
		
	}
	disconnectedCallback() {
		
		this.dispatchEvent(new CustomEvent('disconnected'));
		
	}
	
	static shadowRootInit = { mode: 'open' };
	static tagName = 'custom-element';
	static uid = () => 'ce-' + uid4();
	static parseDatasetValue = (element, name) => {
		
		let v;
		
		try { v = JSON.parse(element.dataset[name]); } catch (error) { v = element.dataset[name]; }
		
		return Array.isArray(v) ? v : v === undefined ? [] : [ v ];
		
	}
	static addDatasetValue = (element, name, value) => {
		
		const	values = this.parseDatasetValue(element, name),
				i = values.indexOf(value);
		
		i === -1 && (values[values.length] = value, element.dataset[name] = JSON.stringify(values));
		
	}
	static removeDatasetValue = (element, name, value) => {
		
		const	values = this.parseDatasetValue(element, name),
				i = values.indexOf(value);
		
		i === -1 || (values.splice(i, 1), element.dataset[name] = JSON.stringify(values));
		
	}
	static removeClassNameByRegExp = (regexp, ...elements) => {
		
		const l = elements.length;
		let i,i0,l0, $;
		
		i = -1;
		while (++i < l) {
			if (!(($ = elements[i]) && typeof $ === 'object' && $.classList instanceof DOMTokenList)) continue;
			i0 = -1, l0 = $.classList.length;
			while (++i0 < l0) regexp.test($.classList[i0]) && ($.classList.remove($.classList[i0--]), --l0);
		}
		
	}
	
}