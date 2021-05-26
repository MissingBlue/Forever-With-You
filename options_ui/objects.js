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

class InputMan extends ExtensionNode {
	
	constructor(node, option) {
		
		super(option),
		
		this.boundChanged = this.changed.bind(this),
		this.boundInputManDeletable = this.inputManDeletable.bind(this),
		this.boundChangedChildList = this.changedChildList.bind(this),
		
		this.data = [],
		
		this.setNode(node);
		
	}
	inputManDeletable(event) {
		
		this.remove(event.detail);
		
	}
	changed(event) {
		
		this.dispatchEvent(new CustomEvent('im-changed', { detail: event.detail }));
		
	}
	add(inputNode, mutes) {
		
		if (!(inputNode instanceof InputNode)) return;
		
		if (this.data.includes(inputNode)) {
			
			const i = this.data.indexOf(inputNode);
			
			this.data[this.data - 1] = this.data.splice(i, 1)[0];
			
		} else {
			
			const i = this.data.length;
			
			(this.data[i] = inputNode).description || (inputNode.description = i),
			inputNode.extId || (inputNode.extId = ''),
			inputNode.addEvent(inputNode, 'changed', this.boundChanged),
			inputNode.addEvent(inputNode, 'pressed-del-button', this.boundInputManDeletable),
			inputNode.addEvent(inputNode, 'index-changed', this.boundChangedChildList);
			
		}
		
		this.$.appendChild(inputNode),
		
		mutes || this.dispatchEvent(new CustomEvent('im-added', { detail: inputNode }));
		
	}
	changedChildList(event) {
		
		this.data = Array.from(document.getElementById('data').children),
		this.dispatchEvent(new CustomEvent('im-changed', { detail: event.detail }));
		
	}
	remove(inputNode) {
		
		let i;
		
		if (!(inputNode instanceof InputNode) || (i = this.data.indexOf(inputNode)) === -1) return;
		
		inputNode.destroyNode(),
		
		this.data.splice(i, 1),
		
		this.dispatchEvent(new CustomEvent('im-removed', { detail: inputNode }));
		
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
		while (this.data[++i]) data[i] = this.data[i].toJson();
		
		return data;
		
	}
	
}
InputMan.LOGGER_SUFFIX = 'IM';