class OptionsUI extends CustomElement {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.container = this.shadowRoot.getElementById('data');
		
	}
	
	connectedCallback() {
		
		// this.container はこの要素に対応するテンプレート要素内のカスタム要素 <input-node-container> であることが期待される。
		// 仮にそうである場合、html 上でこの要素が定義された段階、つまり connectedCallback が呼び出された段階では、
		// <input-node-container> は未定義か定義中であることが予想される。
		// そのため、this.container が持つべきメソッド clear が未定義の場合、それは <input-node-container> が定義中であることを意味するから、
		// <input-node-container> の定義が完了した段階で通知されるイベントを捕捉して、
		// 定義の完了を確認したあとにこの要素の初期化処理を開始するようにしている。
		// 既に this.container がメソッド clear を持っている場合、つまり下記三項演算が true を示す場合、
		// 例えば一度初期化処理を行ったこの要素をドキュメントから切断後、再び接続した時などは、
		// this.container の定義を待つ必要がないため、即座にこの要素の初期化処理が行われる。
		
		typeof this.container.clear === 'function' ? this.boot() :
			this.container.addEventListener('executed-connected-callback', () => this.boot(), { once: true });
		
	}
	
	boot() {
		
		// このメソッドは一見無意味だが、メソッド init は任意のタイミングで呼び出すことを想定している。
		// 一方このメソッドは connectedCallback を通じて実行されることを想定しており、
		// その際、this.port の有無で、この要素が未初期化状態か既に初期化されているかを判定する。
		// init は this.port の有無にかかわらず強制的に初期化するため、
		// ドキュメントの接続切断操作に伴って無用な初期化処理が生じないように connectedCallback ではこのメソッドを通じて
		// 初期化の有無を判定するようにしている。
		// それでも connectedCallback 内で完結できる程度の簡素な判定処理で冗長に見えるが、
		// これは単に簡易な実装をしているだけで、必要な際はこのメソッド内に厳密な初期化の必要を判定する処理を記述することができる。
		
		this.port || this.init();
		
	}
	init() {
		
		this.container.clear(), this.destroy(true),
		
		this.port && (this.port.onMessage.removeListener(this.received), this.port.disconnect());
		
		return new Promise ((rs, rj) => {
				
				const connected = message => message === true && (
						this.log('Send a registration request to background.'),
						this.port.onMessage.removeListener(connected),
						// onMessage に指定したコールバック関数を removeListener で削除するために、
						// コールバック関数を匿名関数を通じて作成し、その中に自身の参照をクロージャとして保持させている。
						this.port.onMessage.addListener((rs => {
							
							const registered = message =>	(
																		this.log('Established a connection with background.', message),
																		this.port.onMessage.removeListener(registered),
																		this.port.onMessage.addListener(this.received),
																		this.setup(message),
																		rs(message.data)
																	);
							
							return registered;
							
						})(rs)),
						this.port.postMessage('option')
					);
				
				(this.port = browser.runtime.connect({ name: this.portName = uid4() })).onMessage.addListener(connected);
				
			});
		
	}
	setup(storage) {
		
		const	addButtons = this.qq('.add'),
				autoSaveToggle = this.shadowRoot.getElementById('auto-save'),
				inputNodeContainer = this.shadowRoot.getElementById('data');
		let i;
		
		this.setTitle(browser.runtime.getManifest().name),
		
		this.addEvent(this, 'saved', this.saved),
		this.addEvent(this, 'initialized', this.initialized),
		
		this.addEvent(
				inputNodeContainer,
				'mutated-childlist',
				event => inputNodeContainer.addEventListener('mutated-childlist', this.changedData),
				{ once: true }
			),
		this.addEvent(inputNodeContainer, 'changed', this.changedData),
		this.addEvent(inputNodeContainer, 'joined', this.changedData),
		this.addEvent(inputNodeContainer, 'parted', this.changedData),
		this.addEvent(inputNodeContainer, 'required-connection', this.requiredConnection),
		this.addEvent(inputNodeContainer, 'required-disconnection', this.requiredConnection),
		
		i = -1;
		while (addButtons[++i]) this.addEvent(addButtons[i], 'click', this.pressedAddButton);
		
		this.addEvent(this.shadowRoot.getElementById('initialize'), 'click', this.pressedInitializeButton),
		this.addEvent(this.shadowRoot.getElementById('save'), 'click', this.pressedSaveButton),
		
		this.addEvent(autoSaveToggle, 'change', this.pressedAutoSaveCheckBox),
		autoSaveToggle.checked = storage.autoSave || false;
		
		if (Array.isArray(storage.data)) {
			
			i = -1;
			while (storage.data[++i]) this.addData(storage.data[i], true);
			
		}
		
	}
	addData(data, mutes) {
		
		const inputNode = document.createElement('input-node');
		
		inputNode.dragGroup = 'main',
		data ?
			(
				inputNode.id = data.id,
				inputNode.description = data.name,
				inputNode.extId = data.value,
				inputNode.unuse = !data.enable,
				inputNode.isConnected = !!data.isConnected
			) :
			(inputNode.id = CustomElement.uid()),
		
		CustomElement[`${mutes ? 'add' : 'remove'}DatasetValue`](this.container, 'mutes', 'join'),
		this.container.appendChild(inputNode),
		mutes && CustomElement.removeDatasetValue(this.container, 'mutes', 'join'),
		
		this.log('Created a node based on the data.', data);
		
	}
	
	save(data) {
		
		this.log('Sent a data to background to update.', data),
		this.port.postMessage({ type: 'update', data: data && typeof data === 'object' ? data : { data } });
		
	}
	
	setTitle(value) {
		
		const title = document.getElementsByTagName('title')[0];
		
		this.modifiedTitle && (title.textContent.replace(this.modifiedTitle, '')),
		this.modifiedTitle = value ? `${value}${title.textContent && ' | '}` : '',
		
		title.textContent = `${this.modifiedTitle}${title.textContent}`;
		
	}
	
	toJson() {
		
		return { data: this.container.toJson() };
		
	}
	
}
OptionsUI.LOGGER_SUFFIX = 'OU',
OptionsUI.tagName = 'options-ui',
OptionsUI.bound = {
	
	pressedAddButton(event) {
		
		this.addData();
		
	},
	
	pressedSaveButton(event) {
		
		this.container instanceof InputNodeContainer && this.save(this.toJson());
		
	},
	pressedAutoSaveCheckBox(event) {
		
		this.save({ autoSave: event.target.checked });
		
	},
	checkedAutoSaveThen() {
		
		
	},
	pressedInitializeButton(event) {
		
		this.port && this.port.postMessage({ type: 'initialize' });
		
	},
	
	changedData(event) {
		
		this.shadowRoot.getElementById('auto-save').checked ?
			this.save(this.toJson()) : this.shadowRoot.getElementById('save').classList.add('spotted');
		
	},
	
	saved(event) {
		
		this.shadowRoot.getElementById('save').classList.remove('spotted'),
		
		this.log('Succeeded to update the data on background.');
		
	},
	initialized(event) {
		
		location.reload();
		
	},
	
	received(message) {
		
		let $;
		
		this.log('Received a message from background', message);
		
		if (message && typeof message === 'object') {
			
			message.type && typeof message.type === 'string' && (
					this.dispatchEvent(new CustomEvent(message.type, { detail: message })),
					($ = this.container.querySelector(`#${message.id}`)) &&
						$.dispatchEvent(new CustomEvent(message.type, { detail: message }))
				);
			
		}
		
	},
	
	requiredConnection(event) {
		
		this.log('A port required to connect.', event.detail),
		
		this.port.postMessage({
				type: event.type.endsWith('disconnection') ? 'disconnect' : 'connect',
				target: event.detail.toJson(),
				data: this.toJson()
			});
		
	}
	
};

class InputNodeContainer extends CustomElement {
	
	constructor() {
		
		super(),
		
		this.observeMutation(this.mutatedChildList, this, { childList: true });
		
	}
	connectedCallback() {
		this.dispatchEvent(new CustomEvent('executed-connected-callback'));
	}
	
	clear() {
		
		let i;
		
		i = -1;
		while (this.children[i]) this.children[i] instanceof InputNode && this.children[i].destroyNode();
		
	}
	
	toJson() {
		
		const data = [];
		
		let i,$;
		
		i = -1;
		while ($ = this.children[++i]) $ instanceof InputNode && (data[data.length] = $.toJson());
		
		return data;
	}
	
}
InputNodeContainer.LOGGER_SUFFIX = 'INC',
InputNodeContainer.tagName = 'input-node-container',
InputNodeContainer.bound = {
	
	inputNodeDeletable(event) {
		
		event.detail.remove();
		
	},
	
	changed(event) {
		
		this.dispatchEvent(new CustomEvent('changed', { detail: event.detail }));
		
	},
	
	mutatedChildList(records) {
		
		let v, method;
		
		records = ExtensionNode.getMovedNodesFromMR(records);
		for (v of records.values())	v[method = `${v.parentElement === this ? 'add' : 'remove'}Event`]
													(v, 'required-connection', this.requiredConnection),
												v[method](v, 'required-disconnection', this.requiredConnection);
		
		this.dispatchEvent(new CustomEvent('mutated-childlist', { detail: records }));
		
	},
	requiredConnection(event) {
		
		this.dispatchEvent(new CustomEvent(event.type, { detail: event.target }));
		
	}
	
};

// このカスタム要素の動作には utils.js, draggable-node.js が必須。
class InputNode extends HittableNode {
	
	constructor() {
		
		super(),
		
		this.partNode = {},
		
		this.node = Q('#node', this.shadowRoot),
		this.setConnection((this.connectButton = Q('#connect', this.shadowRoot)).value),
		this.del = Q('#del', this.shadowRoot),
		
		this.addEvent(this, 'hit-rect', this.draggedInInputNode),
		this.addEvent(this, 'above-hit-rect', this.draggedAboveInputNode),
		this.addEvent(this, 'dragged-out-target', this.draggedOutInputNode),
		this.addEvent(this.del, 'click', this.pressedDelButton),
		this.addEvent(this.connectButton, 'click', this.pressedConnectButton),
		this.addEvent(this, 'extension-connected', this.connectedExtension),
		this.addEvent(this, 'extension-disconnected', this.disconnectedExtension),
		this.observeMutation(this.mutatedConnectButtonValue, this.connectButton, InputNode.connectButtonObserveInit);
		
	}
	connectedCallback() {
		
		const $ = this.parentElement;
		
		$ instanceof InputNodeContainer && (
				
				this.description === undefined && (this.description = (new Date()).toString()),
				this.extId === undefined && (this.extId = ''),
				this.unuse === undefined && this.set('unuse', false, 'checkbox'),
				
				this.addEvent(this, 'changed', (this.lastContainer = $).changed),
				this.addEvent(this, 'pressed-del-button', $.inputNodeDeletable),
				this.addEvent(this, 'index-changed', $.changedChildList),
				
				CustomElement.parseDatasetValue($, 'mutes').includes('join') ||
					$.dispatchEvent(new CustomEvent('joined', { detail: this }))
				
			),
		
		this.root === this.hitDisp.parentElement || this.dispHitRect(this.root);
		
	}
	disconnectedCallback() {
		
		const $ = this.lastContainer;
		
		$ && (
				
				this.addEvent(this, 'changed', $.changed),
				this.addEvent(this, 'pressed-del-button', $.inputNodeDeletable),
				this.addEvent(this, 'index-changed', $.changedChildList),
				
				CustomElement.parseDatasetValue($, 'mutes').includes('part') ||
					$.dispatchEvent(new CustomEvent('parted', { detail: { self: this, parent: $ } })),
				
				this.lastContainer = null
				
			);
		
	}
	
	set(type, value, part = 'input') {
		
		if (!(type in InputNode.dictionary)) return;
		
		let i,k,node,dict;
		
		if (!(node = this.partNode[type] = Q(`input-part[slot="${type}"]`, this))) {
			
			(node = this.partNode[type] = document.createElement('input-part')).slot = type,
			node.dataset.name = (dict = InputNode.dictionary[type]).name,
			node.dataset.type = type,
			node.type = part;
			
			for (k in dict.handlerName) {
				i = -1, Array.isArray(dict.handlerName[k]) || (dict.handlerName[k] = [ dict.handlerName[k] ]);
				while (dict.handlerName[k][++i]) node.addEvent(node, k, this[InputNode.dictionary[type].handlerName[k][i]]);
			}
			
			this.appendChild(node);
			
		}
		
		part === 'checkbox' ? (node.checked = value) : (node.value = value);
		
		return node;
		
	}
	destroyNode() {
		
		this.destroy(), this.partNode.description.destroy(), this.partNode.value.destroy();
		
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
		
		return { id: this.id, name: this.description, value: this.extId, enable: !this.unuse };
		
	}
	
	setConnection(connects) {
		
		this.connectButton.textContent = (this.connectButton.value = connects || '') ? 'Connect': 'Disconnect';
		
	}
	setConnectionButton(connects) {
		
		this.connectButton.textContent = (this.connectButton.value = connects || '') ? 'Connect': 'Disconnect';
		
	}
	
	get description() { return this.partNode.description && this.partNode.description.value; }
	get dragGroup() { return this.dataset.dragGroup; }
	get extId() { return this.partNode.value && this.partNode.value.value; }
	get unuse() { return this.partNode.unuse && this.partNode.unuse.checked; }
	get isConnected() { return this.classList.contains('connected'); }
	
	set description(v) { this.set('description', v); }
	set dragGroup(v) { this.dataset.dragGroup = v; }
	set extId(v) { this.set('value', v); }
	set unuse(v) { this.set('unuse', v, 'checkbox'); }
	set isConnected(v) {
		this.classList[v ? 'add' : 'remove']('connected'),
		this.node.classList[v ? 'add' : 'remove']('connected');
	}
	
}
InputNode.LOGGER_SUFFIX = 'IpN',
InputNode.tagName = 'input-node',
InputNode.dictionary = {
	description: { name: 'Description', handlerName: { change: 'changedValue' } },
	value: { name: 'Extension ID', handlerName: { change: 'changedValue' } },
	unuse: { name: 'Unuse', handlerName: { change: 'changedValue' } }
},
InputNode.changeEventInit = { bubbles: true, composed: true },
InputNode.draggedAboveRegExp = /^dragged-above-.*/,
InputNode.draggedInsertAreaRegExp = /^(top|bottom|none)$/,
InputNode.connectButtonObserveInit = { attributes: true, attributeFilter: [ 'value' ] },
InputNode.bound = {
	
	changedValue(event) {
		this.dispatchEvent(new Event(event.type, InputNode.changeEventInit)),
		this.dispatchEvent(new CustomEvent('changed', { detail: { target: this, type: event.target.dataset.type, event } })),
		this.dispatchEvent(DraggableNode.createEvent(`changed-${event.target.dataset.type}`, this.description));
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
		
		this.dispatchEvent(DraggableNode.createEvent('index-changed'));
		
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
		
	},
	
	pressedConnectButton(event) {
		
		//this.setConnection(!event.target.value);
		this.connectButton.disabled = true,
		this.dispatchEvent(new CustomEvent(`required-${this.connectButton.value ? 'disconnection' : 'connection'}`));
		
	},
	mutatedConnectButtonValue() {
		hi(this.connectButton.value ? 'disconnect' : 'connect');
		//this.dispatchEvent(new CustomEvent(`required-to-${this.connectButton.value ? 'disconnect' : 'connect'}`));
		
	},
	connectedExtension(event) {
		
		this.classList.add('connected'), this.node.classList.add('connected'),
		this.log(`A port "${this.extId}" was connected.`, this);
		
	},
	disconnectedExtension(event) {
		
		this.classList.remove('connected'), this.node.classList.remove('connected'),
		this.log(`A port "${this.extId}" was disconnected.`, this);
		
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
		
		'type' in this.dataset && (this.type = this.dataset.type),
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
		this.input.type === 'checkbox' &&
			(this.root.classList[(this.input.checked = v) ? 'add' : 'remove']('checked'));
	}
	
}
InputPart.tagName = 'input-part',
InputPart.changeEventInit = { bubbles: true, composed: true },
InputPart.bound = {
	changed(event) {
		this.dispatchEvent(new Event('change', InputPart.changeEventInit));
	},
	toggleCheckbox(event) {
		this.root.classList[this.input.checked ? 'add' : 'remove']('checked');
	}
};


defineCustomElements(OptionsUI, InputNodeContainer, InputNode, InputPart);