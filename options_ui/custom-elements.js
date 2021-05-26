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
	
}
CustomElement.shadowRootInit = { mode: 'open' },
CustomElement.uid = () => 'ce-' + uid4(),
CustomElement.parseDatasetValue = (element, name) => {
	
	let v;
	
	try { v = JSON.parse(element.dataset[name]); } catch (error) { v = element.dataset[name]; }
	
	return Array.isArray(v) ? v : [ v ];
	
},
CustomElement.removeClassNameByRegExp = (regexp, ...elements) => {
	
	const l = elements.length;
	let i,i0,l0, $;
	
	i = -1;
	while (++i < l) {
		if (!(($ = elements[i]) && typeof $ === 'object' && $.classList instanceof DOMTokenList)) continue;
		i0 = -1, l0 = $.classList.length;
		while (++i0 < l0) regexp.test($.classList[i0]) && ($.classList.remove($.classList[i0--]), --l0);
	}
	
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
//
// 実用上、この拡張機能ではこのオブジェクトは未使用。
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

class DraggableNode extends CustomElement {
	
	constructor() {
		
		super();
		
		let i,k;
		
		this.DN = this.constructor.DN && typeof this.constructor.DN === 'object' ?
			{ ...DraggableNode.DN, ...this.constructor.DN } : { ...DraggableNode.DN };
		
		const grips = this.querySelectorWhole(this.DN.QQ_GRIP);
		
		this.bind(DraggableNode.bind),
		
		this.cursor = document.createElement('div'),
		this.cursor.classList.add(this.DN.CN_CURSOR),
		this.cursor.style.setProperty('--element', `-moz-element(#${this.DN.$_GRIP_BACKGROUND_ELEMENT})`),
		
		i = -1;
		while (grips[++i]) this.addEvent(grips[i], 'mousedown', this.pressedGrip);
		
	}
	
}
DraggableNode.tagName = 'draggable-node',
DraggableNode.DN = {
	QQ_GRIP: '.drag-grip',
	CN_CURSOR: 'drag-cursor',
	CN_DRAGGING_GRIP: 'dragging-grip',
	$_GRIP_BACKGROUND_ELEMENT : 'dragging-drag-grip',
},
DraggableNode.bind = {
	
	pressedGrip(event) {
		
		event.preventDefault();
		
		const rect = this.getBoundingClientRect();
		let i;
		
		this.removeEvent(this.draggedGrip = event.target, 'mousedown', this.pressedGrip),
		this.classList.add(this.DN.CN_DRAGGING_GRIP),
		
		addEventListener('mouseup', this.releasedGrip),
		addEventListener('mousemove', this.dragging),
		addEventListener('mouseover', this.draggedTo),
		addEventListener('mouseout', this.draggedOut),
		
		this.draggedX = event.offsetX,
		this.draggedY = event.offsetY,
		
		this.cursor.style.setProperty('--width', `${rect.width}px`),
		this.cursor.style.setProperty('--height', `${rect.height}px`),
		this.cursor.style.setProperty('--left', `${rect.left}px`),
		this.cursor.style.setProperty('--top', `${rect.top}px`),
		// https://developer.mozilla.org/en-US/docs/Web/CSS/element()
		// https://developer.mozilla.org/en-US/docs/Web/API/Document/mozSetImageElement
		// css の -moz-element()(element()) に直接指定する場合、カスタム要素の shadowRoot 以下の要素の表示は反映されない。
		// そのためここでは Mozilla 系ブラウザーの独自実装である mozSetImageElement を利用している。
		document.mozSetImageElement(this.DN.$_GRIP_BACKGROUND_ELEMENT, this.node),
		
		document.body.appendChild(this.cursor),
		
		this.dispatchEvent(new CustomEvent('drag', { detail: event }));
		
	},
	draggedTo(event) {
		
		(this.draggedIn = event.target).dispatchEvent(new CustomEvent('dragged-to', { detail: this })),
		this.dispatchEvent(new CustomEvent('drag-to', { detail: event.target }));
		
	},
	draggedOut(event) {
		
		event.target.dispatchEvent(new CustomEvent('dragged-out', { detail: this })),
		this.dispatchEvent(new CustomEvent('drag-out', { detail: event.target }));
		
	},
	dragging(event) {
		
		event.preventDefault(),
		
		this.cursor.style.setProperty('--left', `${event.clientX - this.draggedX}px`),
		this.cursor.style.setProperty('--top', `${event.clientY - this.draggedY}px`);
		
	},
	releasedGrip(event) {
		
		let i;
		
		document.body.removeChild(this.cursor),
		
		this.addEvent(this.draggedGrip, 'mousedown', this.pressedGrip),
		this.classList.remove(this.DN.CN_DRAGGING_GRIP),
		
		removeEventListener('mouseup', this.releasedGrip),
		removeEventListener('mousemove', this.dragging),
		removeEventListener('mouseover', this.draggedTo),
		removeEventListener('mouseout', this.draggedOut),
		
		this.draggedIn && (
			this.dispatchEvent(new CustomEvent('drag-in', { detail: { dst: this.draggedIn, mouse: event }, composed: true, bubbles: true })),
			this.draggedIn.dispatchEvent(new CustomEvent('dragged-in', { detail: { src: this, mouse: event }, composed: true, bubbles: true })),
			this.draggedIn = null
		);
		
	}
	
};

class DraggableTarget extends DraggableNode {
	
	constructor() {
		
		super();
		
		let i;
		
		this.DN = { ...DraggableTarget.DN, ...this.DN },
		
		this.bind(DraggableTarget.bind),
		
		this.addEvent(this, 'dragged-to', this.draggedToTarget),
		this.addEvent(this, 'dragged-out', this.draggedOutTarget),
		this.addEvent(this, 'dragged-in', this.draggedInTarget);
		
	}
	switchHintNodes(method, ...args) {
		
		const hintNodes = this.querySelectorWhole(this.DN.QQ_HINT);
		let i;
		
		i = -1, method = method ? method : 'toggle';
		while (hintNodes[++i]) hintNodes[i].classList[method](...args);
		
		this.classList[method](...args);
		
	}
	draggedStateChange(isTo, src) {
		
		src.dataset[this.DN.DS_GROUP] === this.dataset[this.DN.DS_GROUP] && !this.isLineage(src) && (
			this.switchHintNodes(isTo ? 'add' : 'remove', this.DN.CN_DRAGGED_ON),
			src.dispatchEvent(new CustomEvent(isTo = isTo ?'drag-to-target' : 'dragged-out-target', { detail: this, composed: true })),
			this.dispatchEvent(new CustomEvent(isTo, { detail: src, composed: true, bubbles: true }))
		);
		
	}
	
}
DraggableTarget.tagName = 'draggable-target',
DraggableTarget.DN = {
	QQ_HINT: '.drag-hint',
	CN_DRAGGED_ON: 'dragged-on'
},
DraggableTarget.bind = {
	
	draggedToTarget(event) {
		
		event.detail === this || (
				event.detail.addEvent(this, 'mousemove', event.detail.draggingAboveTarget),
				this.draggedStateChange(true, event.detail)
			);
		
	},
	draggedOutTarget(event) {
		
		event.detail.removeEvent(this, 'mousemove', event.detail.draggingAboveTarget),
		
		this.classList.contains(this.DN.CN_DRAGGED_ON) && this.draggedStateChange(true, event.detail),
		
		event.detail === this ||
			this.dispatchEvent(new CustomEvent('dragged-out-target', { detail: { dst: this, src: event.detail }, bubbles: true, composed: true }));
		
	},
	draggingAboveTarget(event) {
		
		this.dispatchEvent(new CustomEvent('dragging-above-target', { detail: { src: this, dst: this.draggedIn, mouse: event } })),
		this.draggedIn.dispatchEvent(new CustomEvent('dragged-above', { detail: { src: this, dst: this.draggedIn, mouse: event } }));
		
	},
	draggedInTarget(event) {
		
		event.detail.src.removeEvent(this, 'mousemove', event.detail.src.draggingAboveTarget),
		
		this.switchHintNodes('remove', this.DN.CN_DRAGGED_ON);
		
	}
	
};

// DraggableTarget を継承しているが、このオブジェクトは（イベント以外は）継承元の処理に依存しないため、任意のオブジェクトを継承することが可能。
// dispHitRect を実行した上で、その第一引数に与えた要素のクラスに disp-hit を指定すると、当たり判定の（目安となる）領域が表示される。
class HitableNode extends DraggableTarget {
	
	constructor() {
		
		super(),
		
		this.bind(HitableNode.bind),
		
		this.pointerRect = { width: 1, height: 1 },
		this.objects = [
			{ type: 'hit-top', x: 0, y: 0, w: 1, h: 0.5, name: 'top' },
			{ type: 'hit-right', x: 0.5, y: 0, w: 0.5, h: 1, name: 'right' },
			{ type: 'hit-bottom', x: 0, y: 0.5, w: 1, h: 0.5, name: 'bottom' },
			{ type: 'hit-left', x: 0, y: 0, w: 0.5, h: 1, name: 'left' },
			{ type: 'hit-center', x: 0, y: 0.25, w: 1, h: 0.5, name: 'center' }
		],
		
		(this.hitDisp = document.createElement('div')).classList.add('hit-disp-node'),
		this.hitDisp.setAttribute('hidden', ''),
		
		this.addEvent(this, 'dragged-in', this.draggedInHitRect),
		this.addEvent(this, 'dragged-above', this.draggedAboveHitRect),
		this.hitDispReiszeObserver = new ResizeObserver(this.resizedHitDisp);
		
	}
	calc(v, v0, ...args) {
		
		let i,l;
		
		i = -1, l = args.length, v = Array.isArray(v0) ? v * v0[0] + v0[1] : v * v0;
		while (++i < l) v += args[i];
		
		return v;
		
	}
	updateHitDisp(rect = this.getBoundingClientRect()) {
		
		let i,o, chip;
		
		while (this.hitDisp.firstChild) this.hitDisp.firstChild.remove();
		
		i = -1;
		while (o = this.objects[++i]) (
			(chip = document.createElement('div')).classList.add('hit-chip', `hit-${o.name}`),
			chip.style.setProperty('--left', `${this.calc(rect.width, o.x)}px`),
			chip.style.setProperty('--top', `${this.calc(rect.height, o.y)}px`),
			chip.style.setProperty('--width', `${this.calc(rect.width, o.w)}px`),
			chip.style.setProperty('--height', `${this.calc(rect.height, o.h)}px`),
			this.hitDisp.appendChild(chip)
		);
		
	}
	dispHitRect(source) {
		this.hitDispReiszeObserver.observe(source),
		this.updateHitDisp(),
		source.appendChild(this.hitDisp);
	}
	hitTest(rect = this.pointerRect) {
		
		const bound = this.getBoundingClientRect();
		let	i,o;
		
		i = -1;
		while (o = this.objects[++i]) (
				o.left = this.calc(bound.width, o.x, bound.left + scrollX),
				o.top = this.calc(bound.height, o.y, bound.top + scrollY),
				o.width = this.calc(bound.width, o.w),
				o.height = this.calc(bound.height, o.h)
			);
		
		return HitTest.testRectAll(rect, this.objects);
		
	}
	
}
HitableNode.bind = {
	
	draggedInHitRect(event) {
		
		this.pointerRect.left = event.detail.mouse.pageX,
		this.pointerRect.top = event.detail.mouse.pageY;
		
		const results = this.hitTest();
		
		results.length && this.dispatchEvent(new CustomEvent('hit-rect', { detail: { results, src: event.detail.src, dragInfo: event.detail }, composed: true, bubbles: true }));
		
	},
	draggedAboveHitRect(event) {
		
		let i;
		
		this.pointerRect.left = event.detail.mouse.pageX,
		this.pointerRect.top = event.detail.mouse.pageY;
		
		(event.detail.results = this.hitTest()).length &&
			this.dispatchEvent(new CustomEvent('above-hit-rect', { detail: event.detail, composed: true, bubbles: true }));
		
	},
	resizedHitDisp() {
		this.updateHitDisp();
	}
	
};

class HitTest {
	
	constructor() {}
	
}
HitTest.testRectAll = (rect, objects) => {
	
	if (!Array.isArray(objects)) return HitTest.test(rect, objects);
	
	const	results = [];
	let	i,l;
	
	i = -1, l = objects.length;
	while (++i < l) objects[i] && typeof objects[i] === 'object' && HitTest.testRect(rect, objects[i]) &&
		(results[results.length] = objects[i]);
	
	return results;
	
},
HitTest.testRect = (rect, object) => {
	
	return	(rect && object && typeof rect === 'object' && typeof object === 'object') ?
					HitTest.$(rect.left, rect.width, object.left, object.width) &&
					HitTest.$(rect.top, rect.height, object.top, object.height) :
					undefined;
	
},
HitTest.$ = (p,r, op,or) => {
	// p = position, r = range, op = objectPosition, or = objectRange
	// この式はフォルダー内の bound.js から引用。一次元の当たり判定を計算する式だが、大昔に作ったため、現在は解読未着手ないし不能。
	return isNaN((p = +p) + (r = +r) + (op = +op) + (or = +or)) ?
		NaN : Math.abs(p - op + (r - or) / 2) <= or + (r - or) / 2;
	
};

class InputNode extends HitableNode {
	
	constructor() {
		
		super(),
		
		this.node = Q('#node', this.shadowRoot),
		
		this.addEvent(this, 'hit-rect', this.draggedInInputNode),
		this.addEvent(this, 'above-hit-rect', this.draggedAboveInputNode),
		this.addEvent(this, 'dragged-out-target', this.draggedOutInputNode),
		this.addEvent(this.del = Q('#del', this.shadowRoot), 'click', this.pressedDelButton);
		
	}
	connectedCallback() {
		
		this.unuseNode || this.set('unuse', false, 'checkbox'),
		
		this.dispHitRect(this.root);
		
	}
	
	set(type, value, part = 'input') {
		
		if (!(type in InputNode.dictionary)) return;
		
		let node;
		
		(node = this[`${type}Node`] = Q(`input-part[slot="${type}"]`, this)) ||
			(
				(node = this[`${type}Node`] = document.createElement('input-part')).slot = type,
				node.dataset.name = InputNode.dictionary[type].name,
				node.type = part,
				node.addEvent(node, 'change', this[InputNode.dictionary[type].handlerName.change]),
				this.appendChild(node)
			),
		part === 'checkbox' ? (node.checked = value) : (node.value = value);
		
		return node;
		
	}
	destroyNode() {
		
		this.destroy(), this.descriptionNode.destroy(), this.valueNode.destroy();
		
	}
	appendNodeTo(node) {
		
		return this.node.appendChild(node);
		
	}
	appendTo() {
		
		this.node.append.apply(this.container, arguments);
		
	}
	removeFromClassList(regexp) {
		
		let i,l;
		
		i = -1, l = this.classList.length;
		while (++i < l) regexp.test(this.classList[i]) && this.classList.remove(this.classList[i]);
		
	}
	
	toJson() {
		
		return { name: this.description, value: this.extId, enable: this.unuse };
		
	}
	
	get description() { return this.descriptionNode && this.descriptionNode.value; }
	get dragGroup() { return this.dataset.dragGroup; }
	get extId() { return this.valueNode && this.valueNode.value; }
	get unuse() { return this.unuseNode && this.unuseNode.checked; }
	
	set description(v) { this.set('description', v); }
	set dragGroup(v) { this.dataset.dragGroup = v; }
	set extId(v) { this.set('value', v); }
	set unuse(v) { this.set('unuse', v); }
	
}
InputNode.tagName = 'input-node',
InputNode.dictionary = {
	description: { name: 'Description', handlerName: { change: 'changedNameInputNode' } },
	value: { name: 'Extension ID', handlerName: { change: 'changedValueInputNode' } },
	unuse: { name: 'Unuse', handlerName: { change: 'changedUnuseInputNode' } }
},
InputNode.changeEventInit = { bubbles: true, composed: true },
InputNode.draggedAboveRegExp = /^dragged-above-.*/,
InputNode.draggedInsertAreaRegExp = /^(top|bottom|none)$/,
InputNode.bind = {
	changedNameInputNode(event) {
		this.dispatchEvent(new Event(event.type, InputNode.changeEventInit)),
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: 'description', event } })),
		this.dispatchEvent(new CustomEvent('changed-description', { detail: this.description.value, ...InputNode.changeEventInit }));
	},
	changedValueInputNode(event) {
		this.dispatchEvent(new Event(event.type, InputNode.changeEventInit)),
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: 'id', event } })),
		this.dispatchEvent(new CustomEvent('changed-value', { detail: this.value.value, ...InputNode.changeEventInit }));
	},
	changedUnuseInputNode(event) {
		this.dispatchEvent(new Event(event.type, InputNode.changeEventInit)),
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: 'id', event } })),
		this.dispatchEvent(new CustomEvent('changed-unuse', { detail: this.unuseNode.value, ...InputNode.changeEventInit }));
	},
	pressedDelButton(event) {
		this.dispatchEvent(new CustomEvent('pressed-del-button', { detail: this }));
	},
	draggedInInputNode(event) {
		
		const insertArea = Q('.insert-area');
		
		switch (event.detail.results[0].name) {
			
			case 'top':
			this.previousSibling === event.detail.src || this.parentElement.insertBefore(event.detail.src, this);
			break;
			
			case 'bottom':
			this.nextSibling ?
				this.nextSibling === event.detail.src ||
					this.parentElement.insertBefore(event.detail.src, this.nextSibling) :
				this.parentElement.appendChild(event.detail.src);
			break;
			
		}
		
		insertArea && insertArea.remove(),
		CustomElement.removeClassNameByRegExp(InputNode.draggedAboveRegExp, this.node),
		
		this.dispatchEvent(new CustomEvent('index-changed', { ...InputNode.changeEventInit }));
		
	},
	draggedAboveInputNode(event) {
		
		let k, insertArea, rect;
		const value = `dragged-above-${(rect = event.detail.results[0]).name}`;
		
		if (this.node.classList.contains(value)) return;
		
		CustomElement.removeClassNameByRegExp(InputNode.draggedAboveRegExp, this.node),
		this.node.classList.add(value),
		
		(insertArea = Q('.insert-area') || document.createElement('div')).classList.add('insert-area');
		
		for (k in rect) typeof rect[k] === 'number' && insertArea.style.setProperty(`--${k}`, `${rect[k]}px`);
		
		CustomElement.removeClassNameByRegExp(InputNode.draggedInsertAreaRegExp, insertArea),
		insertArea.classList.add(event.detail.results[0].name),
		
		document.body.appendChild(insertArea);
		
	},
	draggedOutInputNode(event) {
		
		const insertArea = Q('.insert-area');
		
		insertArea && insertArea.classList.add('none'),
		CustomElement.removeClassNameByRegExp(InputNode.draggedAboveRegExp, this.node);
		
	}
};

class InputPart extends CustomElement {
	
	constructor() {
		
		super();
		
		const id = CustomElement.uid();
		
		this.addEvent(this.input = this.q('input'), 'change', this.changed),
		
		(this.label = this.q('label')).htmlFor = this.input.id = id;
		
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
	get type() { return this.input.type; }
	get checked() { return this.input.checked; }
	
	set name(v) { this.label.textContent = v; }
	set value(v) { this.input.value = v; }
	set type(v) {
		(this.dataset.type = this.root.dataset.type = this.input.type = v) === 'checkbox' ?
			this.addEvent(this.input, 'change', this.toggleCheckbox) :
			(this.removeEvent(this.input, 'change', this.toggleCheckbox), this.root.classList.remove('checked'));
	}
	set checked(v) {
		this.input.type === 'checkbox' && (this.input.checked = v);
	}
	
}
InputPart.tagName = 'input-part',
InputPart.changeEventInit = { bubbles: true, composed: true },
InputPart.bind = {
	changed(event) {
		this.dispatchEvent(new Event('change', InputPart.changeEventInit));
	},
	toggleCheckbox(event) {
		this.root.classList[this.input.checked ? 'add' : 'remove']('checked');
	}
};


const customElementConstructors = [ InputNode, InputPart ];

let i, $;

i = -1;
while ($ = customElementConstructors[++i]) customElements.define($.tagName, $);