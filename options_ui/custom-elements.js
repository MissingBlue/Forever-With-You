class CustomElement extends HTMLElement {
	
	constructor() {
		
		super();
		
		const CNST = this.constructor;
		
		let i,i0,l, $, data;
		
		this._CE_listeners = [],
		this._CE_observers = new Map(),
		
		this.bind(CNST.bind),
		
		'tagName' in CNST && typeof CNST.tagName === 'string' &&
			(this.template = document.getElementById(CNST.tagName)) && this.template.tagName === 'TEMPLATE' &&
			(this.shadow = this.template.content.cloneNode(true), this.attachShadow(CNST.shadowRootInit).appendChild(this.shadow)),
		(this.root = this.shadowRoot ? this.shadowRoot.firstElementChild : this).classList.add(CNST.tagName);
		
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
	bind(source, name, ...args) {
		
		let i,l,k;
		
		switch (typeof source) {
			
			case 'function':
			this[(!source.name || source.name === 'anonymous') ?  name || 'anonymous' : source.name] =
				source.bind(this, ...args);
			return;
			
			case 'object':
			if (Array.isArray(source)) {
				i = -1, l = source.length;
				while (++i < l)	Array.isArray(source[i]) ?	this.bind.apply(this, source[i]) :
																			this.bind(source[i], `${(name || 'anonymous') + i}`, ...args);
			} else if (source) for (k in source) this.bind(source[k], k, ...args);
			return;
			
		}
		
	}
	connectedCallback() {
		
		this.dispatchEvent(new CustomEvent('connected'));
		
	}
	disconnectedCallback() {
		
		this.dispatchEvent(new CustomEvent('disconnected'));
		
	}
	destroy(keepsElement = false) {
		
		keepsElement || this.parentElement && this.remove(),
		this.clearEvents(),
		this.clearMutationObserver(),
		this.dispatchEvent(new CustomEvent(`${this.constructor.tagName}-destroy`));
		
	}
	
	addEvent(node = this, type, handler, useCapture = false) {
		
		this._CE_listeners[this._CE_listeners.length] = [ node, type, handler, useCapture ],
		node.addEventListener(type, handler, useCapture);
		
	}
	removeEvent(node = this, type, handler, useCapture = false) {
		
		let i, $;
		
		i = -1;
		while (($ = this._CE_listeners[++i]) && !($[0] === node && $[1] === type && $[2] === handler && $[3] === useCapture));
		if (!$) return;
		node.removeEventListener($[1], $[2], $[3]), this._CE_listeners.splice(i,1);
		
	}
	clearEvents() {
		
		let i, $;
		
		i = -1;
		while ($ = this._CE_listeners[++i]) $[0].removeEventListener($[1],$[2],$[3]);
		this._CE_listeners.length = 0;
		
	}
	dispatch(name, detail = {}) {
		
		Object.prototype.toString.call(detail) === '[object Object]' && (detail.target = this);
		
		if (this.id) {
			
			const listeners = QQ(`[data-for~="${this.id}"]`);
			
			let i,l,l0;
			
			i = -1, l = listeners.length;
			while (++i < l) listeners[i].dispatchEvent(new CustomEvent(name, { detail: { on: this, more: detail } }));
			
		}
		
		this.dispatchEvent(new CustomEvent(name, { detail }));
		
	}
	
	observeMutation(callback, node, init) {
		
		let observer;
		
		(observer = this._CE_observers.get(callback)) ||
			(this._CE_observers.set(callback, observer = new MutationObserver(callback))),
		observer.observe(node, init);
		
	}
	disconnectMutationObserver(callback) {
		
		let observer;
		
		(observer = this._CE_observers.get(callback)) && observer.disconnect();
		
	}
	clearMutationObserver() {
		
		let observer;
		
		const ovservers = this._CE_observers.values();
		for (observer of ovservers) observer.disconnect();
		
		this._CE_observers.clear();
		
	}
	
	q(selector) {
		return this.shadowRoot.querySelector(selector);
	}
	qq(selector) {
		return this.shadowRoot.querySelectorAll(selector);
	}
	isAncestor(element) {
		
		while (element !== this && (element = element.parentElement));
		
		return !!element;
		
	}
	
}
CustomElement.shadowRootInit = { mode: 'open' },
CustomElement.uid = () => 'ce-' + uid4(),
CustomElement.parseDatasetValue = (element, name) => {
	
	let v;
	
	try { v = JSON.parse(element.dataset[name]); } catch (error) { v = element.dataset[name]; }
	
	return Array.isArray(v) ? v : [ v ];
	
};

// 要素 .grip をドラッグすることで属性 data-swap-group に共通の値を持つ要素間の入れ替えを行う。
// ドラッグ中は、カーソルに相当する要素が <body> に追加される。
// また、入れ替え処理中に、入れ替え先に、入れ替える場所を記録するための要素が暗黙的に挿入される。
// このように、入れ替え操作に際し、暗黙的な要素の挿入、削除、クラス名を含む属性の書き換えが頻繁に行われるため、
// 対象となる要素の状態を MutationObserver などで監視している場合は、意図しないコールバックが発生しないように注意が必要。
// ドラッグ中のカーソルの表示方法に Mozzila の独自実装機能をいくつか用いている。
// ただし、表示方法を問わなければ Chromium 系でも動作そのものは可能と思われる。
// なお、親子間での要素の入れ替えには非対応。
// 要素間の親子関係の検出処理は実装されているが、動作は未検証。仮に入れ替えが行われてしまった場合、エラーが生じると思われる。
// この要素に対応する css は、swappable-node.css に記述している。対象となるクラスは以下で、
// .swap-cursor がドラッグ中に表示される入れ替え要素のカーソル要素を示すクラス名、
// .swap-hint は、入れ替え元の要素が、入れ替え先の要素に重なった時に（厳密に言えばカーソルが重なった時に）、クラス .swappable が追加される要素、
// .dragging-swap-grip は、ドラッグ中の入れ替え元の要素に与えられるクラス名。
// swappable-node.css の仕様は任意だが、汎用的な宣言が多いため、共有および書き換えての使用が推奨される。
// 特に pointer-events: none; は処理が存在を前提としているため、宣言がないと正常に動作しない可能性が高い。
// 入れ替えが発生した際にはイベント swapped が通知される。detail には入れ替え元要素を示す source、入れ替え先要素を示す target が指定される。
class SwappableNode extends CustomElement {
	
	constructor() {
		
		super();
		
		const grips = this.qq('.grip');
		let i;
		
		this.bind(SwappableNode.bind),
		
		this._SN_ = document.createElement('div'),
		this._SN_.classList.add('swap-cursor'),
		this._SN_.style.setProperty('--element', `-moz-element(#${SwappableNode.grippedBackgrounElement})`),
		
		i = -1;
		while (grips[++i]) this.addEvent(grips[i], 'mousedown', this.pressedGrip);
		
	}
	switchSwapHintNodes(method, ...args) {
		
		const swapHintNodes = this.qq('.swap-hint');
		let i;
		
		i = -1, method = method ? method : 'toggle';
		while (swapHintNodes[++i]) swapHintNodes[i].classList[method](...args);
		
	}
	
}
SwappableNode.tagName = 'swappable-node',
SwappableNode.grippedBackgrounElement = 'dragging-swap-grip',
SwappableNode.bind = {
	
	pressedGrip(event) {
		
		const	rect = this.getBoundingClientRect(),
				swapGroup = QQ(`[data-swap-group="${this.dataset.swapGroup}"]`);
		let i;
		
		this._SN_.style.setProperty('--width', `${rect.width}px`),
		this._SN_.style.setProperty('--height', `${rect.height}px`),
		this._SN_.style.setProperty('--left', `${rect.left}px`),
		this._SN_.style.setProperty('--top', `${rect.top}px`),
		
		// https://developer.mozilla.org/en-US/docs/Web/CSS/element()
		// https://developer.mozilla.org/en-US/docs/Web/API/Document/mozSetImageElement
		// css の -moz-element()(element()) に直接指定する場合、カスタム要素の shadowRoot 以下の要素の表示は反映されない。
		// そのためここでは Mozilla 系ブラウザーの独自実装である mozSetImageElement を利用している。
		document.mozSetImageElement(SwappableNode.grippedBackgrounElement, this.node),
		
		document.body.appendChild(this._SN_),
		
		this.draggedX = event.offsetX,
		this.draggedY = event.offsetY,
		
		this.classList.add('dragging-swap-grip'),
		this.removeEvent(this.draggedGrip = event.target, 'mousedown', this.pressedGrip),
		addEventListener('mouseup', this.releasedGrip),
		addEventListener('mousemove', this.draggedSwapGrip),
		addEventListener('mouseup', this.releasedGrip),
		
		i = -1;
		while (swapGroup[++i]) swapGroup[i] === this || (
				swapGroup[i].addEvent(swapGroup[i], 'mouseover', swapGroup[i].hovered),
				swapGroup[i].addEvent(swapGroup[i], 'mouseout', swapGroup[i].outed)
			);
		
	},
	hovered(event) {
		
		const source = Q('.dragging-swap-grip');
		
		this.isAncestor(source) || this.contains(source) ||
			(this.classList.add('swappable'), this.switchSwapHintNodes('add', 'swappable'));
	},
	outed(event) {
		this.classList.remove('swappable'), this.switchSwapHintNodes('remove', 'swappable');
	},
	draggedSwapGrip(event) {
		
		this._SN_.style.setProperty('--left', `${event.clientX - this.draggedX}px`),
		this._SN_.style.setProperty('--top', `${event.clientY - this.draggedY}px`);
		
	},
	releasedGrip(event) {
		
		const	swapGroup = QQ(`[data-swap-group="${this.dataset.swapGroup}"]`),
				target = Q(`.swappable[data-swap-group="${this.dataset.swapGroup}"]`),
				dstSister = target && target.nextSibling !== this && target.nextSibling,
				dstParent = target && target.parentElement,
				positionViaSelf = target && target.compareDocumentPosition(this);
		let i;
		
		this.classList.remove('dragging-swap-grip'),
		
		document.body.removeChild(this._SN_),
		
		removeEventListener('mousemove', this.draggedSwapGrip),
		removeEventListener('mouseup', this.releasedGrip),
		this.addEvent(this.draggedGrip, 'mousedown', this.pressedGrip),
		
		i = -1;
		while (swapGroup[++i]) swapGroup[i] === this || (
				swapGroup[i].removeEvent(swapGroup[i], 'mouseover', swapGroup[i].hovered),
				swapGroup[i].removeEvent(swapGroup[i], 'mouseout', swapGroup[i].outed),
				swapGroup[i].classList.remove('swappable'),
				swapGroup[i].switchSwapHintNodes('remove', 'swappable')
			);
		
		target && !this.isAncestor(target) && !this.contains(target) && (
			this.replaceWith(target),
			dstSister ? dstParent.insertBefore(this, dstSister) :
				dstSister === false ? dstParent.insertBefore(this, target) :
				dstParent[positionViaSelf & Node.DOCUMENT_POSITION_FOLLOWING ? 'prepend' : 'appendChild'](this),
			this.dispatchEvent(new CustomEvent('swapped', { detail: { source: this, target } }))
		);
		
	}
	
};

class InputNode extends SwappableNode {
	
	constructor() {
		
		super(),
		
		this.node = Q('#node', this.shadowRoot),
		
		this.addEvent(this.del = Q('#del', this.shadowRoot), 'click', this.pressedDelButton);
		
	}
	set(type, value) {
		
		if (!(type in InputNode.dictionary)) return;
		
		(this[type] = Q(`input-part[slot="${type}"]`, this)) ||
			(
				(this[type] = document.createElement('input-part')).slot = type,
				this[type].dataset.name = InputNode.dictionary[type].name,
				this[type].addEvent(this[type], 'change', this[InputNode.dictionary[type].handlerName.change]),
				this.appendChild(this[type])
			),
		this[type].value = value;
		
	}
	destroyNode() {
		
		this.destroy(), this.name.destroy(), this.value.destroy();
		
	}
	appendNodeTo(node) {
		
		return this.node.appendChild(node);
		
	}
	appendTo() {
		
		this.node.append.apply(this.container, arguments);
		
	}
	
}
InputNode.tagName = 'input-node',
InputNode.dictionary = {
	name: { name: 'Description', handlerName: { change: 'changedNameInputNode' } },
	value: { name: 'Extension ID', handlerName: { change: 'changedValueInputNode' } }
},
InputNode.changeEventInit = { bubbles: true, composed: true },
InputNode.bind = {
	changedNameInputNode(event) {
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: 'name', event } })),
		this.dispatchEvent(new CustomEvent('changed-name', { detail: this.name.value, ...InputNode.changeEventInit }));
	},
	changedValueInputNode(event) {
		this.dispatchEvent(new Event(event.type, InputNode.changeEventInit)),
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: 'id', event } })),
		this.dispatchEvent(new CustomEvent('changed-value', { detail: this.value.value, ...InputNode.changeEventInit }));
	},
	pressedDelButton(event) {
		this.dispatchEvent(new CustomEvent('pressed-del-button', { detail: this }));
	}
};

class InputPart extends CustomElement {
	
	constructor() {
		
		super(),
		
		this.label = this.q('label'),
		this.addEvent(this.input = this.q('input'), 'change', this.changed);
		
	}
	connectedCallback() {
		
		'name' in this.dataset && (this.name = this.dataset.name),
		'value' in this.dataset && (this.value = this.dataset.value);
		
	}
	static get observedAttributes() { return [ 'data-name', 'data-value' ]; }
	attributeChangedCallback(name, last, current) {
		
		this[name.split('-')[1]] = current;
		
	}
	
	get name() { return this.label.textContent; }
	get value() { return this.input.value; }
	
	set name(v) { this.label.textContent = v; }
	set value(v) { this.input.value = v; }
	
}
InputPart.tagName = 'input-part',
InputPart.changeEventInit = { bubbles: true, composed: true },
InputPart.bind = {
	changed(event) {
		this.dispatchEvent(new Event('change', InputPart.changeEventInit));
	}
};


const customElementConstructors = [ InputNode, InputPart ];

let i, $;

i = -1;
while ($ = customElementConstructors[++i]) customElements.define($.tagName, $);