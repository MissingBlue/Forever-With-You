class OptionsUI extends CustomElement {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.container = this.shadowRoot.getElementById('data');
		
	}
	
	connectedCallback() {
		
		// デバッグ用のロガーの可否。<background-node> に属性 data-logs を設定すると、その値にかかわらずログを行う。
		// メソッド logSwitch の実行は、任意の箇所で行える。ただし、動作が変更するのは可否の設定後で、例えば設定変更前のログを消したり表示したりすることはできない。
		this.logSwitch('logs' in this.dataset),
		
		// this.container はこの要素に対応するテンプレート要素内のカスタム要素 <input-node-container> であることが期待される。
		// 仮にそうである場合、html 上でこの要素が定義された段階、つまり connectedCallback が呼び出された段階では、
		// <input-node-container> は未定義か定義中であることが予想される。
		// そのため、this.container が持つべきメソッド clear が未定義の場合、それは <input-node-container> が定義中であることを意味するから、
		// <input-node-container> の定義が完了した段階で通知されるイベントを捕捉して、
		// 定義の完了を確認したあとにこの要素の初期化処理を開始するようにしている。
		// 既に this.container がメソッド clear を持っている場合、つまり下記三項演算が true を示す場合、
		// 例えば一度初期化処理を行ったこの要素をドキュメントから切断後、再び接続した時などは、
		// this.container の定義を待つ必要がないため、即座にこの要素の初期化処理が行われる。
		
		this.log('Connected with a document.', this),
		
		typeof this.container.clear === 'function' ? 
			(
				this.log('Child nodes might be finished to be defined, initializing is begun immediately.', this),
				this.boot()
			) : (
				this.log('Child nodes might not be defined, waiting for it to initialize this node.', this),
				this.container.addEventListener(
						'executed-connected-callback',
						event => (this.log('Defined child nodes was listened.', event, this), this.boot()),
						{ once: true }
					)
			);
		
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
		
		this.port ||
			this.init().then(() => {
					const logs =
						deco(`  Welcome to the "${WX_META.name} version ${WX_META.version}" options  `, '|','|',' ', '~','~');
					this.log('Succeeded to initialize the node.', this),
					this.log(logs.border),this.log(logs.content),this.log(logs.border)
				});
		
	}
	init() {
		
		this.container.clear(), this.destroy(true),
		
		this.port && (this.port.onMessage.removeListener(this.received), this.port.disconnect());
		
		return new Promise((rs, rj) => {
				
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
																		this.setup(message.data),
																		rs(message.data)
																	);
							
							return registered;
							
						})(rs)),
						this.port.postMessage('option')
					);
				
				(this.port = browser.runtime.connect({ name: this.portName = uid4() })).onMessage.addListener(connected);
				
			});
		
	}
	setup(storage = {}) {
		
		const	addButtons = this.qq('.add'),
				autoSaveToggle = this.shadowRoot.getElementById('auto-save'),
				loggingButton = this.q('#logger'),
				inputNodeContainer = this.shadowRoot.getElementById('data'),
				data = storage && storage.data && typeof storage.data === 'object' ?
					storage.data[this.dataset.for || (this.dataset.for = Object.keys(storage.data)[0])] : null;
		let i;
		
		this.logSwitch(storage.logs = 'logs' in storage ? !!storage.logs : OptionsUI.DISABLE_LOG_FLAG),
		
		this.setTitle(browser.runtime.getManifest().name),
		
		this.addEvent(this, 'saved', this.saved),
		this.addEvent(this, 'updated', this.saved),
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
		autoSaveToggle.checked = (storage && storage.autoSave) || false,
		
		loggingButton.checked = storage.logs,
		this.addEvent(loggingButton, 'change', this.changedLogger),
		
		this.addEvent(this, 'changed', this.changedData);
		
		if (Array.isArray(data)) {
			
			i = -1;
			while (data[++i]) this.addData(data[i], true, true);
			
		}
		
	}
	addData(data, mutes, asTemp) {
		
		const inputNode = document.createElement('input-node');
		
		inputNode.dragGroup = 'main',
		
		asTemp && (inputNode.dataset.temporary = 'true'),
		
		data ?	(
						inputNode.id = data.id,
						inputNode.description = data.name,
						inputNode.extId = data.value,
						inputNode.unuse = !data.enable,
						inputNode.isConnected = !!data.isConnected,
						data.isConnected === null && (inputNode.connectButton.disabled = true)
					) :
					(
						inputNode.id = CustomElement.uid(),
						inputNode.isConnected = false,
						inputNode.classList.add('unregistered'),
						inputNode.connectButton.disabled = true
					),
		
		CustomElement[`${mutes ? 'add' : 'remove'}DatasetValue`](this.container, 'mutes', 'join'),
		this.container.appendChild(inputNode),
		mutes && CustomElement.removeDatasetValue(this.container, 'mutes', 'join'),
		
		this.log('Created a node with the following data.', data);
		
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
		
		return { data: { [this.dataset.for]: this.container.toJson() }, logs: this.q('#logger').checked };
		
	}
	
	static LOGGER_SUFFIX = 'OU';
	static tagName = 'options-ui';
	static DISABLE_LOG_FLAG = true;
	static bound = {
		
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
			
			const unregistered = this.qq('input-node.unregistered');
			let i, inputNode, datum;
			
			i = -1;
			while (unregistered[++i])	unregistered[i].classList.remove('unregistered'),
												unregistered[i].connectButton.removeAttribute('disabled');
			
			i = -1;
			while (datum = event.detail[++i]) (inputNode = this.q(`#${datum.id}`)) &&
				inputNode.classList.contains('connected') !== datum.isConnected &&
					inputNode.changeConnectionStatus(datum.isConnected);
			
			this.shadowRoot.getElementById('save').classList.remove('spotted'),
			
			this.log('Succeeded to update the data on background.');
			
		},
		initialized(event) {
			
			location.reload();
			
		},
		changedLogger(event) {
			
			this.logSwitch(!!event.target.checked),
			this.port.postMessage({ type: 'logging', portName: this.portName, value: !!event.target.checked }),
			this.emit('changed', !!event.target.checked);
			
		},
		
		received(message) {
			
			let i,k,$;
			
			this.log('Received a message from background', message);
			
			if (message && typeof message === 'object') {
				
				if (!message.type || typeof message.type !== 'string') return;
				
				switch (message.type) {
					
					case 'updated':
					for (k in message.data.data) {
						i = -1, $ = document.querySelectorAll(`[data-for="${k}"]`);
						while ($[++i]) $[i].emit(message.type, message.data.data[k]);
					}
					break;
					
					case 'extension-connection':
					($ = this.q(`#${message.data.id}`)) && $.emit(message.type, message.data);
					break;
					
					case 'logging':
					message.data.portName === this.portName || this.logSwitch(this.q('#logger').checked = message.data.value);
					break;
					
					default:
					this.emit(message.type, message);
					
				}
				
			}
			
		},
		
		requiredConnection(event) {
			
			this.log(
					`A node ${event.detail.id} required to connect with an external extension "${event.detail.extId}".`,
					event.detail
				),
			
			this.port.postMessage({ type: 'connection', target: event.detail.toJson(true), data: this.toJson() });
			
		}
		
	};
	
}

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
	
	static LOGGER_SUFFIX = 'INC';
	static tagName = 'input-node-container';
	static bound = {
		
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
	
}

// このカスタム要素の動作には utils.js, draggable-node.js が必須。
class InputNode extends HittableNode {
	
	constructor() {
		
		super({ loggerPrefix: WX_SHORT_NAME }),
		
		this.partNode = {},
		
		this.node = Q('#node', this.shadowRoot),
		this.connectButton = Q('#connect', this.shadowRoot),
		this.del = Q('#del', this.shadowRoot),
		
		this.addEvent(this, 'hit-rect', this.draggedInInputNode),
		this.addEvent(this, 'above-hit-rect', this.draggedAboveInputNode),
		this.addEvent(this, 'dragged-out-target', this.draggedOutInputNode),
		this.addEvent(this.del, 'click', this.pressedDelButton),
		this.addEvent(this.connectButton, 'click', this.pressedConnectButton),
		
		this.addEvent(this, 'extension-connection', this.onConnection),
		this.observeMutation(this.mutatedClassName, this, InputNode.classNameObserveInit);
		
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
	
	reflectConnection() {
		
		this.connectButton.textContent = this.isConnected ? 'Disconnect' : 'Connect',
		this.node.classList[this.isConnected ? 'add' : 'remove']('connected');
		
		return 'temporary' in this.dataset && (delete this.dataset.temporary, true);
		
	}
	changeConnectionStatus(isConnected) {
		
		this.dataset.temporary = 'true',
		this.classList[isConnected ? 'add' : 'remove']('connected'),
		isConnected === null ? (this.connectButton.disabled = true) : this.connectButton.removeAttribute('disabled');
		
	}
	
	toJson(extra) {
		
		const data = { id: this.id, name: this.description, value: this.extId, enable: !this.unuse };
		
		extra && (data.isConnected = !!this.isConnected);
		
		return data;
		
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
		this.classList.contains('connected') === !!v ?	this.reflectConnection() :
																		this.classList[v ? 'add' : 'remove']('connected');
	}
	
	static LOGGER_SUFFIX = 'IpN';
	static tagName = 'input-node';
	static dictionary = {
		description: { name: 'Description', handlerName: { change: 'changedValue' } },
		value: { name: 'Extension ID', handlerName: { change: 'changedValue' } },
		unuse: { name: 'Unuse', handlerName: { change: 'changedValue' } }
	};
	static changeEventInit = { bubbles: true, composed: true };
	static draggedAboveRegExp = /^dragged-above-.*/;
	static draggedInsertAreaRegExp = /^(top|bottom|none)$/;
	static classNameObserveInit = { attributes: true, attributeFilter: [ 'class' ], attributeOldValue: true };
	static bound = {
		
		changedValue(event) {
			
			this.emit(event.type, InputNode.changeEventInit),
			this.emit('changed', { detail: { target: this, type: event.target.dataset.type, event } }),
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
			
			this.isConnected = !this.isConnected;
			
		},
		mutatedClassName(mr) {
			
			let i;
			
			i = -1;
			while (mr[++i] && (!mr[i].oldValue || !mr[i].oldValue.split(' ').includes('connected')));
			
			if (!!mr[i] === this.classList.contains('connected')) return;
			
			this.reflectConnection() || (
					this.connectButton.disabled = true,
					this.emit(`required-${this.classList.contains('connected') ? 'connection' : 'disconnection'}`)
				);
			
		},
		onConnection(event) {
			
			const wouldBeConnected = this.classList.contains('connected');
			
			this.connectButton.removeAttribute('disabled'),
			
			event.detail.isConnected === wouldBeConnected ?
				this.reflectConnection() :
				(this.dataset.temporary = 'true', this.classList[wouldBeConnected ? 'remove' : 'add']('connected')),
			
			event.detail.unavailable === true && alert('This button is unavailable before update.'),
			
			this.log(`Got a connection issue about an extension "${event.detail.value}".`, event, this);
			
		}
		
	};
	
}

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
	
	static tagName = 'input-part';
	static changeEventInit = { bubbles: true, composed: true };
	static bound = {
		changed(event) {
			this.dispatchEvent(new Event('change', InputPart.changeEventInit));
		},
		toggleCheckbox(event) {
			this.root.classList[this.input.checked ? 'add' : 'remove']('checked');
		}
	};
	
}

defineCustomElements(OptionsUI, InputNodeContainer, InputNode, InputPart);