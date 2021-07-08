// このカスタム要素には utils.js が必須。

// https://developer.mozilla.org/ja/docs/Web/API/DragEvent
// 現在 MouseEvent を使ってドラッグアンドドロップ動作を擬似的に表現しているが、
// 上記の DragEvent に置き換えるべき。
// ただ、実際に置き換えたところ、イベントリスナーに指定したハンドラーが指定のイベントが通知されるべき状況で実行されない。
// 恐らく何か手違いがあったかと思われるが原因不明。
// このカスタム要素に対してではない、一般的な要素に対しての DragEvent が機能するのは確認済み。
class DraggableNode extends CustomElement {
	
	constructor(option) {
		
		super(option);
		
		let i,k;
		
		this.DN = this.constructor.DN && typeof this.constructor.DN === 'object' ?
			{ ...DraggableNode.DN, ...this.constructor.DN } : { ...DraggableNode.DN };
		
		const grips = this.querySelectorWhole(this.DN.QQ_GRIP);
		
		this.bind(DraggableNode.bound),
		
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
DraggableNode.createEvent = (type, detail) => new CustomEvent(type, { detail, composed: true, bubbles: true }),
DraggableNode.bound = {
	
	pressedGrip(event) {
		
		const	rect = this.getBoundingClientRect();
		let rootNode;
		
		this.removeEvent(this.draggedGrip = event.target, 'mousedown', this.pressedGrip),
		this.classList.add(this.DN.CN_DRAGGING_GRIP),
		
		(rootNode = (rootNode = this.getRootNode()) === document ? window : rootNode).
			addEventListener('mouseup', this.releasedGrip),
		rootNode.addEventListener('mousemove', this.dragging),
		rootNode.addEventListener('mouseover', this.draggedTo),
		rootNode.addEventListener('mouseout', this.draggedOut),
		
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
		
		event.preventDefault(),
		
		this.dispatchEvent(new CustomEvent('drag', { detail: event }));
		
	},
	draggedTo(event) {
		
		(this.draggedIn = event.target).dispatchEvent(DraggableNode.createEvent('dragged-to', this)),
		this.dispatchEvent(DraggableNode.createEvent('drag-to', event.target));
		
	},
	draggedOut(event) {
		
		event.target.dispatchEvent(DraggableNode.createEvent('dragged-out', this)),
		this.dispatchEvent(DraggableNode.createEvent('drag-out', event.target));
		
	},
	dragging(event) {
		
		event.preventDefault(),
		
		this.cursor.style.setProperty('--left', `${event.clientX - this.draggedX}px`),
		this.cursor.style.setProperty('--top', `${event.clientY - this.draggedY}px`);
		
	},
	releasedGrip(event) {
		
		let rootNode;
		
		document.body.removeChild(this.cursor),
		
		this.addEvent(this.draggedGrip, 'mousedown', this.pressedGrip),
		this.classList.remove(this.DN.CN_DRAGGING_GRIP),
		
		(rootNode = (rootNode = this.getRootNode()) === document ? window : rootNode)
			.removeEventListener('mouseup', this.releasedGrip),
		rootNode.removeEventListener('mousemove', this.dragging),
		rootNode.removeEventListener('mouseover', this.draggedTo),
		rootNode.removeEventListener('mouseout', this.draggedOut),
		
		this.draggedIn && (
			this.dispatchEvent(DraggableNode.createEvent('drag-in', { dst: this.draggedIn, mouse: event })),
			this.draggedIn.dispatchEvent(DraggableNode.createEvent('dragged-in', { src: this, mouse: event })),
			this.draggedIn = null
		);
		
	}
	
};

class DraggableTarget extends DraggableNode {
	
	constructor(option) {
		
		super(option);
		
		let i;
		
		this.DN = { ...DraggableTarget.DN, ...this.DN },
		
		this.bind(DraggableTarget.bound),
		
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
			src.dispatchEvent(DraggableNode.createEvent(isTo = isTo ?'drag-to-target' : 'dragged-out-target', this)),
			this.dispatchEvent(DraggableNode.createEvent(isTo, src))
		);
		
	}
	
}
DraggableTarget.tagName = 'draggable-target',
DraggableTarget.DN = {
	QQ_HINT: '.drag-hint',
	CN_DRAGGED_ON: 'dragged-on'
},
DraggableTarget.bound = {
	
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
			this.dispatchEvent(DraggableNode.createEvent('dragged-out-target', { dst: this, src: event.detail }));
		
	},
	draggingAboveTarget(event) {
		
		this.dispatchEvent(DraggableNode.createEvent('dragging-above-target', { src: this, dst: this.draggedIn, mouse: event })),
		this.draggedIn.dispatchEvent(DraggableNode.createEvent('dragged-above', { src: this, dst: this.draggedIn, mouse: event }));
		
	},
	draggedInTarget(event) {
		
		event.detail.src.removeEvent(this, 'mousemove', event.detail.src.draggingAboveTarget),
		
		this.switchHintNodes('remove', this.DN.CN_DRAGGED_ON);
		
	}
	
};

// DraggableTarget を継承しているが、このオブジェクトは（イベント以外は）継承元の処理に依存しないため、任意のオブジェクトを継承することが可能。
// dispHitRect を実行した上で、その第一引数に与えた要素のクラスに disp-hit を指定すると、当たり判定の（目安となる）領域が表示される。
class HittableNode extends DraggableTarget {
	
	constructor(option) {
		
		super(option),
		
		this.bind(HittableNode.bound),
		
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
HittableNode.bound = {
	
	draggedInHitRect(event) {
		
		this.pointerRect.left = event.detail.mouse.pageX,
		this.pointerRect.top = event.detail.mouse.pageY;
		
		const results = this.hitTest();
		
		results.length && this.dispatchEvent(DraggableNode.createEvent('hit-rect', { results, src: event.detail.src, dragInfo: event.detail }));
		
	},
	draggedAboveHitRect(event) {
		
		let i;
		
		this.pointerRect.left = event.detail.mouse.pageX,
		this.pointerRect.top = event.detail.mouse.pageY;
		
		(event.detail.results = this.hitTest()).length &&
			this.dispatchEvent(DraggableNode.createEvent('above-hit-rect', event.detail));
		
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