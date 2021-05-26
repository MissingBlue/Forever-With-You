(() => {

const
log = createLog('Option'),
boot = event => {
	
	const title = Q('title')
	
	title.textContent = `${browser.runtime.getManifest().name} | ${title.textContent}`,
	
	browser.storage.local.get().then(init);
	
},
init = storage => {
	
	const addButtons = QQ('.add');
	
	let i;
	
	log('Loaded data from the local storage.', storage),
	
	im.setNode(Q('#data')),
	im.addEventListener('im-changed', changedIM),
	im.addEventListener('im-added', changedIM),
	im.addEventListener('im-removed', changedIM),
	
	i = -1;
	while (addButtons[++i]) addButtons[i].addEventListener('click', pressedAddButton),
	
	Q('#save').addEventListener('click', pressedSaveButton),
	Q('#initialize').addEventListener('click', pressedInitializeButton);
	
	if (Array.isArray(storage.data)) {
		i = -1;
		while (storage.data[++i]) addData(storage.data[i], true);
	}
	
}
changedIM = event => {
	
	Q('#save').classList.add('spotted');
	
},
pressedAddButton = event => {
	
	addData();
	
},
addData = (data, mutes) => {
	
	const inputNode = document.createElement('input-node');
	
	inputNode.dragGroup = 'in',
	data && (inputNode.description = data.name, inputNode.extId = data.value),
	im.add(inputNode, mutes),
	
	log('Created a node based on the data.', data);
	
},
pressedSaveButton = event => {
	
	save(im.get());
	
},
save = data => {
	
	log('Save.', data),
	browser.storage.local.set({ data }).then(saved);
	
},
saved = () => {
	
	Q('#save').classList.remove('spotted');
	
},
pressedInitializeButton = () => {
	browser.storage.local.clear().then(() => location.reload());
},
im = new InputMan();

addEventListener('load', boot);

})();