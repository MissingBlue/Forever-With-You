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
		
		this.setNode(node);
		
	}
	inputManDeletable(event) {
		
		this.remove(event.detail);
		
	}
	changed(event) {
		
		this.dispatchEvent(new CustomEvent('im-changed', { detail: event.detail }));
		
	}
	add(inputNode, mutes) {
		
		inputNode instanceof InputNode && (
			
			this.indexOf(inputNode) === -1 ?
				(
					inputNode.description || (inputNode.description = this.$.children.length),
					inputNode.extId || (inputNode.extId = ''),
					inputNode.addEvent(inputNode, 'changed', this.boundChanged),
					inputNode.addEvent(inputNode, 'pressed-del-button', this.boundInputManDeletable),
					inputNode.addEvent(inputNode, 'index-changed', this.boundChangedChildList)
				) :
				inputNode.remove(),
			this.$.appendChild(inputNode),
			mutes || this.dispatchEvent(new CustomEvent('im-added', { detail: inputNode }))
			
		);
		
	}
	changedChildList(event) {
		
		this.dispatchEvent(new CustomEvent('im-changed', { detail: event.detail }));
		
	}
	remove(inputNode) {
		
		inputNode instanceof InputNode && this.indexOf(inputNode) !== -1 &&
			(inputNode.destroyNode(), this.dispatchEvent(new CustomEvent('im-removed', { detail: inputNode })));
		
	}
	setNode(node) {
		
		let i;
		
		if (!node || node.nodeType !== 1) return;
		
		i = -1, this.$ = node;
		while (this.data[++i]) this.$.append(this.data[i].node);
		
	}
	get() {
		
		const data = [];
		
		let i,$;
		
		i = -1;
		while ($ = this.$.children[++i]) $ instanceof InputNode && (data[data.length] = $.toJson());
		
		return data;
		
	}
	indexOf(node) {
		
		let i,$;
		
		i = -1;
		while (($ = this.$.children[++i]) && $ !== node);
		
		return $ ? i : -1;
		
	}
	
}
InputMan.LOGGER_SUFFIX = 'IM';

