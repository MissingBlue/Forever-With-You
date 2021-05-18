class CustomElement extends HTMLElement {
	
	constructor() {
		
		super();
		
		const CNST = this.constructor;
		
		let $;
		
		this._CE_listeners = [],
		this._CE_observers = new Map(),
		
		this.bind(CNST.bind),
		
		'tagName' in CNST && typeof CNST.tagName === 'string' &&
			(this.template = document.getElementById(CNST.tagName)) && this.template.tagName === 'TEMPLATE' &&
			(this.shadow = this.template.content.cloneNode(true), this.attachShadow(CNST.shadowRootInit).appendChild(this.shadow)),
		(this.root = this.shadowRoot ? this.shadowRoot.firstElementChild : this).classList.add(CNST.tagName),
		
		this.template && this.template.dataset.css &&
			(
				($ = document.createElement('link')).rel = 'stylesheet',
				$.href = this.template.dataset.css,
				this.shadowRoot.prepend($)
			);
		
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
		
		this._CE_listeners[this._CE_listeners.length] = arguments,
		node.addEventListener(type, handler, useCapture);
		
	}
	removeEvent(node = this, type, handler, useCapture = false) {
		
		let i, $;
		
		i = -1;
		while (($ = this._CE_listeners[++i]) && $[0] !== node && $[1] !== type && $[2] !== handler && $[3] !== useCapture);
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
	
}
CustomElement.shadowRootInit = { mode: 'open' },
CustomElement.uid = () => 'ce-' + uid4();

class SwappableNode extends CustomElement {
	
	constructor() {
		
		super(),
		
		this.bind(SwappableNode.bind),
		
		this._SN_ = document.createElement('div'),
		this._SN_.style.background = `no-repeat left top/contain -moz-element(#swapping-bg)`,
		this._SN_.style.position = 'absolute',
		this._SN_.style.opacity = 0.5,
		this._SN_.style.zIndex = 2147483647,
		//https://developer.mozilla.org/ja/docs/Web/CSS/pointer-events
		this._SN_.style.pointerEvents = 'none',
		
		this._SN_dummy = document.createElement('div'),
		
		this.addEvent(this.grip = Q('#grip', this.shadowRoot), 'mousedown', this.pressedGrip);
		
	}
	switchSwapHintNodes(method, ...args) {
		
		const swapHintNodes = this.qq('.swap-hint');
		let i;
		
		i = -1, method = method ? method : 'toggle';
		while (swapHintNodes[++i]) swapHintNodes[i].classList[method](...args);
		
	}
	
}
SwappableNode.tagName = 'swappable-node',
SwappableNode.bind = {
	
	pressedGrip(event) {
		
		const	rect = this.getBoundingClientRect(),
				swapGroup = QQ(`[data-swap-group="${this.dataset.swapGroup}"]`);
		let i;
		
		this._SN_.style.width = `${rect.width}px`,
		this._SN_.style.height = `${rect.height}px`,
		this._SN_.style.left = `${rect.left}px`,
		this._SN_.style.top = `${rect.top}px`,
		
		// https://developer.mozilla.org/en-US/docs/Web/CSS/element()
		// https://developer.mozilla.org/en-US/docs/Web/API/Document/mozSetImageElement
		// css の -moz-element()(element()) に直接指定する場合、カスタム要素の shadowRoot 以下の要素の表示は反映されない。
		// そのためここでは Mozilla 系ブラウザーの独自実装である mozSetImageElement を利用している。
		document.mozSetImageElement('swapping-bg', this.node),
		
		document.body.appendChild(this._SN_),
		
		this.draggedX = event.offsetX,
		this.draggedY = event.offsetY,
		
		this.classList.add('swapping'),
		this.removeEvent(this.grip, 'mousedown', this.pressedGrip),
		addEventListener('mouseup', this.releasedGrip),
		addEventListener('mousemove', this.draggedGrip),
		addEventListener('mouseup', this.releasedGrip),
		
		i = -1;
		while (swapGroup[++i]) swapGroup[i] === this || (
				swapGroup[i].addEvent(swapGroup[i], 'mouseover', swapGroup[i].hovered),
				swapGroup[i].addEvent(swapGroup[i], 'mouseout', swapGroup[i].outed)
			);
		
	},
	hovered(event) {
		this.classList.add('swappable'), this.switchSwapHintNodes('add', 'swappable');
	},
	outed(event) {
		this.classList.remove('swappable'), this.switchSwapHintNodes('remove', 'swappable');
	},
	draggedGrip(event) {
		
		this._SN_.style.left = `${event.clientX - this.draggedX}px`,
		this._SN_.style.top = `${event.clientY - this.draggedY}px`;
		
	},
	releasedGrip(event) {
		
		const	swapGroup = QQ(`[data-swap-group="${this.dataset.swapGroup}"]`),
				swapper = Q(`.swappable[data-swap-group="${this.dataset.swapGroup}"]`);
		let i;
		
		this.classList.remove('swapping'),
		
		document.body.removeChild(this._SN_),
		
		removeEventListener('mousemove', this.draggedGrip),
		removeEventListener('mouseup', this.releasedGrip),
		this.addEvent(this.grip, 'mousedown', this.pressedGrip),
		
		i = -1;
		while (swapGroup[++i]) swapGroup[i] === this || (
				swapGroup[i].removeEvent(swapGroup[i], 'mouseover', swapGroup[i].hovered),
				swapGroup[i].removeEvent(swapGroup[i], 'mouseout', swapGroup[i].outed),
				swapGroup[i].classList.remove('swappable'),
				swapGroup[i].switchSwapHintNodes('remove', 'swappable')
			);
		
		swapper.parentElement.replaceChild(this._SN_dummy, swapper),
		this.parentElement.replaceChild(swapper, this),
		this._SN_dummy.parentElement.replaceChild(this, this._SN_dummy);
		
	}
	
};


class InputNode extends SwappableNode {
	
	constructor() {
		
		super(),
		
		this.node = Q('#node', this.shadowRoot),
		// ネイティブのイベントには、Shadow Root の外へ伝播しないものがある。それらは event.composed の値で判別できる。
		this.addEvent(this.name = Q('#name', this.shadowRoot), 'change', this.changedInputNode),
		this.addEvent(this.extid = Q('#id', this.shadowRoot), 'change', this.changedInputNode),
		
		this.addEvent(this.del = Q('#del', this.shadowRoot), 'click', this.pressedDelButton);
		
	}
	appendNodeTo(node) {
		
		return this.node.appendChild(node);
		
	}
	appendTo() {
		
		this.node.append.apply(this.container, arguments);
		
	}
	
}
InputNode.tagName = 'input-node',
InputNode.bind = {
	changedInputNode(event) {
		this.dispatchEvent(new Event(event.type));
	},
	pressedDelButton(event) {
		this.dispatch('pressed-del-button', event.target);
	}
};


const customElementConstructors = [ InputNode ];

let i, $;

i = -1;
while ($ = customElementConstructors[++i]) customElements.define($.tagName, $);