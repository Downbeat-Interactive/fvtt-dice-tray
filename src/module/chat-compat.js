const PROSEMIRROR_INPUT_SELECTORS = [
	".chat-message-editor",
	'prosemirror-editor[name="content"]',
	"prosemirror-editor"
];
const PROSEMIRROR_INPUT_SELECTOR = PROSEMIRROR_INPUT_SELECTORS.join(", ");
const CHAT_INPUT_SELECTORS = [
	...PROSEMIRROR_INPUT_SELECTORS,
	"#chat-message",
	"textarea.chat-input",
	'textarea[name="content"]',
	'[contenteditable="true"]'
];
const ROLL_COMMAND_PATTERN = /^\s*\/(gmr|br|sr|r)\b/i;
const HTML_ENTITIES = {
	"&amp;": "&",
	"&gt;": ">",
	"&lt;": "<",
	"&nbsp;": " ",
	"&quot;": "\"",
	"&#39;": "'"
};

function resolveElement(element) {
	if (element instanceof HTMLElement) return element;
	if (element?.[0] instanceof HTMLElement) return element[0];
	return null;
}

function queryChatElement(root, selectors) {
	const element = resolveElement(root);
	if (!element?.querySelector) return null;
	for (const selector of selectors) {
		const match = element.querySelector(selector);
		if (match) return match;
	}
	return null;
}

function startsHtmlTag(source, index) {
	const next = source[index + 1];
	return /[a-z/]/i.test(next) || source.startsWith("<!--", index) || source.startsWith("<!", index) || source.startsWith("<?", index);
}

function htmlToText(value) {
	let text = "";
	let inTag = false;
	const source = String(value ?? "");
	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		if (char === "<" && startsHtmlTag(source, i)) {
			inTag = true;
			continue;
		}
		if (char === ">") {
			inTag = false;
			continue;
		}
		if (!inTag) text += char;
	}
	return text.replace(/&(amp|gt|lt|nbsp|quot|#39);/g, (entity) => HTML_ENTITIES[entity] ?? entity);
}

function textToParagraph(value) {
	if (!value) return "";
	const element = document.createElement("p");
	element.textContent = value;
	return element.outerHTML;
}

function isProseMirrorElement(chatInput) {
	return chatInput?.matches?.(PROSEMIRROR_INPUT_SELECTOR)
		|| chatInput?.querySelector?.(".ProseMirror");
}

export function getChatRoot() {
	return resolveElement(ui.sidebar?.popouts?.chat?.element) || resolveElement(ui.chat?.element);
}

export function getChatInput() {
	return queryChatElement(getChatRoot(), CHAT_INPUT_SELECTORS)
		|| queryChatElement(document.body, CHAT_INPUT_SELECTORS);
}

export function getChatInputValue(chatInput = getChatInput()) {
	if (!chatInput) return "";
	if ("value" in chatInput) return htmlToText(chatInput.value);
	return chatInput.textContent ?? "";
}

export function setChatInputValue(value, chatInput = getChatInput()) {
	if (!chatInput) return false;
	if ("value" in chatInput) chatInput.value = isProseMirrorElement(chatInput) ? textToParagraph(value) : value;
	else chatInput.textContent = value;
	chatInput.dispatchEvent(new Event("input", { bubbles: true }));
	return true;
}

export function focusChatInput(chatInput = getChatInput()) {
	chatInput?.focus();
	return Boolean(chatInput);
}

export function selectChatInput(chatInput = getChatInput()) {
	if (!chatInput) return false;
	if (typeof chatInput.select === "function") {
		chatInput.select();
		return true;
	}
	if (chatInput.isContentEditable) {
		const selection = window.getSelection?.();
		if (!selection) return false;
		const range = document.createRange();
		range.selectNodeContents(chatInput);
		selection.removeAllRanges();
		selection.addRange(range);
		return true;
	}
	return false;
}

export function getChatInputAnchor() {
	return getChatInput() || queryChatElement(getChatRoot(), [".chat-form"]);
}

export function parseRollMode(formula) {
	if (typeof ui.chat?.constructor?.parse === "function") {
		try {
			const [rollMode] = ui.chat.constructor.parse(formula);
			if (rollMode) return rollMode;
		} catch(error) {
			console.warn("dice-calculator | Falling back to manual roll mode parsing.", error);
		}
	}

	switch (formula.match(ROLL_COMMAND_PATTERN)?.[1]?.toLowerCase()) {
		case "gmr":
			return "gmroll";
		case "br":
			return "blindroll";
		case "sr":
			return "selfroll";
		case "r":
		default:
			return game.settings.get("core", "rollMode");
	}
}
