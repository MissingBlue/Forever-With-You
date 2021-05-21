class ExtensionNode extends EventTarget {
	
	constructor(option = {}) {
		
		super(),
		
		this.option = (option && typeof option === 'object') ? option : {},
		
		this.setLogger(option.loggerPrefix);
		
	}
	
	setLogger(prefix) {
		
		this.log = console.log.bind(console, `[${prefix ? `${prefix}@` : ''}${this.constructor.LOGGER_SUFFIX}]`);
		
	}
	
}
ExtensionNode.LOGGER_SUFFIX = 'EN';

// このオブジェクトは不要ないし冗長に思われる。
class InputMan extends ExtensionNode {
	
	constructor() {
		
		super(),
		
		this.boundChanged = this.changed.bind(this),
		this.boundPressedDelButton = this.pressedDelButton.bind(this),
		
		(this.$ = document.createElement('input-node')).addEvent(this.$, 'changed', this.boundChanged),		
		this.$.addEvent(this.$, 'pressed-del-button', this.boundPressedDelButton);
		
	}
	pressedDelButton(event) {
		
		this.dispatchEvent(new CustomEvent('input-man-deletable', { detail: this }));
		
	}
	changed(event) {
		
		this.dispatchEvent(new CustomEvent('input-man-changed', { detail: event.detail }));
		
	}
	get() {
		
		return { name: this.name, value: this.extId };
		
	}
	
	get name() { return this.$.name && this.$.name.value; }
	get dragGroup() { return this.$.dataset.dragGroup; }
	get extId() { return this.$.value && this.$.value.value; }
	
	set name(v) { this.$.set('name', v); }
	set dragGroup(v) { this.$.dataset.dragGroup = v; }
	set extId(v) { this.$.set('value', v); }
	
}
InputMan.LOGGER_SUFFIX = 'IM';

class InputManMan extends ExtensionNode {
	
	constructor(node, option) {
		
		super(option),
		
		this.boundChanged = this.changed.bind(this),
		this.boundInputManDeletable = this.inputManDeletable.bind(this),
		
		this.data = [],
		
		this.setNode(node);
		
	}
	inputManDeletable(event) {
		
		this.remove(event.detail);
		
	}
	changed(event) {
		
		this.dispatchEvent(new CustomEvent('imm-changed', { detail: event.detail }));
		
	}
	add(im, mutes) {
		
		if (!(im instanceof InputMan)) return;
		
		const index = this.data.length;
		
		this.data[index] = im,
		im.name || (im.name = index),
		im.extId || (im.extId = ''),
		
		im.addEventListener('input-man-changed', this.boundChanged),
		im.addEventListener('input-man-deletable', this.boundInputManDeletable),
		
		this.$.appendChild(im.$),
		
		mutes || this.dispatchEvent(new CustomEvent('imm-added', { detail: im }));
		
	}
	remove(im) {
		
		if (!(im instanceof InputMan) || !this.data.includes(im)) return;
		
		im.removeEventListener('input-man-changed', this.boundChanged),
		im.removeEventListener('input-man-deletable', this.boundInputManDeletable),
		
		this.$.removeChild(im.$),
		im.$.destroyNode(),
		
		this.data.splice(this.data.indexOf(im), 1),
		
		this.dispatchEvent(new CustomEvent('imm-removed', { detail: im }));
		
	}
	setNode(node) {
		
		let i;
		
		if (!node || node.nodeType !== 1) return;
		
		i = -1, this.$ = node;
		while (this.data[++i]) this.$.append(this.data[i].node);
		
	}
	get() {
		
		const data = [];
		
		let i;
		
		i = -1;
		while (this.data[++i]) data[i] = this.data[i].get();
		
		return data;
		
	}
	
}
InputMan.LOGGER_SUFFIX = 'IMM';