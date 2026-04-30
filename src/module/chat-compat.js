const PROSEMIRROR_INPUT_SELECTORS = [
	'prosemirror-editor[name="content"]',
	"prosemirror-editor",
	"#chat-form .ProseMirror",
	".chat-form .ProseMirror",
	".ProseMirror[contenteditable=\"true\"]",
	".editor.prosemirror",
	".chat-message-editor"
];
const PROSEMIRROR_EDITOR_SELECTOR = 'prosemirror-editor[name="content"], prosemirror-editor, .ProseMirror, .editor.prosemirror';
const PROSEMIRROR_ANCHOR_SELECTOR = "prosemirror-editor, .chat-message-editor";
const PROSEMIRROR_BLOCK_SEPARATOR = "\n";
const PROSEMIRROR_LEAF_SEPARATOR = "\n";
const CHAT_INPUT_SELECTORS = [
	...PROSEMIRROR_INPUT_SELECTORS,
	"#chat-message",
	"textarea.chat-input",
	'textarea[name="content"]',
	'[contenteditable="true"]'
];
const ROLL_COMMAND_PATTERN = /^\s*\/(gmr|br|sr|r)\b/i;

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

function htmlToText(value) {
	if (typeof value !== "string") return "";
	const document = new DOMParser().parseFromString(value, "text/html");
	return document.body.textContent ?? "";
}

function textToParagraph(value) {
	if (!value) return "";
	const element = document.createElement("p");
	element.textContent = value;
	return element.outerHTML;
}

function getProseMirrorEditor(chatInput) {
	if (chatInput?.matches?.(PROSEMIRROR_EDITOR_SELECTOR)) return chatInput;
	return chatInput?.querySelector?.(PROSEMIRROR_EDITOR_SELECTOR) ?? null;
}

function getProseMirrorView(chatInput) {
	const editor = getProseMirrorEditor(chatInput);
	const candidates = [
		chatInput,
		editor,
		chatInput?.querySelector?.(".ProseMirror"),
		editor?.querySelector?.(".ProseMirror")
	];
	for (const candidate of candidates) {
		const view = candidate?.editorView ?? candidate?.view;
		if (view?.state?.doc && typeof view.dispatch === "function") return view;
	}

	const chatEditor = ui.chat?.editor;
	const view = chatEditor?.editorView ?? chatEditor?.view;
	if (view?.state?.doc && typeof view.dispatch === "function") return view;
	return null;
}

function setProseMirrorViewText(view, value) {
	const { state } = view;
	const { paragraph } = state.schema.nodes;
	if (!paragraph) return false;

	const lines = String(value).split("\n");
	const content = lines.map((line) => {
		const text = line ? state.schema.text(line) : null;
		return paragraph.create(null, text);
	});
	const tr = state.tr.replaceWith(0, state.doc.content.size, content);
	const selection = state.selection.map(tr.doc, tr.mapping);
	view.dispatch(tr.setSelection(selection).scrollIntoView());
	return true;
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
	const view = getProseMirrorView(chatInput);
	if (view) return view.state.doc.textBetween(
		0,
		view.state.doc.content.size,
		PROSEMIRROR_BLOCK_SEPARATOR,
		PROSEMIRROR_LEAF_SEPARATOR
	);
	const prosemirror = getProseMirrorEditor(chatInput);
	if (prosemirror && "value" in prosemirror) return htmlToText(prosemirror.value);
	if ("value" in chatInput) return chatInput.value;
	return chatInput.textContent ?? "";
}

export function setChatInputValue(value, chatInput = getChatInput()) {
	if (!chatInput) return false;
	const view = getProseMirrorView(chatInput);
	if (view && setProseMirrorViewText(view, value)) {
		view.focus?.();
		chatInput.dispatchEvent(new Event("input", { bubbles: true }));
		return true;
	}
	const prosemirror = getProseMirrorEditor(chatInput);
	if (prosemirror) {
		const html = textToParagraph(value);
		if (typeof prosemirror.setContent === "function") prosemirror.setContent(html);
		else if ("value" in prosemirror) prosemirror.value = html;
		else prosemirror.textContent = value;
		prosemirror.dispatchEvent(new Event("input", { bubbles: true }));
		return true;
	} else if ("value" in chatInput) chatInput.value = value;
	else chatInput.textContent = value;
	chatInput.dispatchEvent(new Event("input", { bubbles: true }));
	return true;
}

export function focusChatInput(chatInput = getChatInput()) {
	const view = getProseMirrorView(chatInput);
	if (view) {
		view.focus?.();
		return true;
	}
	chatInput?.focus();
	return Boolean(chatInput);
}

export function selectChatInput(chatInput = getChatInput()) {
	if (!chatInput) return false;
	const view = getProseMirrorView(chatInput);
	if (view) {
		view.focus?.();
		return true;
	}
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
	const chatInput = getChatInput();
	return chatInput?.closest?.(PROSEMIRROR_ANCHOR_SELECTOR)
		|| chatInput
		|| queryChatElement(getChatRoot(), [".chat-form"]);
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
