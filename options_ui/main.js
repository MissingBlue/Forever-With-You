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
	
	log('Loaded data from a storage.', storage),
	
	imm.setNode(Q('#data')),
	imm.addEventListener('imm-changed', changedIMM),
	imm.addEventListener('imm-added', changedIMM),
	imm.addEventListener('imm-removed', changedIMM),
	
	i = -1;
	while (addButtons[++i]) addButtons[i].addEventListener('click', pressedAddButton),
	
	Q('#save').addEventListener('click', pressedSaveButton);
	
	if (Array.isArray(storage.data)) {
		i = -1;
		while (storage.data[++i]) addData(storage.data[i], true);
	}
	
}
changedIMM = event => {
	
	Q('#save').classList.add('spotted');
	
},
pressedAddButton = event => {
	
	addData();
	
},
addData = (data, mutes) => {
	
	const inputMan = new InputMan();
	
	inputMan.dragGroup = 'in',
	data && (inputMan.name = data.name, inputMan.extId = data.value),
	imm.add(inputMan, mutes),
	
	log('Created a node based on the data.', data);
	
},
pressedSaveButton = event => {
	
	save(imm.get());
	
},
save = data => {
	
	log('Save.', data),
	browser.storage.local.set({ data }).then(saved);
	
},
saved = () => {
	
	Q('#save').classList.remove('spotted');
	
},
imm = new InputManMan();

addEventListener('load', boot);

})();