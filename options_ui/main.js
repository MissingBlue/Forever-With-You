(() => {

const
boot = event => {
	
	const addButtons = QQ('.add');
	
	let i,l;
	
	i = -1;
	while (addButtons[++i]) addButtons[i].addEventListener('click', pressedAddButton);
	
},
pressedAddButton = event => {
	
	const inputNode = document.createElement('input-node');
	
	inputNode.dataset.swapGroup = 'in',
	Q('#targets').appendChild(inputNode);
	
};

addEventListener('load', boot);

})();