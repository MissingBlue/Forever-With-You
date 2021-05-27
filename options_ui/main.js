(() => {

let port;

const
log = createLog('Option'),
boot = event => {
	
	const title = Q('title');
	
	title.textContent = `${browser.runtime.getManifest().name} | ${title.textContent}`,
	
	(port = browser.runtime.connect({ name: 'option' })).onMessage.addListener(listened);
	
},
listened = message => {
	
	if (message === true) {
		browser.storage.local.get().then(init);
		return;
	}
	
},
init = storage => {
	
	const	addButtons = QQ('.add'),
			autoSaveToggle = document.getElementById('auto-save'),
			inputNodeContainer = document.getElementById('data');
	
	let i;
	
	log('Loaded data from the local storage.', storage),
	
	inputNodeContainer.addEventListener(
			'mutated-childlist',
			event => inputNodeContainer.addEventListener('mutated-childlist', changedData),
			{ once: true }
		),
	inputNodeContainer.addEventListener('changed', changedData),
	inputNodeContainer.addEventListener('joined', changedData),
	inputNodeContainer.addEventListener('parted', changedData),
	
	i = -1;
	while (addButtons[++i]) addButtons[i].addEventListener('click', pressedAddButton);
	
	document.getElementById('initialize').addEventListener('click', pressedInitializeButton),
	document.getElementById('save').addEventListener('click', pressedSaveButton),
	
	autoSaveToggle.addEventListener('change', event => {
			
			const saved = browser.storage.local.set({ autoSave: event.target.checked });
			
			autoSaveToggle.checked &&
				saved.then(() => Q('#save').classList.contains('spotted') && save(document.getElementById('data').get()));
			
		}),
	autoSaveToggle.checked = storage.autoSave || false;
	
	if (Array.isArray(storage.data)) {
		
		i = -1;
		while (storage.data[++i]) addData(storage.data[i], true);
		
	}
	
}
changedData = event => {
	
	document.getElementById('auto-save').checked ?
		save(document.getElementById('data').get()) : document.getElementById('save').classList.add('spotted');
	
},
pressedAddButton = event => {
	
	addData();
	
},
addData = (data, mutes) => {
	
	const	container = document.getElementById('data'),
			inputNode = document.createElement('input-node');
	
	inputNode.dragGroup = 'main',
	data && (inputNode.description = data.name, inputNode.extId = data.value, inputNode.unuse = data.enable),
	
	CustomElement[`${mutes ? 'add' : 'remove'}DatasetValue`](container, 'mutes', 'join'),
	container.appendChild(inputNode),
	mutes && CustomElement.removeDatasetValue(container, 'mutes', 'join'),
	
	log('Created a node based on the data.', data);
	
},
pressedSaveButton = event => {
	
	save(document.getElementById('data').toJson());
	
},
save = data => {
	
	log('Save.', data),
	browser.storage.local.set({ data }).then(() => saved(data));
	
},
saved = data => {
	
	port.postMessage({ on: 'update', data }),
	Q('#save').classList.remove('spotted');
	
},
pressedInitializeButton = () => {
	
	browser.storage.local.clear().then(() => location.reload());
	
};

addEventListener('load', boot);

})();